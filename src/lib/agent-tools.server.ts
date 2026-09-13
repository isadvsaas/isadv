// BLOCO 2 — Camada central de Tools internas da IA (dispatcher único).
// Todas as ações são executadas SERVER-SIDE e sempre isoladas por company_id.
// A IA nunca informa company_id, agent_id, card_id ou stage_id: o servidor resolve.

export const AGENDA_TOOL_NAMES = [
  "consultar_disponibilidade",
  "criar_agendamento",
  "consultar_agendamento",
  "reagendar_agendamento",
  "cancelar_agendamento",
] as const;

export const TOOL_NAMES = [
  "atualizar_lead",
  "enviar_material",
  "qualificar_lead",
  "mover_pipeline",
  "transferir_humano",
  "finalizar_lead",
  ...AGENDA_TOOL_NAMES,
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type AgendaToolName = (typeof AGENDA_TOOL_NAMES)[number];

export function isAgendaTool(t: string): t is AgendaToolName {
  return (AGENDA_TOOL_NAMES as readonly string[]).includes(t);
}

/** Materiais cadastrados: a tool só entra quando a empresa/agente tem material ativo. */
export function withMaterialTool(list: ToolName[], hasMaterials: boolean): ToolName[] {
  if (!hasMaterials) return list.filter((t) => t !== "enviar_material");
  return list.includes("enviar_material") ? list : [...list, "enviar_material"];
}

export type MaterialRef = {
  id: string;
  nome: string;
  descricao: string;
  tipo: "image" | "audio" | "video" | "document" | "link";
  agent_id: string | null;
};

/** Materiais da empresa (agent_id null) + do agente atual. Nunca de outro agente/empresa. */
export async function loadMaterials(admin: any, companyId: string, agentId: string | null): Promise<MaterialRef[]> {
  const { data } = await admin
    .from("agent_material")
    .select("id, nome, descricao, tipo, agent_id")
    .eq("company_id", companyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });
  return ((data ?? []) as any[])
    .filter((r) => r.agent_id === null || (agentId && r.agent_id === agentId))
    .map((r) => ({ id: r.id, nome: r.nome, descricao: r.descricao || "", tipo: r.tipo, agent_id: r.agent_id ?? null }));
}

/** Padrão: apenas as tools de CRM. As de agenda entram quando o agendamento está ativo. */
export const DEFAULT_ALLOWED_TOOLS: ToolName[] = TOOL_NAMES.filter(
  (t) => !isAgendaTool(t) && t !== "enviar_material",
) as ToolName[];

/**
 * Agenda ativa no agente → habilita as tools de agenda, a menos que o usuário
 * tenha escolhido explicitamente quais tools de agenda quer.
 */
export function withAgendaTools(list: ToolName[], agendamentoAtivo: boolean): ToolName[] {
  if (!agendamentoAtivo) return list.filter((t) => !isAgendaTool(t));
  if (list.some((t) => isAgendaTool(t))) return list;
  return [...list, ...(AGENDA_TOOL_NAMES as readonly ToolName[])];
}


export type FieldType = "string" | "number" | "boolean" | "date" | "datetime" | "select" | "multiselect";

export type CustomFieldDef = {
  key: string;
  label: string;
  description: string;
  field_type: FieldType | string;
  options: any;
  required: boolean;
};

/** Contexto de execução — 100% server-side. */
export type ToolContext = {
  companyId: string;
  userId: string;
  agentId: string | null;
  agentNome?: string;
  numero: string;
  contatoNome?: string | null;
  allowedTools: ToolName[];
  fields: CustomFieldDef[];
  materials?: MaterialRef[];
  jobId?: string | null;
};

export type ToolResult = {
  ok: boolean;
  tool: string;
  error?: string;
  [k: string]: any;
};

/** Formato interno neutro de tool (adaptado por provider). */
export type InternalTool = {
  name: ToolName;
  description: string;
  parameters: Record<string, any>; // JSON Schema simples
};

// ---------------------------------------------------------------- utilidades

export function normalizeToolList(raw: any): ToolName[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out = arr
    .map((t) => String(t || "").trim())
    .filter((t): t is ToolName => (TOOL_NAMES as readonly string[]).includes(t));
  return Array.from(new Set(out));
}

function norm(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function coerceValue(type: string, raw: any, options: any): { ok: boolean; value?: any; error?: string } {
  if (raw === null) return { ok: true, value: null };
  switch (type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) return { ok: false, error: "valor não numérico" };
      return { ok: true, value: n };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      const t = norm(raw);
      if (["true", "sim", "1", "yes", "s"].includes(t)) return { ok: true, value: true };
      if (["false", "nao", "0", "no", "n"].includes(t)) return { ok: true, value: false };
      return { ok: false, error: "valor booleano inválido" };
    }
    case "date":
    case "datetime": {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return { ok: false, error: "data inválida" };
      return { ok: true, value: type === "date" ? d.toISOString().slice(0, 10) : d.toISOString() };
    }
    case "select": {
      const opts: string[] = Array.isArray(options) ? options.map(String) : [];
      if (opts.length && !opts.some((o) => norm(o) === norm(raw))) return { ok: false, error: "opção inválida" };
      return { ok: true, value: String(raw) };
    }
    case "multiselect": {
      const list = Array.isArray(raw) ? raw : String(raw).split(",");
      const opts: string[] = Array.isArray(options) ? options.map(String) : [];
      const vals: string[] = [];
      for (const v of list) {
        const s = String(v).trim();
        if (!s) continue;
        if (opts.length && !opts.some((o) => norm(o) === norm(s))) return { ok: false, error: `opção inválida: ${s}` };
        vals.push(s);
      }
      return { ok: true, value: vals };
    }
    default:
      return { ok: true, value: typeof raw === "string" ? raw : JSON.stringify(raw) };
  }
}

/** Aplica somente os campos DEFINIDOS e autorizados. Campos omitidos não são tocados. */
export function validateCustomData(
  fields: CustomFieldDef[],
  incoming: any,
): { accepted: Record<string, any>; rejected: Array<{ key: string; reason: string }> } {
  const accepted: Record<string, any> = {};
  const rejected: Array<{ key: string; reason: string }> = [];
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return { accepted, rejected };
  const byKey = new Map(fields.map((f) => [norm(f.key), f]));
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue; // omitido = não atualizar
    const def = byKey.get(norm(k));
    if (!def) {
      rejected.push({ key: k, reason: "campo não definido/autorizado para este agente" });
      continue;
    }
    const c = coerceValue(String(def.field_type || "string"), v, def.options);
    if (!c.ok) {
      rejected.push({ key: def.key, reason: c.error || "valor inválido" });
      continue;
    }
    accepted[def.key] = c.value;
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------- carregamento

export async function loadCustomFields(
  admin: any,
  companyId: string,
  agentId: string | null,
): Promise<CustomFieldDef[]> {
  let q = admin
    .from("agent_custom_fields")
    .select("key, label, description, field_type, options, required, agent_id")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const { data } = await q;
  const rows = (data ?? []) as any[];
  // Campos da empresa (agent_id null) + campos do agente atual. Campos de OUTRO agente não entram.
  return rows
    .filter((r) => r.agent_id === null || (agentId && r.agent_id === agentId))
    .map((r) => ({
      key: r.key,
      label: r.label || r.key,
      description: r.description || "",
      field_type: r.field_type || "string",
      options: r.options ?? [],
      required: !!r.required,
    }));
}

// ---------------------------------------------------------------- especificações

export function buildToolSpecs(ctx: ToolContext, stageNames: string[]): InternalTool[] {
  const fieldProps: Record<string, any> = {};
  for (const f of ctx.fields) {
    const t = String(f.field_type);
    fieldProps[f.key] = {
      type: t === "number" ? "number" : t === "boolean" ? "boolean" : t === "multiselect" ? "array" : "string",
      ...(t === "multiselect" ? { items: { type: "string" } } : {}),
      description: [f.label, f.description].filter(Boolean).join(" — ") || f.key,
    };
  }
  const dadosSchema = {
    type: "object",
    description:
      ctx.fields.length
        ? "Campos coletados na conversa. Envie APENAS os campos que você acabou de descobrir; os demais permanecem como estão."
        : "Nenhum campo personalizado configurado para este agente.",
    properties: fieldProps,
    additionalProperties: false,
  };
  const etapas = stageNames.length ? ` Etapas existentes: ${stageNames.join(", ")}.` : "";

  const all: Record<ToolName, InternalTool> = {
    atualizar_lead: {
      name: "atualizar_lead",
      description:
        "Salva no lead as informações coletadas na conversa. Atualização parcial: campos não enviados não são alterados.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do contato, se ele informou." },
          dados: dadosSchema,
        },
      },
    },
    qualificar_lead: {
      name: "qualificar_lead",
      description:
        "Marca o lead como qualificado, movendo-o para a etapa de qualificação do pipeline da empresa." + etapas,
      parameters: {
        type: "object",
        properties: {
          etapa: { type: "string", description: "Nome lógico da etapa de qualificação (ex.: Qualificado)." },
          motivo: { type: "string", description: "Por que o lead está qualificado." },
          dados: dadosSchema,
        },
      },
    },
    mover_pipeline: {
      name: "mover_pipeline",
      description: "Move o lead para outra etapa existente do pipeline da empresa." + etapas,
      parameters: {
        type: "object",
        properties: {
          etapa: { type: "string", description: "Nome da etapa de destino (deve existir)." },
          motivo: { type: "string", description: "Motivo da movimentação." },
        },
        required: ["etapa"],
      },
    },
    transferir_humano: {
      name: "transferir_humano",
      description:
        "Transfere o atendimento para a equipe humana. Salva o resumo, pausa a IA neste contato e registra o handoff. Use quando o cliente pedir humano ou o caso exigir análise.",
      parameters: {
        type: "object",
        properties: {
          resumo_atendimento: { type: "string", description: "Resumo objetivo do que foi coletado até aqui." },
          motivo: { type: "string", description: "Motivo da transferência." },
          dados: dadosSchema,
        },
        required: ["resumo_atendimento"],
      },
    },
    finalizar_lead: {
      name: "finalizar_lead",
      description:
        "Finaliza o atendimento movendo o lead para uma etapa final existente (ganho, perda ou finalizado).",
      parameters: {
        type: "object",
        properties: {
          resultado: { type: "string", description: "ganho | perda | finalizado" },
          resumo: { type: "string", description: "Resumo final do atendimento." },
          motivo: { type: "string", description: "Motivo do encerramento." },
          dados: dadosSchema,
        },
        required: ["resultado"],
      },
    },

    enviar_material: {
      name: "enviar_material",
      description:
        "Envia ao cliente um material JÁ CADASTRADO pela empresa (imagem, áudio, vídeo, documento ou link). Você escolhe apenas o material pelo id da lista de materiais disponíveis. Você NUNCA informa URL, caminho de arquivo nem cria material novo.",
      parameters: {
        type: "object",
        properties: {
          material_id: { type: "string", description: "Id exato do material, retirado da lista de materiais disponíveis." },
          caption: { type: "string", description: "Frase curta opcional para acompanhar o material." },
        },
        required: ["material_id"],
      },
    },

    consultar_disponibilidade: {
      name: "consultar_disponibilidade",
      description:
        "Consulta os horários REALMENTE disponíveis na agenda da empresa. Use SEMPRE antes de oferecer qualquer horário ao cliente. Nunca invente horários.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data inicial desejada no formato AAAA-MM-DD. Omita para começar de hoje." },
          dias: { type: "number", description: "Quantos dias olhar a partir da data (padrão 7)." },
          servico: { type: "string", description: "Nome do serviço desejado, se a empresa tiver mais de um." },
          turno: { type: "string", description: "manha | tarde | noite (opcional)." },
        },
      },
    },
    criar_agendamento: {
      name: "criar_agendamento",
      description:
        "Cria o agendamento do cliente atual em um horário que ele confirmou. O servidor valida a disponibilidade novamente; se estiver ocupado, retorna status conflict com alternativas.",
      parameters: {
        type: "object",
        properties: {
          inicio: { type: "string", description: "Início escolhido, ISO com fuso (ex.: 2026-09-02T15:00:00-03:00)." },
          servico: { type: "string", description: "Nome do serviço, se houver mais de um." },
          titulo: { type: "string", description: "Título curto do compromisso (opcional)." },
          observacoes: { type: "string", description: "Detalhes úteis informados pelo cliente (opcional)." },
        },
        required: ["inicio"],
      },
    },
    consultar_agendamento: {
      name: "consultar_agendamento",
      description: "Lista os agendamentos futuros ativos do cliente atual. Use antes de remarcar ou cancelar.",
      parameters: { type: "object", properties: {} },
    },
    reagendar_agendamento: {
      name: "reagendar_agendamento",
      description:
        "Remarca um agendamento existente do cliente atual para um novo horário. O servidor valida conflito antes de alterar.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string", description: "ID retornado por consultar_agendamento. Omita se o cliente só tem um." },
          novo_inicio: { type: "string", description: "Novo início, ISO com fuso." },
        },
        required: ["novo_inicio"],
      },
    },
    cancelar_agendamento: {
      name: "cancelar_agendamento",
      description: "Cancela um agendamento ativo do cliente atual.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string", description: "ID retornado por consultar_agendamento. Omita se o cliente só tem um." },
          motivo: { type: "string", description: "Motivo informado pelo cliente (opcional)." },
        },
      },
    },
  };


  return ctx.allowedTools.filter((t) => all[t]).map((t) => all[t]!);
}

// ---------------------------------------------------------------- helpers internos

type CardRow = { id: string; nome: string | null; stage_id: string | null; status: string | null; custom_data: any };
type StageRow = { id: string; nome: string; tipo: "normal" | "ganho" | "perda" };

async function resolveCard(admin: any, ctx: ToolContext): Promise<CardRow | null> {
  const { data } = await admin
    .from("crm_cards")
    .select("id, nome, stage_id, status, custom_data")
    .eq("company_id", ctx.companyId) // isolamento obrigatório
    .eq("numero", ctx.numero)
    .maybeSingle();
  if (data) return data as CardRow;

  // Cria o card mínimo do contato atual (nunca de outra conversa/empresa).
  const { data: firstStage } = await admin
    .from("crm_stage")
    .select("id, nome")
    .eq("company_id", ctx.companyId)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: created } = await admin
    .from("crm_cards")
    .insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      numero: ctx.numero,
      nome: ctx.contatoNome ?? null,
      status: firstStage?.nome ?? "Conversas",
      stage_id: firstStage?.id ?? null,
      ultima_em: new Date().toISOString(),
    })
    .select("id, nome, stage_id, status, custom_data")
    .maybeSingle();
  return (created as CardRow) ?? null;
}

async function loadStages(admin: any, companyId: string): Promise<StageRow[]> {
  const { data } = await admin
    .from("crm_stage")
    .select("id, nome, tipo, ordem")
    .eq("company_id", companyId) // nunca stage de outra company
    .order("ordem", { ascending: true });
  return (data ?? []) as StageRow[];
}

function findStage(stages: StageRow[], wanted: string): StageRow | null {
  const w = norm(wanted);
  if (!w) return null;
  return (
    stages.find((s) => norm(s.nome) === w) ??
    stages.find((s) => norm(s.nome).includes(w) || w.includes(norm(s.nome))) ??
    null
  );
}

async function logEvent(
  admin: any,
  ctx: ToolContext,
  cardId: string,
  tipo: string,
  descricao: string,
  metadata: Record<string, any>,
) {
  try {
    await admin.from("lead_evento").insert({
      company_id: ctx.companyId,
      card_id: cardId,
      agent_id: ctx.agentId,
      tipo,
      descricao: descricao.slice(0, 500),
      metadata,
    });
  } catch (e: any) {
    console.error("[tool.evento]", e?.message);
  }
}

async function mergeCustomData(
  admin: any,
  ctx: ToolContext,
  card: CardRow,
  incoming: any,
): Promise<{ accepted: Record<string, any>; rejected: Array<{ key: string; reason: string }>; custom_data: any }> {
  const { accepted, rejected } = validateCustomData(ctx.fields, incoming);
  const current = card.custom_data && typeof card.custom_data === "object" ? card.custom_data : {};
  if (Object.keys(accepted).length === 0) return { accepted, rejected, custom_data: current };
  const merged = { ...current, ...accepted }; // false/0/"" são preservados
  await admin
    .from("crm_cards")
    .update({ custom_data: merged })
    .eq("id", card.id)
    .eq("company_id", ctx.companyId);
  card.custom_data = merged;
  return { accepted, rejected, custom_data: merged };
}

async function moveCard(
  admin: any,
  ctx: ToolContext,
  card: CardRow,
  stage: StageRow,
  tipoEvento: string,
  motivo: string,
) {
  await admin
    .from("crm_cards")
    .update({ stage_id: stage.id, status: stage.nome })
    .eq("id", card.id)
    .eq("company_id", ctx.companyId);
  await logEvent(admin, ctx, card.id, tipoEvento, `${tipoEvento}: ${stage.nome}${motivo ? ` — ${motivo}` : ""}`, {
    stage_id: stage.id,
    stage_nome: stage.nome,
    stage_tipo: stage.tipo,
    de_stage_id: card.stage_id,
    motivo: motivo || null,
    agent_id: ctx.agentId,
  });
  card.stage_id = stage.id;
  card.status = stage.nome;
}

// ---------------------------------------------------------------- dispatcher

export async function executeTool(
  admin: any,
  ctx: ToolContext,
  name: string,
  rawArgs: any,
): Promise<ToolResult> {
  const tool = String(name || "").trim() as ToolName;
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};

  if (!(TOOL_NAMES as readonly string[]).includes(tool)) {
    return { ok: false, tool, error: "Ação desconhecida." };
  }
  // Permissão: só o que está em allowed_tools do agente ATUAL (resolvido no servidor).
  if (!ctx.allowedTools.includes(tool)) {
    return { ok: false, tool, error: "Ação não autorizada para este agente." };
  }

  const card = await resolveCard(admin, ctx);
  if (!card) return { ok: false, tool, error: "Não foi possível localizar o lead deste contato." };

  try {
    switch (tool) {
      case "atualizar_lead": {
        const r = await mergeCustomData(admin, ctx, card, args.dados ?? args.custom_data ?? {});
        const nome = typeof args.nome === "string" ? args.nome.trim() : "";
        if (nome && nome !== card.nome) {
          await admin.from("crm_cards").update({ nome }).eq("id", card.id).eq("company_id", ctx.companyId);
          card.nome = nome;
        }
        const changed = Object.keys(r.accepted);
        if (changed.length || nome) {
          await logEvent(admin, ctx, card.id, "dados_atualizados", `Dados atualizados: ${[...changed, nome ? "nome" : ""].filter(Boolean).join(", ")}`, {
            campos: r.accepted,
            nome: nome || null,
            rejeitados: r.rejected,
          });
        }
        return {
          ok: r.rejected.length === 0,
          tool,
          campos_salvos: changed,
          campos_rejeitados: r.rejected,
          dados_atuais: r.custom_data,
          ...(r.rejected.length ? { error: `Campos não autorizados/inválidos: ${r.rejected.map((x) => x.key).join(", ")}` } : {}),
        };
      }

      case "qualificar_lead": {
        const r = await mergeCustomData(admin, ctx, card, args.dados ?? {});
        const stages = await loadStages(admin, ctx.companyId);
        const wanted = String(args.etapa || "Qualificado");
        const stage = findStage(stages, wanted) ?? findStage(stages, "qualificado") ?? findStage(stages, "negociando");
        if (!stage) {
          return {
            ok: false,
            tool,
            error: `Nenhuma etapa de qualificação encontrada nesta empresa. Etapas disponíveis: ${stages.map((s) => s.nome).join(", ") || "nenhuma"}.`,
            campos_salvos: Object.keys(r.accepted),
          };
        }
        await moveCard(admin, ctx, card, stage, "qualificacao", String(args.motivo || ""));
        return { ok: true, tool, etapa: stage.nome, campos_salvos: Object.keys(r.accepted), campos_rejeitados: r.rejected };
      }

      case "mover_pipeline": {
        const stages = await loadStages(admin, ctx.companyId);
        const stage = findStage(stages, String(args.etapa || ""));
        if (!stage) {
          return {
            ok: false,
            tool,
            error: `Etapa "${args.etapa ?? ""}" não existe nesta empresa. Etapas disponíveis: ${stages.map((s) => s.nome).join(", ") || "nenhuma"}.`,
          };
        }
        await moveCard(admin, ctx, card, stage, "pipeline", String(args.motivo || ""));
        return { ok: true, tool, etapa: stage.nome };
      }

      case "transferir_humano": {
        const resumo = String(args.resumo_atendimento || args.resumo || "").trim();
        // 1 + 2) persiste resumo e dados relevantes
        const r = await mergeCustomData(admin, ctx, card, args.dados ?? {});
        const current = card.custom_data && typeof card.custom_data === "object" ? card.custom_data : {};
        const merged = { ...current, ...(resumo ? { resumo_atendimento: resumo } : {}), handoff_em: new Date().toISOString() };
        await admin
          .from("crm_cards")
          .update({ custom_data: merged, observacao: resumo ? resumo.slice(0, 1000) : null, proxima_acao: "Atendimento humano" })
          .eq("id", card.id)
          .eq("company_id", ctx.companyId);
        card.custom_data = merged;

        // 3 + 4) move para etapa humana se existir; senão mantém a etapa atual
        const stages = await loadStages(admin, ctx.companyId);
        const humanStage =
          findStage(stages, "atendimento humano") ??
          findStage(stages, "humano") ??
          findStage(stages, "atendimento") ??
          null;
        if (humanStage && humanStage.id !== card.stage_id) {
          await moveCard(admin, ctx, card, humanStage, "pipeline", "transferência para humano");
        }

        // 5 + 6) pausa a IA usando o mecanismo existente
        await admin
          .from("contact_pause")
          .upsert(
            { company_id: ctx.companyId, user_id: ctx.userId, numero: ctx.numero, pausado: true },
            { onConflict: "company_id,numero" },
          );

        // BLOCO 3) atendimento humano: cancela follow-ups pendentes deste contato
        try {
          const { cancelFollowups } = await import("./followup.server");
          await cancelFollowups(admin, ctx.companyId, ctx.numero, "transferido para humano", { logCardId: card.id, agentId: ctx.agentId });
        } catch (e: any) {
          console.error("[followup.cancel]", e?.message);
        }


        // 9) evento de transferência
        await logEvent(admin, ctx, card.id, "transferencia_humano", `Transferido para humano${args.motivo ? ` — ${args.motivo}` : ""}`, {
          resumo: resumo || null,
          motivo: args.motivo ?? null,
          etapa: humanStage?.nome ?? card.status,
          campos: r.accepted,
          agent_id: ctx.agentId,
        });

        return {
          ok: true,
          tool,
          pausado: true,
          etapa: humanStage?.nome ?? card.status,
          resumo_salvo: !!resumo,
          instrucao:
            "Avise o cliente, com naturalidade, que o atendimento foi encaminhado para a equipe e que as informações já ficaram registradas. Não invente telefone, nome de atendente nem prazo de retorno.",
        };
      }

      case "finalizar_lead": {
        const r = await mergeCustomData(admin, ctx, card, args.dados ?? {});
        const resumo = String(args.resumo || "").trim();
        if (resumo) {
          const current = card.custom_data && typeof card.custom_data === "object" ? card.custom_data : {};
          const merged = { ...current, resumo_atendimento: resumo, finalizado_em: new Date().toISOString() };
          await admin.from("crm_cards").update({ custom_data: merged }).eq("id", card.id).eq("company_id", ctx.companyId);
          card.custom_data = merged;
        }
        const resultado = norm(args.resultado || "finalizado");
        const stages = await loadStages(admin, ctx.companyId);
        let stage: StageRow | null = null;
        if (resultado.includes("ganho") || resultado.includes("venda") || resultado.includes("fechad")) {
          stage = stages.find((s) => s.tipo === "ganho") ?? findStage(stages, "ganho");
        } else if (resultado.includes("perda") || resultado.includes("perdid") || resultado.includes("recus")) {
          stage = stages.find((s) => s.tipo === "perda") ?? findStage(stages, "perda");
        } else {
          stage =
            findStage(stages, "finalizado") ??
            findStage(stages, String(args.resultado || "")) ??
            stages.find((s) => s.tipo === "ganho") ??
            null;
        }
        if (!stage) {
          return {
            ok: false,
            tool,
            error: `Nenhuma etapa final encontrada nesta empresa. Etapas disponíveis: ${stages.map((s) => s.nome).join(", ") || "nenhuma"}.`,
            campos_salvos: Object.keys(r.accepted),
          };
        }
        await admin
          .from("crm_cards")
          .update({ stage_id: stage.id, status: stage.nome, proxima_acao: null, follow_up: null })
          .eq("id", card.id)
          .eq("company_id", ctx.companyId);
        await logEvent(admin, ctx, card.id, "finalizacao", `Atendimento finalizado em ${stage.nome}${args.motivo ? ` — ${args.motivo}` : ""}`, {
          stage_id: stage.id,
          stage_nome: stage.nome,
          stage_tipo: stage.tipo,
          resultado: String(args.resultado || "finalizado"),
          motivo: args.motivo ?? null,
          resumo: resumo || null,
          encerrado: true, // evita automações futuras indevidas
          agent_id: ctx.agentId,
        });
        card.stage_id = stage.id;
        card.status = stage.nome;
        // BLOCO 3) lead finalizado: nenhuma nova mensagem automática
        try {
          const { cancelFollowups } = await import("./followup.server");
          await cancelFollowups(admin, ctx.companyId, ctx.numero, "lead finalizado", { logCardId: card.id, agentId: ctx.agentId });
        } catch (e: any) {
          console.error("[followup.cancel]", e?.message);
        }
        return { ok: true, tool, etapa: stage.nome, campos_salvos: Object.keys(r.accepted), campos_rejeitados: r.rejected };
      }

      // ------------------------------------------------------------ MATERIAIS
      case "enviar_material": {
        const materialId = String(args.material_id || "").trim();
        if (!materialId) return { ok: false, tool, error: "Informe o material_id de um material da lista." };
        const permitido = (ctx.materials ?? []).some((m) => m.id === materialId);
        if (!permitido) {
          return {
            ok: false,
            tool,
            error: "Material não disponível para este atendente. Use apenas os materiais listados.",
            materiais_disponiveis: (ctx.materials ?? []).map((m) => ({ id: m.id, nome: m.nome })),
          };
        }
        const { data: mat } = await admin
          .from("agent_material")
          .select("id, nome, tipo, storage_path, external_url, mime_type, file_name, ativo, agent_id")
          .eq("id", materialId)
          .eq("company_id", ctx.companyId) // isolamento entre empresas
          .maybeSingle();
        if (!mat || !(mat as any).ativo) return { ok: false, tool, error: "Material indisponível." };
        if ((mat as any).agent_id && (mat as any).agent_id !== ctx.agentId) {
          return { ok: false, tool, error: "Material exclusivo de outro atendente." };
        }
        const m = mat as any;
        if (m.tipo !== "link" && !m.storage_path) return { ok: false, tool, error: "O arquivo deste material não está disponível." };

        try {
          const { sendOutbound } = await import("./outbound-message.server");
          const idem = `mat:${ctx.jobId || ctx.numero}:${materialId}`;
          const r = await sendOutbound(admin, {
            companyId: ctx.companyId,
            userId: ctx.userId,
            contactId: ctx.numero,
            contatoNome: ctx.contatoNome ?? null,
            senderType: "ai",
            agentId: ctx.agentId,
            kind: m.tipo,
            texto: m.tipo === "link" ? m.external_url : null,
            caption: typeof args.caption === "string" ? args.caption.slice(0, 300) : null,
            media: m.tipo === "link" ? null : { storagePath: m.storage_path, mimeType: m.mime_type, fileName: m.file_name },
            idempotencyKey: idem,
            materialId,
          });
          await logEvent(admin, ctx, card.id, "material_enviado", `Material enviado: ${m.nome}`, {
            material_id: materialId,
            tipo: m.tipo,
            provider_message_id: r.providerMessageId,
            duplicado: r.duplicate,
            agent_id: ctx.agentId,
          });
          return {
            ok: true,
            tool,
            material_id: materialId,
            nome: m.nome,
            tipo: m.tipo,
            provider_message_id: r.providerMessageId,
            ja_enviado: r.duplicate,
            instrucao: "Material entregue. Agora sim você pode comentar com o cliente que enviou.",
          };
        } catch (e: any) {
          console.error("[tool.material]", e?.message);
          return { ok: false, tool, material_id: materialId, error: `Não foi possível enviar o material: ${e?.message ?? e}` };
        }
      }

      // ------------------------------------------------------------ AGENDA
      case "consultar_disponibilidade": {
        const { computeAvailability } = await import("./scheduling.server");
        const r = await computeAvailability(admin, ctx.companyId, {
          dateFrom: typeof args.data === "string" ? args.data : null,
          days: Number(args.dias) || 7,
          servicoNome: typeof args.servico === "string" ? args.servico : null,
          turno: typeof args.turno === "string" ? args.turno : null,
          limit: 12,
        });
        if (!r.slots.length) {
          return {
            ok: true,
            tool,
            timezone: r.timezone,
            horarios: [],
            instrucao:
              "Não há horário livre no período consultado. Pergunte ao cliente outra data/período e consulte novamente. NUNCA ofereça um horário que não veio desta lista.",
          };
        }
        return {
          ok: true,
          tool,
          timezone: r.timezone,
          servico: r.service?.nome ?? null,
          duracao_min: r.service?.duracao_min ?? null,
          horarios: r.slots.map((s) => ({ inicio: s.inicio, fim: s.fim, quando: s.label })),
          instrucao: "Ofereça no máximo 3 opções desta lista, em linguagem natural. Nunca ofereça horário fora da lista.",
        };
      }

      case "criar_agendamento": {
        const { createAgendamento } = await import("./scheduling.server");
        const r = await createAgendamento(admin, {
          companyId: ctx.companyId,
          inicio: String(args.inicio || ""),
          titulo: typeof args.titulo === "string" ? args.titulo : null,
          servicoNome: typeof args.servico === "string" ? args.servico : null,
          cardId: card.id,
          numero: ctx.numero,
          observacoes: typeof args.observacoes === "string" ? args.observacoes : null,
          criadoPor: "ia",
        });
        if (r.status === "conflict") {
          return {
            ok: false,
            tool,
            status: "conflict",
            message: r.message,
            alternatives: r.alternatives.map((s) => ({ inicio: s.inicio, quando: s.label })),
            instrucao: "Explique ao cliente que esse horário não está mais livre e ofereça as alternativas retornadas.",
          };
        }
        if (r.status === "error") return { ok: false, tool, status: "error", error: r.message };

        const { formatSlotLabel } = await import("./scheduling.server");
        const quando = formatSlotLabel(new Date(r.agendamento.inicio), r.timezone);
        await logEvent(admin, ctx, card.id, "agendamento_criado", `Agendamento criado: ${r.agendamento.titulo} — ${quando}`, {
          agendamento_id: r.agendamento.id,
          inicio: r.agendamento.inicio,
          fim: r.agendamento.fim,
          google: r.googleSynced,
          agent_id: ctx.agentId,
        });
        return {
          ok: true,
          tool,
          status: "created",
          agendamento_id: r.agendamento.id,
          inicio: r.agendamento.inicio,
          quando,
          google_sincronizado: r.googleSynced,
          instrucao: "Confirme o agendamento com o cliente usando o horário retornado. Não invente endereço nem instruções extras.",
        };
      }

      case "consultar_agendamento": {
        const { findAgendamentosDoContato, getAgendaContext, formatSlotLabel } = await import("./scheduling.server");
        const ctxAg = await getAgendaContext(admin, ctx.companyId);
        const rows = await findAgendamentosDoContato(admin, ctx.companyId, ctx.numero, card.id);
        return {
          ok: true,
          tool,
          total: rows.length,
          agendamentos: rows.map((a) => ({
            agendamento_id: a.id,
            titulo: a.titulo,
            inicio: a.inicio,
            quando: formatSlotLabel(new Date(a.inicio), ctxAg.timezone),
          })),
          ...(rows.length ? {} : { instrucao: "O cliente não tem agendamento futuro ativo. Não invente um." }),
        };
      }

      case "reagendar_agendamento": {
        const { findAgendamentosDoContato, reagendarAgendamento, formatSlotLabel } = await import("./scheduling.server");
        const rows = await findAgendamentosDoContato(admin, ctx.companyId, ctx.numero, card.id);
        if (!rows.length) return { ok: false, tool, error: "Este cliente não tem agendamento futuro ativo." };
        const alvo = args.agendamento_id ? rows.find((a) => a.id === String(args.agendamento_id)) : rows[0];
        if (!alvo) return { ok: false, tool, error: "Agendamento não encontrado para este cliente." };

        const r = await reagendarAgendamento(admin, {
          companyId: ctx.companyId,
          id: alvo.id,
          inicio: String(args.novo_inicio || ""),
        });
        if (r.status === "conflict") {
          return {
            ok: false,
            tool,
            status: "conflict",
            message: r.message,
            alternatives: r.alternatives.map((s) => ({ inicio: s.inicio, quando: s.label })),
            instrucao: "Ofereça as alternativas retornadas ao cliente.",
          };
        }
        if (r.status === "error") return { ok: false, tool, status: "error", error: r.message };
        const quando = formatSlotLabel(new Date(r.agendamento.inicio), r.timezone);
        await logEvent(admin, ctx, card.id, "agendamento_remarcado", `Agendamento remarcado para ${quando}`, {
          agendamento_id: r.agendamento.id,
          inicio: r.agendamento.inicio,
          google: r.googleSynced,
          agent_id: ctx.agentId,
        });
        return { ok: true, tool, status: "rescheduled", agendamento_id: r.agendamento.id, inicio: r.agendamento.inicio, quando };
      }

      case "cancelar_agendamento": {
        const { findAgendamentosDoContato, cancelarAgendamento, getAgendaContext, formatSlotLabel } = await import("./scheduling.server");
        const rows = await findAgendamentosDoContato(admin, ctx.companyId, ctx.numero, card.id);
        if (!rows.length) return { ok: false, tool, error: "Este cliente não tem agendamento futuro ativo." };
        const alvo = args.agendamento_id ? rows.find((a) => a.id === String(args.agendamento_id)) : rows[0];
        if (!alvo) return { ok: false, tool, error: "Agendamento não encontrado para este cliente." };

        const r = await cancelarAgendamento(admin, {
          companyId: ctx.companyId,
          id: alvo.id,
          motivo: typeof args.motivo === "string" ? args.motivo : null,
        });
        if (!r.ok) return { ok: false, tool, error: r.message };
        const ctxAg = await getAgendaContext(admin, ctx.companyId);
        await logEvent(admin, ctx, card.id, "agendamento_cancelado", `Agendamento cancelado: ${alvo.titulo}`, {
          agendamento_id: alvo.id,
          inicio: alvo.inicio,
          motivo: args.motivo ?? null,
          agent_id: ctx.agentId,
        });
        return {
          ok: true,
          tool,
          status: "cancelled",
          agendamento_id: alvo.id,
          quando: formatSlotLabel(new Date(alvo.inicio), ctxAg.timezone),
        };
      }
    }

  } catch (e: any) {
    console.error("[tool]", tool, e?.message);
    return { ok: false, tool, error: "Falha ao executar a ação." };
  }
  return { ok: false, tool, error: "Ação não implementada." };
}

/** Bloco de prompt (extra) explicando as Tools e os campos a coletar. */
export function buildToolsPromptBlock(ctx: ToolContext, dadosAtuais: Record<string, any> | null): string {
  if (!ctx.allowedTools.length && !ctx.fields.length && !(ctx.materials ?? []).length) return "";
  const linhas: string[] = ["AÇÕES INTERNAS (tools) — use as funções disponíveis, nunca escreva o nome delas na conversa."];
  if (ctx.allowedTools.includes("atualizar_lead"))
    linhas.push("• atualizar_lead: sempre que o cliente informar um dado novo, salve-o (envie apenas os campos novos).");
  if (ctx.allowedTools.includes("qualificar_lead"))
    linhas.push("• qualificar_lead: quando o cliente atender aos critérios de interesse/perfil.");
  if (ctx.allowedTools.includes("mover_pipeline"))
    linhas.push("• mover_pipeline: quando a conversa avançar para outra etapa existente do pipeline.");
  if (ctx.allowedTools.includes("transferir_humano"))
    linhas.push(
      "• transferir_humano: quando o cliente pedir uma pessoa ou o caso exigir análise humana. Depois do sucesso, avise o cliente com naturalidade. NUNCA invente telefone, nome de atendente ou prazo de retorno, e nunca repita o número do próprio cliente.",
    );
  if (ctx.allowedTools.includes("finalizar_lead"))
    linhas.push("• finalizar_lead: quando o atendimento chegar a um desfecho (ganho, perda ou finalizado).");
  if (ctx.allowedTools.includes("enviar_material") && (ctx.materials ?? []).length) {
    linhas.push(
      "",
      "MATERIAIS DISPONÍVEIS (envie com a tool enviar_material, usando o id exato):",
      ...(ctx.materials ?? []).map(
        (m) => `• id: ${m.id} — ${m.nome} (${m.tipo})${m.descricao ? `\n  Quando usar: ${m.descricao}` : ""}`,
      ),
      "REGRAS DE MATERIAL:",
      "• Envie material somente quando fizer sentido para a conversa; nunca dispare arquivos sem motivo.",
      "• Nunca envie vários materiais de uma vez sem necessidade e não reenvie o mesmo material.",
      "• Nunca invente material, link ou arquivo que não esteja nesta lista, e nunca escreva URL de arquivo.",
      "• Só afirme que enviou DEPOIS de a tool retornar sucesso.",
    );
  }
  if (ctx.allowedTools.some((t) => isAgendaTool(t))) {
    linhas.push(
      "",
      "AGENDA (regras obrigatórias):",
      "• NUNCA invente, suponha ou ofereça horário: chame consultar_disponibilidade antes de qualquer proposta de horário.",
      "• Ofereça no máximo 3 opções, sempre vindas da lista retornada pela tool.",
      "• Só chame criar_agendamento quando o cliente confirmar claramente um horário oferecido.",
      "• Se a resposta vier com status conflict, explique que o horário foi ocupado e ofereça as alternativas retornadas.",
      "• Para mudar ou desmarcar, use consultar_agendamento primeiro e depois reagendar_agendamento ou cancelar_agendamento.",
    );
  }


  if (ctx.fields.length) {
    linhas.push(
      "",
      "CAMPOS A COLETAR (salve com as tools; um dado por vez, de forma natural):",
      ...ctx.fields.map(
        (f) =>
          `• ${f.key} (${f.field_type}${f.required ? ", obrigatório" : ""}): ${[f.label, f.description].filter(Boolean).join(" — ")}`,
      ),
    );
    const atuais = dadosAtuais && typeof dadosAtuais === "object" ? dadosAtuais : {};
    const conhecidos = ctx.fields
      .filter((f) => Object.prototype.hasOwnProperty.call(atuais, f.key) && atuais[f.key] !== null)
      .map((f) => `${f.key}=${JSON.stringify(atuais[f.key])}`);
    linhas.push(
      conhecidos.length
        ? `JÁ COLETADO (não pergunte de novo): ${conhecidos.join(", ")}`
        : "JÁ COLETADO: nada ainda.",
    );
  }
  return linhas.join("\n");
}
