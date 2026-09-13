# Módulo de Agenda — do parcial ao completo

Objetivo: a IA poder consultar horários reais, agendar, remarcar e cancelar; e a empresa poder ver e gerenciar a agenda no painel. Nada de planos, checkout, CRM, tenancy ou fluxo de texto atual é alterado.

## Etapa 1 — Estrutura de disponibilidade (banco)
- `agenda_servico`: empresa, nome, duração em minutos, intervalo entre atendimentos, antecedência mínima, ativo.
- `agenda_recurso` (profissional/sala): empresa, nome, ativo (opcional na criação; agenda única se não usado).
- `agenda_janela`: empresa, recurso, dia da semana, hora início, hora fim.
- `agenda_bloqueio`: empresa, recurso, início, fim, motivo (férias, feriado, almoço extra).
- `agendamento`: acrescentar serviço, recurso, telefone/canal do cliente, status `agendado | remarcado | cancelado | concluido`, e versionar a tabela em uma migration própria.
- RLS por empresa em todas, com GRANTs para authenticated e service_role.

## Etapa 2 — Motor de disponibilidade (servidor)
- Novo `src/lib/agenda.server.ts`: gera slots a partir de janelas − bloqueios − agendamentos existentes, respeitando duração, intervalo, antecedência e timezone da empresa.
- Se o Google Agenda estiver conectado, também consulta `freeBusy` do calendário para descartar horários ocupados fora do sistema.
- Trava de conflito na criação (verificação transacional) para não gerar dois agendamentos no mesmo slot.

## Etapa 3 — Google Agenda completo
- Reaproveita o OAuth e o refresh de token existentes.
- Acrescenta consulta de evento, atualização (remarcar) e remoção (cancelar), mantendo `google_event_id` sincronizado com o registro interno.

## Etapa 4 — Tools de IA
- Novas tools no runtime já existente: `consultar_disponibilidade`, `criar_agendamento`, `remarcar_agendamento`, `cancelar_agendamento`.
- Substitui o mecanismo atual de texto `[[AGENDAR: ...]]` por tool-calling, mantendo o bloco antigo funcionando por compatibilidade.
- Prompt passa a instruir a IA a nunca inventar horário: sempre consultar antes de oferecer.
- Supervisor ganha reconhecimento de intenção de agendamento para rotear ao agente com agenda habilitada.

## Etapa 5 — Painel
- Nova página "Agenda" no menu: visão de dia/semana, lista de próximos atendimentos, criar/editar/remarcar/cancelar manualmente.
- Configuração simples de horários dentro do Atendente IA: serviços, duração, dias e horários de atendimento, bloqueios — substituindo os campos de texto livre atuais (os textos existentes são migrados como referência).
- Mobile first: lista por dia com chips de data em vez de grade horizontal.

## Etapa 6 — Lembretes
- Reaproveita o motor de follow-up para lembrete antes do horário e pedido de confirmação, sem criar novo cron.

## Detalhes técnicos
- Tabelas novas via migration única por etapa, com GRANT + RLS por `company_id` usando `has_company_access`.
- Slots calculados no servidor (nunca no cliente) para evitar divergência de timezone.
- Tools registradas em `src/lib/agent-tools.server.ts` e executadas pelo loop de `src/lib/agent-runtime.server.ts`.
- Google Calendar via `src/lib/google.server.ts`, com fallback: se não conectado, agenda apenas interna.
- Gating de plano mantido: Google Agenda continua Pro/Business; agenda interna disponível a todos (a definir se deve seguir a mesma regra).

## Sugestão de ordem de entrega
Etapas 1+2 primeiro (base sem a qual nada é confiável), depois 3+4 (IA agendando de verdade), depois 5+6 (painel e lembretes).
