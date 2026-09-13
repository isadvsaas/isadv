// BLOCO 6 — Catálogo de agentes: templates globais (super admin) + instalação por empresa.
// company_id é SEMPRE derivado da sessão no servidor; nunca vem do frontend.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agentSlugify } from "@/lib/agents";

export type AgentTemplate = {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  descricao: string;
  descricao_curta: string;
  icon: string | null;
  ativo: boolean;
  destaque: boolean;
  prompt_base: string;
  provider_default: string;
  model_default: string;
  channels_supported: string[];
  default_tools: string[];
  recommended_followup: any | null;
  recommended_stages: Array<{ nome: string; tipo?: string; cor?: string }>;
  created_at: string;
  updated_at: string;
};

export type TemplateField = {
  id: string;
  template_id: string;
  key: string;
  label: string;
  description: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  active: boolean;
};

export type InstalledAgent = {
  id: string;
  nome_agente: string;
  slug: string;
  descricao: string;
  ativo: boolean;
  is_default: boolean;
  prioridade: number;
  channels: string[];
  allowed_tools: string[];
  source_template_id: string | null;
  created_at: string;
};

async function currentCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("company_user")
    .select("company_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa ativa");
  return data.company_id as string;
}

async function assertSuperAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado");
}

function toTemplate(row: any): AgentTemplate {
  return {
    ...row,
    default_tools: Array.isArray(row.default_tools) ? row.default_tools.map(String) : [],
    channels_supported: Array.isArray(row.channels_supported) ? row.channels_supported : ["whatsapp"],
    recommended_stages: Array.isArray(row.recommended_stages) ? row.recommended_stages : [],
  } as AgentTemplate;
}

// --------------------------------------------------------------- catálogo (cliente)

export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const [{ data: tpls, error }, { data: fields }, { data: installed }] = await Promise.all([
      context.supabase
        .from("agent_templates")
        .select("*")
        .eq("ativo", true)
        .order("destaque", { ascending: false })
        .order("nome", { ascending: true }),
      context.supabase.from("agent_template_fields").select("*").eq("active", true).order("sort_order"),
      context.supabase.from("agent_config").select("source_template_id").eq("company_id", cid),
    ]);
    if (error) throw new Error(error.message);
    const installedIds = (installed ?? []).map((a: any) => a.source_template_id).filter(Boolean) as string[];
    return {
      templates: (tpls ?? []).map(toTemplate),
      fields: (fields ?? []) as TemplateField[],
      installedTemplateIds: installedIds,
    };
  });

export const listMyAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("agent_config")
      .select("id, nome_agente, slug, descricao, ativo, is_default, prioridade, channels, allowed_tools, source_template_id, created_at")
      .eq("company_id", cid)
      .order("is_default", { ascending: false })
      .order("prioridade", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((a: any) => ({
      ...a,
      channels: Array.isArray(a.channels) ? a.channels : ["whatsapp"],
      allowed_tools: Array.isArray(a.allowed_tools) ? a.allowed_tools.map(String) : [],
    })) as InstalledAgent[];
  });

// --------------------------------------------------------------- instalação

export const installTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string }) => {
    const templateId = String(d?.templateId || "").trim();
    if (!templateId) throw new Error("Template inválido");
    return { templateId };
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const cid = await currentCompanyId(supabase, context.userId);

    const { data: tplRow, error: tplErr } = await supabase
      .from("agent_templates")
      .select("*")
      .eq("id", data.templateId)
      .eq("ativo", true)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!tplRow) throw new Error("Template não encontrado ou indisponível");
    const tpl = toTemplate(tplRow);

    // 8. prevenção de duplicidade
    const { data: dup } = await supabase
      .from("agent_config")
      .select("id")
      .eq("company_id", cid)
      .eq("source_template_id", tpl.id)
      .maybeSingle();
    if (dup?.id) return { ok: true, agentId: dup.id as string, alreadyInstalled: true };

    const { data: companyRow } = await supabase.from("company").select("nome").eq("id", cid).maybeSingle();
    const { count } = await supabase
      .from("agent_config")
      .select("id", { count: "exact", head: true })
      .eq("company_id", cid);
    const isFirst = (count ?? 0) === 0;

    // slug único dentro da company
    const base = agentSlugify(tpl.nome);
    const { data: slugs } = await supabase.from("agent_config").select("slug").eq("company_id", cid);
    const used = new Set((slugs ?? []).map((s: any) => s.slug));
    let slug = base;
    let i = 2;
    while (used.has(slug)) slug = `${base}-${i++}`;

    const { data: agent, error: insErr } = await supabase
      .from("agent_config")
      .insert({
        company_id: cid,
        user_id: context.userId,
        nome_agente: tpl.nome,
        slug,
        descricao: tpl.descricao_curta || tpl.descricao,
        ativo: true,
        is_default: isFirst,
        prioridade: (count ?? 0) + 1,
        source_template_id: tpl.id,
        channels: tpl.channels_supported,
        allowed_tools: tpl.default_tools,
        papel_objetivo: tpl.prompt_base,
        ai_provider: tpl.provider_default,
        ai_model: tpl.model_default,
        nome_empresa: (companyRow as any)?.nome ?? "",
        segmento: tpl.categoria,
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const agentId = (agent as any).id as string;

    // 2. custom fields do template → campos do agente
    const { data: tplFields } = await supabase
      .from("agent_template_fields")
      .select("*")
      .eq("template_id", tpl.id)
      .eq("active", true)
      .order("sort_order");
    let fieldsCopied = 0;
    if ((tplFields ?? []).length) {
      const rows = (tplFields ?? []).map((f: any) => ({
        company_id: cid,
        agent_id: agentId,
        key: f.key,
        label: f.label,
        description: f.description ?? "",
        field_type: f.field_type,
        options: f.options ?? [],
        required: !!f.required,
        active: true,
        sort_order: f.sort_order ?? 0,
      }));
      const { error } = await supabase.from("agent_custom_fields").insert(rows as any);
      if (!error) fieldsCopied = rows.length;
    }

    // 5. stages recomendadas (nunca duplica, nunca apaga)
    let stagesCreated = 0;
    if (tpl.recommended_stages.length) {
      const { data: existing } = await supabase.from("crm_stage").select("nome, ordem").eq("company_id", cid);
      const norm = (s: string) =>
        String(s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
      const have = new Set((existing ?? []).map((s: any) => norm(s.nome)));
      let ordem = Math.max(-1, ...(existing ?? []).map((s: any) => Number(s.ordem) || 0)) + 1;
      const toCreate = tpl.recommended_stages
        .filter((s) => s?.nome && !have.has(norm(s.nome)))
        .map((s) => ({
          company_id: cid,
          nome: s.nome,
          tipo: (s.tipo as any) || "normal",
          cor: s.cor || "#8AA89A",
          ordem: ordem++,
        }));
      if (toCreate.length) {
        const { error } = await supabase.from("crm_stage").insert(toCreate as any);
        if (!error) stagesCreated = toCreate.length;
      }
    }

    // 4. follow-up recomendado → nova sequência DA COMPANY (cópia independente)
    let followupCopied = false;
    const fu = tpl.recommended_followup as any;
    if (fu && Array.isArray(fu.steps) && fu.steps.length) {
      const { data: seq, error: seqErr } = await supabase
        .from("followup_sequence")
        .insert({
          company_id: cid,
          agent_id: agentId,
          nome: fu.nome || `Follow-up ${tpl.nome}`,
          ativo: false,
          timezone: fu.timezone || "America/Sao_Paulo",
          allowed_start_time: fu.allowed_start_time || "08:00",
          allowed_end_time: fu.allowed_end_time || "20:00",
          final_action: fu.final_action || "none",
          restart_on_reply: fu.restart_on_reply ?? true,
        } as any)
        .select("id")
        .single();
      if (!seqErr && seq) {
        const steps = fu.steps.slice(0, 20).map((s: any, idx: number) => ({
          sequence_id: (seq as any).id,
          company_id: cid,
          ordem: idx,
          delay_value: Math.max(1, Number(s.delay_value) || 1),
          delay_unit: ["minutes", "hours", "days"].includes(s.delay_unit) ? s.delay_unit : "hours",
          message_mode: ["ai", "template", "none"].includes(s.message_mode) ? s.message_mode : "ai",
          message_template: String(s.message_template || "").slice(0, 2000),
          finalize: !!s.finalize,
          active: true,
        }));
        const { error } = await supabase.from("followup_step").insert(steps as any);
        followupCopied = !error;
      }
    }

    return { ok: true, agentId, alreadyInstalled: false, fieldsCopied, stagesCreated, followupCopied };
  });

// --------------------------------------------------------------- gestão dos meus agentes

export const updateMyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo?: boolean; makeDefault?: boolean; channels?: string[] }) => {
    if (!d?.id) throw new Error("Agente inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const patch: Record<string, any> = {};
    if (typeof data.ativo === "boolean") patch.ativo = data.ativo;
    if (Array.isArray(data.channels)) {
      patch.channels = data.channels.filter((c) => c === "whatsapp" || c === "instagram");
    }
    if (data.makeDefault) {
      patch.ativo = true;
      patch.is_default = true;
      await context.supabase.from("agent_config").update({ is_default: false }).eq("company_id", cid);
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("agent_config")
      .update(patch as any)
      .eq("id", data.id)
      .eq("company_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Agente inválido");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { data: agents } = await context.supabase
      .from("agent_config")
      .select("id, is_default")
      .eq("company_id", cid);
    const list = agents ?? [];
    if (list.length <= 1) throw new Error("A empresa precisa de pelo menos um agente");
    const target = list.find((a: any) => a.id === data.id);
    if (!target) throw new Error("Agente não encontrado");

    // integridade das conversas: solta os vínculos em vez de apagar histórico
    await context.supabase
      .from("conversation_agent_state")
      .update({ agent_id: null })
      .eq("company_id", cid)
      .eq("agent_id", data.id);
    await context.supabase.from("followup_state").update({ agent_id: null }).eq("company_id", cid).eq("agent_id", data.id);

    const { error } = await context.supabase.from("agent_config").delete().eq("id", data.id).eq("company_id", cid);
    if (error) throw new Error(error.message);

    if ((target as any).is_default) {
      const next = list.find((a: any) => a.id !== data.id);
      if (next) {
        await context.supabase
          .from("agent_config")
          .update({ is_default: true, ativo: true })
          .eq("id", (next as any).id)
          .eq("company_id", cid);
      }
    }
    return { ok: true };
  });

// --------------------------------------------------------------- super admin

export const adminListTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const [{ data: tpls, error }, { data: fields }] = await Promise.all([
      context.supabase.from("agent_templates").select("*").order("nome"),
      context.supabase.from("agent_template_fields").select("*").order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    return { templates: (tpls ?? []).map(toTemplate), fields: (fields ?? []) as TemplateField[] };
  });

export type TemplateInput = {
  id?: string;
  nome: string;
  slug?: string;
  categoria: string;
  descricao_curta: string;
  descricao: string;
  prompt_base: string;
  provider_default: string;
  model_default: string;
  ativo: boolean;
  destaque: boolean;
  channels_supported: string[];
  default_tools: string[];
  recommended_stages: Array<{ nome: string; tipo?: string }>;
  recommended_followup: any | null;
  fields: Array<{ key: string; label: string; description?: string; field_type: string; required?: boolean }>;
};

export const adminSaveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: TemplateInput) => {
    if (!d?.nome?.trim()) throw new Error("Nome obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const supabase = context.supabase;
    const payload = {
      nome: data.nome.trim(),
      slug: agentSlugify(data.slug || data.nome),
      categoria: (data.categoria || "geral").trim(),
      descricao_curta: (data.descricao_curta || "").slice(0, 300),
      descricao: data.descricao || "",
      prompt_base: data.prompt_base || "",
      provider_default: data.provider_default || "openai",
      model_default: data.model_default || "gpt-4o-mini",
      ativo: !!data.ativo,
      destaque: !!data.destaque,
      channels_supported: (data.channels_supported || []).filter((c) => c === "whatsapp" || c === "instagram"),
      default_tools: data.default_tools || [],
      recommended_stages: (data.recommended_stages || []).filter((s) => s?.nome),
      recommended_followup: data.recommended_followup ?? null,
    };

    let templateId = data.id;
    if (templateId) {
      const { error } = await supabase.from("agent_templates").update(payload as any).eq("id", templateId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase.from("agent_templates").insert(payload as any).select("id").single();
      if (error) throw new Error(error.message);
      templateId = (row as any).id;
    }

    // campos: substitui a definição (não afeta agentes já instalados)
    await supabase.from("agent_template_fields").delete().eq("template_id", templateId!);
    const rows = (data.fields || [])
      .filter((f) => f?.key?.trim() && f?.label?.trim())
      .map((f, idx) => ({
        template_id: templateId!,
        key: agentSlugify(f.key).replace(/-/g, "_"),
        label: f.label.trim(),
        description: f.description ?? "",
        field_type: f.field_type || "string",
        required: !!f.required,
        sort_order: idx,
        active: true,
      }));
    if (rows.length) {
      const { error } = await supabase.from("agent_template_fields").insert(rows as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: templateId };
  });

export const adminToggleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo?: boolean; destaque?: boolean }) => {
    if (!d?.id) throw new Error("Template inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const patch: Record<string, any> = {};
    if (typeof data.ativo === "boolean") patch.ativo = data.ativo;
    if (typeof data.destaque === "boolean") patch.destaque = data.destaque;
    const { error } = await context.supabase.from("agent_templates").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Template inválido");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { error } = await context.supabase.from("agent_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
