-- ============================================================================
-- GERADOR DE BASELINE DO SCHEMA (AtendZap)
-- ----------------------------------------------------------------------------
-- Contexto: as migrations do repositório criam apenas parte das tabelas
-- (agenda_*, agent_material, agent_templates, followup_*, message_processing_queue,
-- instagram_integration, worker_auth, agent_custom_fields, conversation_agent_state).
-- Tabelas do core (company, company_user, agent_config, crm_*, mensagens, plan,
-- subscription, fin_*, campaign*, etc.) nasceram fora do repositório, então um
-- banco novo NÃO é reproduzível apenas com as migrations atuais.
--
-- Estratégia segura (não destrutiva): gerar um arquivo de BASELINE idempotente
-- a partir do banco atual e commitá-lo como a migration mais antiga. Nada é
-- apagado, resetado ou recriado — todo o DDL gerado usa IF NOT EXISTS / DO
-- condicional, portanto é no-op no banco em produção.
--
-- Como usar:
--   1. Rode este SELECT no banco (SQL editor / psql) — ele NÃO altera nada.
--   2. Salve a saída em supabase/migrations/00000000000000_baseline_schema.sql
--   3. Valide restaurando em um banco vazio de teste (nunca no de produção).
-- ============================================================================

with enums as (
  select string_agg(
    format(
      'do $$ begin if not exists (select 1 from pg_type where typname = %L) then create type public.%I as enum (%s); end if; end $$;',
      t.typname, t.typname,
      (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)
         from pg_enum e where e.enumtypid = t.oid)
    ), E'\n' order by t.typname) as sql
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e'
),
tabs as (
  select string_agg(
    format('create table if not exists public.%I (%s%s%s);', c.relname, E'\n',
      (select string_agg('  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
                || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
                || case when a.attnotnull then ' not null' else '' end, E',\n' order by a.attnum)
         from pg_attribute a
         left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      E'\n'), E'\n\n' order by c.relname) as sql
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
cons as (
  select string_agg(
    format('alter table public.%I add constraint %I %s;', rel.relname, con.conname, pg_get_constraintdef(con.oid)),
    E'\n' order by rel.relname, con.conname) as sql
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
),
idx as (
  select string_agg(replace(indexdef, 'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS'), E';\n' order by indexname) || ';' as sql
  from pg_indexes where schemaname = 'public' and indexname not like '%_pkey'
),
funcs as (
  select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by p.proname) || ';' as sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.proname not like 'gbt%'
    and p.proname not in ('cash_dist','date_dist','float4_dist','float8_dist','int2_dist','int4_dist','int8_dist','interval_dist','oid_dist','gbtreekey16_in','gbtreekey16_out')
),
trigs as (
  select string_agg(pg_get_triggerdef(t.oid), E';\n' order by t.tgname) || ';' as sql
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
rls as (
  select string_agg(format('alter table public.%I enable row level security;', c.relname), E'\n' order by c.relname) as sql
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
),
pols as (
  select string_agg(
    format('create policy %I on public.%I as %s for %s to %s%s%s;',
      policyname, tablename, permissive, cmd, array_to_string(roles, ', '),
      coalesce(' using (' || qual || ')', ''),
      coalesce(' with check (' || with_check || ')', '')),
    E'\n' order by tablename, policyname) as sql
  from pg_policies where schemaname = 'public'
),
grants as (
  select string_agg(distinct
    format('grant %s on public.%I to %I;', privilege_type, table_name, grantee), E'\n') as sql
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
)
select concat_ws(E'\n\n',
  '-- BASELINE gerado automaticamente (idempotente, não destrutivo).',
  '-- ENUMS', (select sql from enums),
  '-- TABELAS', (select sql from tabs),
  '-- CONSTRAINTS (rode manualmente apenas em banco novo)', (select sql from cons),
  '-- ÍNDICES', (select sql from idx),
  '-- FUNÇÕES', (select sql from funcs),
  '-- TRIGGERS', (select sql from trigs),
  '-- RLS', (select sql from rls),
  '-- POLICIES', (select sql from pols),
  '-- GRANTS', (select sql from grants)
) as baseline_sql;
