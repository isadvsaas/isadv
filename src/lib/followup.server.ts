// BLOCO 3 — Motor de follow-up automático configurável por empresa/agente.
// Nada de tempos fixos: toda cadência vem de followup_sequence + followup_step.
// Delay é SEMPRE relativo à etapa anterior (a 1ª etapa é relativa à última interação).

export type DelayUnit = "minutes" | "hours" | "days";

export type SequenceRow = {
  id: string;
  company_id: string;
  agent_id: string | null;
  nome: string;
  ativo: boolean;
  eligible_stage_ids: string[] | null;
  timezone: string;
  allowed_start_time: string;
  allowed_end_time: string;
  final_action: "none" | "finalize" | "move_stage" | "stop";
  final_stage_id: string | null;
  restart_on_reply: boolean;
};

export type StepRow = {
  id: string;
  sequence_id: string;
  company_id: string;
  ordem: number;
  delay_value: number;
  delay_unit: DelayUnit;
  message_mode: "template" | "ai" | "none";
  message_template: string;
  move_stage_id: string | null;
  finalize: boolean;
  active: boolean;
};

export type StateRow = {
  id: string;
  company_id: string;
  sequence_id: string;
  card_id: string | null;
  numero: string;
  agent_id: string | null;
  current_step: number;
  anchor_at: string;
  next_run_at: string | null;
  status: string;
  attempts: number;
  last_sent_at: string | null;
};

// ------------------------------------------------------------------ tempo

export function addDelay(from: Date, value: number, unit: DelayUnit): Date {
  const v = Math.max(1, Math.floor(Number(value) || 1));
  const ms = unit === "days" ? 86_400_000 : unit === "hours" ? 3_600_000 : 60_000;
  return new Date(from.getTime() + v * ms);
}

function hhmmToMin(s: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s || "")) ;
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function zonedMinuteOfDay(d: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    const parts = fmt.formatToParts(d);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mi = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return (h % 24) * 60 + mi;
  } catch {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

/** Reagenda para dentro da janela permitida da sequência (nunca de madrugada). */
export function shiftToAllowedWindow(when: Date, seq: Pick<SequenceRow, "timezone" | "allowed_start_time" | "allowed_end_time">): Date {
  const startM = hhmmToMin(seq.allowed_start_time);
  const endM = hhmmToMin(seq.allowed_end_time);
  if (startM === endM) return when; // janela 24h
  const tz = seq.timezone || "America/Sao_Paulo";
  const m = zonedMinuteOfDay(when, tz);
  if (startM < endM) {
    if (m < startM) return new Date(when.getTime() + (startM - m) * 60_000);
    if (m >= endM) return new Date(when.getTime() + (1440 - m + startM) * 60_000);
    return when;
  }
  // janela cruzando a meia-noite (ex.: 20:00 → 06:00)
  if (m >= startM || m < endM) return when;
  return new Date(when.getTime() + (startM - m) * 60_000);
}

// ------------------------------------------------------------------ leitura

export async function loadSequenceForAgent(
  admin: any,
  companyId: string,
  agentId: string | null,
): Promise<{ seq: SequenceRow; steps: StepRow[] } | null> {
  const { data } = await admin
    .from("followup_sequence")
    .select("*")
    .eq("company_id", companyId)
    .eq("ativo", true);
  const rows = (data ?? []) as SequenceRow[];
  if (!rows.length) return null;
  const seq = (agentId ? rows.find((r) => r.agent_id === agentId) : null) ?? rows.find((r) => r.agent_id === null) ?? null;
  if (!seq) return null;
  const steps = await loadSteps(admin, seq);
  if (!steps.length) return null;
  return { seq, steps };
}

export async function loadSteps(admin: any, seq: SequenceRow): Promise<StepRow[]> {
  const { data } = await admin
    .from("followup_step")
    .select("*")
    .eq("sequence_id", seq.id)
    .eq("company_id", seq.company_id)
    .eq("active", true)
    .order("ordem", { ascending: true });
  return (data ?? []) as StepRow[];
}

async function logEvent(admin: any, companyId: string, cardId: string | null, agentId: string | null, tipo: string, descricao: string, metadata: any) {
  if (!cardId) return;
  try {
    await admin.from("lead_evento").insert({
      company_id: companyId,
      card_id: cardId,
      agent_id: agentId,
      tipo,
      descricao: descricao.slice(0, 500),
      metadata: metadata ?? {},
    });
  } catch (e: any) {
    console.error("[followup.evento]", e?.message);
  }
}

// ------------------------------------------------------------------ cancelamento

/** Cancela follow-ups pendentes do contato (resposta do cliente, handoff, finalização, opt-out...). */
export async function cancelFollowups(
  admin: any,
  companyId: string,
  numero: string,
  motivo: string,
  opts: { logCardId?: string | null; agentId?: string | null } = {},
): Promise<number> {
  const { data } = await admin
    .from("followup_state")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), next_run_at: null, last_error: motivo })
    .eq("company_id", companyId)
    .eq("numero", numero)
    .in("status", ["pending", "processing"])
    .select("id, card_id, agent_id, current_step");
  const rows = (data ?? []) as any[];
  for (const r of rows) {
    await logEvent(admin, companyId, r.card_id ?? opts.logCardId ?? null, r.agent_id ?? opts.agentId ?? null, "followup_cancelado", `Follow-up cancelado — ${motivo}`, {
      motivo,
      etapa_atual: r.current_step,
    });
  }
  return rows.length;
}

// ------------------------------------------------------------------ agendamento

function stageEligible(seq: SequenceRow, stageId: string | null): boolean {
  const list = Array.isArray(seq.eligible_stage_ids) ? seq.eligible_stage_ids.filter(Boolean) : [];
  if (!list.length) return true; // vazio = todas as etapas da própria company
  return !!stageId && list.includes(stageId);
}

/**
 * (Re)agenda a cadência a partir da interação atual. Chamado após o agente responder.
 * Determinístico: cancela o estado pendente e cria um único novo estado no step 0.
 */
export async function scheduleFollowup(
  admin: any,
  params: {
    companyId: string;
    numero: string;
    agentId: string | null;
    cardId?: string | null;
    stageId?: string | null;
    anchorAt?: Date;
  },
): Promise<{ scheduled: boolean; reason?: string; nextRunAt?: string }> {
  try {
    const loaded = await loadSequenceForAgent(admin, params.companyId, params.agentId);
    if (!loaded) return { scheduled: false, reason: "sem sequência ativa" };
    const { seq, steps } = loaded;

    // Estado do lead (etapa elegível / não finalizado)
    const { data: card } = await admin
      .from("crm_cards")
      .select("id, stage_id, status")
      .eq("company_id", params.companyId)
      .eq("numero", params.numero)
      .maybeSingle();
    const cardId = params.cardId ?? card?.id ?? null;
    const stageId = params.stageId ?? card?.stage_id ?? null;
    if (!stageEligible(seq, stageId)) {
      await cancelFollowups(admin, params.companyId, params.numero, "etapa não elegível");
      return { scheduled: false, reason: "etapa não elegível" };
    }
    if (stageId) {
      const { data: st } = await admin
        .from("crm_stage")
        .select("tipo")
        .eq("company_id", params.companyId)
        .eq("id", stageId)
        .maybeSingle();
      if (st?.tipo === "ganho" || st?.tipo === "perda") return { scheduled: false, reason: "lead finalizado" };
    }

    // Pausa/atendimento humano
    const { data: pause } = await admin
      .from("contact_pause")
      .select("pausado")
      .eq("company_id", params.companyId)
      .eq("numero", params.numero)
      .maybeSingle();
    if (pause?.pausado) {
      await cancelFollowups(admin, params.companyId, params.numero, "atendimento humano/pausado");
      return { scheduled: false, reason: "pausado" };
    }

    const first = steps[0]!;
    const anchor = params.anchorAt ?? new Date();
    const nextRun = shiftToAllowedWindow(addDelay(anchor, first.delay_value, first.delay_unit), seq);

    // Um único estado ativo por (company, numero, sequência)
    await admin
      .from("followup_state")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), next_run_at: null, last_error: "reagendado por nova interação" })
      .eq("company_id", params.companyId)
      .eq("numero", params.numero)
      .eq("sequence_id", seq.id)
      .in("status", ["pending", "processing"]);

    const { error } = await admin.from("followup_state").insert({
      company_id: params.companyId,
      sequence_id: seq.id,
      card_id: cardId,
      numero: params.numero,
      agent_id: params.agentId,
      current_step: 0,
      anchor_at: anchor.toISOString(),
      next_run_at: nextRun.toISOString(),
      status: "pending",
    });
    if (error) {
      console.error("[followup.schedule]", error.message);
      return { scheduled: false, reason: error.message };
    }
    await logEvent(admin, params.companyId, cardId, params.agentId, "followup_agendado", `Follow-up agendado (${seq.nome})`, {
      sequence_id: seq.id,
      next_run_at: nextRun.toISOString(),
      etapa: 1,
    });
    return { scheduled: true, nextRunAt: nextRun.toISOString() };
  } catch (e: any) {
    console.error("[followup.schedule]", e?.message);
    return { scheduled: false, reason: e?.message };
  }
}

// ------------------------------------------------------------------ execução

async function finishState(admin: any, state: StateRow, status: "completed" | "cancelled" | "error", extra: Record<string, any> = {}) {
  const now = new Date().toISOString();
  await admin
    .from("followup_state")
    .update({
      status,
      next_run_at: null,
      ...(status === "completed" ? { completed_at: now } : {}),
      ...(status === "cancelled" ? { cancelled_at: now } : {}),
      ...extra,
    })
    .eq("id", state.id);
}

async function applyFinalAction(admin: any, seq: SequenceRow, state: StateRow) {
  if (seq.final_action === "none" || seq.final_action === "stop") return;
  const { data: card } = await admin
    .from("crm_cards")
    .select("id, stage_id")
    .eq("company_id", seq.company_id)
    .eq("numero", state.numero)
    .maybeSingle();
  if (!card) return;

  let stageId: string | null = null;
  let stageNome: string | null = null;
  if (seq.final_action === "move_stage" && seq.final_stage_id) {
    const { data: st } = await admin
      .from("crm_stage")
      .select("id, nome")
      .eq("company_id", seq.company_id) // nunca stage de outra company
      .eq("id", seq.final_stage_id)
      .maybeSingle();
    if (st) { stageId = st.id; stageNome = st.nome; }
  } else if (seq.final_action === "finalize") {
    const { data: st } = await admin
      .from("crm_stage")
      .select("id, nome, tipo, ordem")
      .eq("company_id", seq.company_id)
      .eq("tipo", "perda")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (st) { stageId = st.id; stageNome = st.nome; }
  }
  if (!stageId) return; // stage apagada: não quebra o motor
  await admin
    .from("crm_cards")
    .update({ stage_id: stageId, status: stageNome, proxima_acao: null })
    .eq("id", card.id)
    .eq("company_id", seq.company_id);
  await logEvent(admin, seq.company_id, card.id, state.agent_id, "followup_stage", `Follow-up moveu o lead para ${stageNome}`, {
    sequence_id: seq.id,
    final_action: seq.final_action,
    stage_id: stageId,
  });
}

type Guard = { ok: boolean; reason?: string; hard?: boolean };

async function revalidate(admin: any, seq: SequenceRow, state: StateRow): Promise<Guard & { cardId: string | null; instanceName?: string; target?: any }> {
  // sequência desativada
  if (!seq.ativo) return { ok: false, reason: "sequência desativada", hard: true, cardId: state.card_id };

  // agente desativado → sem regra segura de troca: cancela
  if (state.agent_id) {
    const { data: ag } = await admin
      .from("agent_config")
      .select("id, ativo")
      .eq("company_id", seq.company_id)
      .eq("id", state.agent_id)
      .maybeSingle();
    if (!ag || !ag.ativo) return { ok: false, reason: "agente desativado", hard: true, cardId: state.card_id };
  }

  // resposta do cliente depois do anchor → cadência antiga não vale mais
  const ref = state.last_sent_at ?? state.anchor_at;
  const { data: newer } = await admin
    .from("mensagens")
    .select("id")
    .eq("company_id", seq.company_id)
    .eq("numero", state.numero)
    .eq("direcao", "entrada")
    .gt("created_at", ref)
    .limit(1);
  if (newer && newer.length) return { ok: false, reason: "cliente respondeu", hard: true, cardId: state.card_id };

  // pausa / atendimento humano
  const { data: pause } = await admin
    .from("contact_pause")
    .select("pausado")
    .eq("company_id", seq.company_id)
    .eq("numero", state.numero)
    .maybeSingle();
  if (pause?.pausado) return { ok: false, reason: "atendimento humano/pausado", hard: true, cardId: state.card_id };

  // lead / etapa
  const { data: card } = await admin
    .from("crm_cards")
    .select("id, stage_id")
    .eq("company_id", seq.company_id)
    .eq("numero", state.numero)
    .maybeSingle();
  const cardId = card?.id ?? state.card_id ?? null;
  if (!stageEligible(seq, card?.stage_id ?? null)) return { ok: false, reason: "etapa não elegível", hard: true, cardId };
  if (card?.stage_id) {
    const { data: st } = await admin
      .from("crm_stage")
      .select("tipo")
      .eq("company_id", seq.company_id)
      .eq("id", card.stage_id)
      .maybeSingle();
    if (st?.tipo === "ganho" || st?.tipo === "perda") return { ok: false, reason: "lead finalizado", hard: true, cardId };
  }

  // Canal da própria company (WhatsApp ou Instagram, conforme a conversa)
  const { resolveChannelTarget } = await import("./channels.server");
  const target = await resolveChannelTarget(admin, seq.company_id, state.numero);
  if (!target.ready) {
    return { ok: false, reason: target.reason ?? "canal desconectado", hard: false, cardId };
  }

  return { ok: true, cardId, instanceName: target.instanceName ?? undefined, target };
}

async function buildAiMessage(admin: any, seq: SequenceRow, state: StateRow, step: StepRow): Promise<string> {
  const { data: agent } = state.agent_id
    ? await admin.from("agent_config").select("*").eq("company_id", seq.company_id).eq("id", state.agent_id).maybeSingle()
    : { data: null };
  let cfg: any = agent;
  if (!cfg) {
    const { fetchActiveAgents, pickDefaultAgent } = await import("./agents");
    cfg = pickDefaultAgent(await fetchActiveAgents(admin, seq.company_id));
  }
  if (!cfg) return "";

  const { buildSystemPrompt, parseAiOutput } = await import("./ai-prompt");
  const { lovableAiChat } = await import("./lovable-ai.server");

  const { data: histDesc } = await admin
    .from("mensagens")
    .select("direcao, texto, created_at")
    .eq("company_id", seq.company_id)
    .eq("numero", state.numero)
    .order("created_at", { ascending: false })
    .limit(20);
  const historico = (histDesc ?? []).slice().reverse();

  const { data: produtosRows } = await admin
    .from("produto")
    .select("nome, preco, descricao, ativo, ordem")
    .eq("company_id", seq.company_id)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const system = buildSystemPrompt(cfg, {
    responderEmPartes: false,
    produtos: (produtosRows ?? []).map((p: any) => ({ nome: p.nome, preco: p.preco, descricao: p.descricao })),
  });

  const instrucao =
    (step.message_template || "").trim() ||
    "Retome a conversa de forma curta e natural, considerando o histórico.";

  // Empresa suspensa/inadimplente: follow-up com IA não roda.
  const { isCompanyOperational } = await import("@/lib/billing-guard.server");
  if (!(await isCompanyOperational(admin, seq.company_id))) return "";

  // Crédito: follow-up com IA consome como qualquer resposta da IA.
  const { data: hasCredit } = await admin.rpc("consume_ai_credit", { _company_id: seq.company_id, _ref: state.numero });
  if (!hasCredit) return "";


  const raw = await lovableAiChat(
    [
      { role: "system", content: system },
      {
        role: "system",
        content:
          `FOLLOW-UP AUTOMÁTICO: o cliente parou de responder. ${instrucao}\n` +
          "Envie UMA mensagem curta, sem repetir o que já foi dito, sem inventar oferta, preço, prazo ou desconto. Não diga que é uma mensagem automática.",
      },
      ...historico.map((m: any) => ({
        role: (m.direcao === "entrada" ? "user" : "assistant") as "user" | "assistant",
        content: m.texto,
      })),
      { role: "user", content: "(sem resposta do cliente)" },
    ],
    {
      provider: cfg.ai_provider || "gemini",
      model: cfg.ai_model || "google/gemini-2.5-flash",
      ...(String(cfg.ai_provider || "gemini") === "gemini"
        ? {}
        : await (await import("./agents")).fetchAgentProviderKeys(seq.company_id, cfg.id ?? null)),
    },
  );
  const { parts } = parseAiOutput(raw, []);
  return (parts.join(" ") || "").replace(/\s+/g, " ").trim().slice(0, 700);
}

/** Executa um estado já "claimado" (status=processing). */
export async function processFollowupState(admin: any, state: StateRow): Promise<{ id: string; result: string }> {
  const { data: seqRow } = await admin.from("followup_sequence").select("*").eq("id", state.sequence_id).maybeSingle();
  const seq = seqRow as SequenceRow | null;
  if (!seq) {
    await finishState(admin, state, "cancelled", { last_error: "sequência inexistente" });
    return { id: state.id, result: "no-sequence" };
  }
  const steps = await loadSteps(admin, seq);
  const step = steps[state.current_step];

  const guard = await revalidate(admin, seq, state);
  if (!guard.ok) {
    if (guard.hard) {
      await finishState(admin, state, "cancelled", { last_error: guard.reason ?? null });
      await logEvent(admin, seq.company_id, guard.cardId, state.agent_id, "followup_cancelado", `Follow-up cancelado — ${guard.reason}`, {
        sequence_id: seq.id,
        motivo: guard.reason,
      });
      return { id: state.id, result: `cancelled:${guard.reason}` };
    }
    // falha transitória (ex.: WhatsApp fora): reagenda, NUNCA marca como enviado
    const retry = shiftToAllowedWindow(new Date(Date.now() + 15 * 60_000), seq);
    await admin
      .from("followup_state")
      .update({ status: "pending", next_run_at: retry.toISOString(), attempts: state.attempts + 1, last_error: guard.reason ?? null, locked_at: null })
      .eq("id", state.id);
    return { id: state.id, result: `retry:${guard.reason}` };
  }

  if (!step) {
    // Sem mais etapas → ação final
    await applyFinalAction(admin, seq, state);
    await finishState(admin, state, "completed");
    await logEvent(admin, seq.company_id, guard.cardId, state.agent_id, "followup_concluido", `Follow-up concluído (${seq.nome})`, {
      sequence_id: seq.id,
      final_action: seq.final_action,
    });
    return { id: state.id, result: "completed" };
  }

  // Janela de horário: se saiu da janela, reagenda sem enviar
  const inWindow = shiftToAllowedWindow(new Date(), seq).getTime() <= Date.now() + 1000;
  if (!inWindow) {
    const when = shiftToAllowedWindow(new Date(), seq);
    await admin
      .from("followup_state")
      .update({ status: "pending", next_run_at: when.toISOString(), locked_at: null })
      .eq("id", state.id);
    return { id: state.id, result: "out-of-window" };
  }

  // 1) Mensagem (opcional)
  let sentText: string | null = null;
  if (step.message_mode !== "none") {
    const texto =
      step.message_mode === "template"
        ? (step.message_template || "").trim()
        : await buildAiMessage(admin, seq, state, step);
    if (texto) {
      try {
        const { sendChannelText } = await import("./channels.server");
        await sendChannelText(guard.target, texto);
        sentText = texto;
        const { data: card } = await admin
          .from("crm_cards")
          .select("user_id")
          .eq("company_id", seq.company_id)
          .eq("numero", state.numero)
          .maybeSingle();
        const { data: inst } = await admin
          .from("whatsapp_instances")
          .select("user_id")
          .eq("company_id", seq.company_id)
          .maybeSingle();
        await admin.from("mensagens").insert({
          company_id: seq.company_id,
          user_id: card?.user_id ?? inst?.user_id ?? guard.target?.userId ?? null,
          numero: state.numero,
          channel: guard.target?.channel ?? "whatsapp",
          direcao: "saida",
          autor: "ia",
          texto,
        });
      } catch (e: any) {
        console.error("[followup.send]", e?.message);
        const retry = shiftToAllowedWindow(new Date(Date.now() + 15 * 60_000), seq);
        await admin
          .from("followup_state")
          .update({ status: "pending", next_run_at: retry.toISOString(), attempts: state.attempts + 1, last_error: String(e?.message ?? e).slice(0, 300), locked_at: null })
          .eq("id", state.id);
        return { id: state.id, result: "send-failed" };
      }
    }
  }

  // 2) Mover etapa (opcional)
  if (step.move_stage_id) {
    const { data: st } = await admin
      .from("crm_stage")
      .select("id, nome")
      .eq("company_id", seq.company_id)
      .eq("id", step.move_stage_id)
      .maybeSingle();
    if (st && guard.cardId) {
      await admin.from("crm_cards").update({ stage_id: st.id, status: st.nome }).eq("id", guard.cardId).eq("company_id", seq.company_id);
      await logEvent(admin, seq.company_id, guard.cardId, state.agent_id, "followup_stage", `Follow-up moveu o lead para ${st.nome}`, {
        sequence_id: seq.id,
        etapa: state.current_step + 1,
        stage_id: st.id,
      });
    }
  }

  const now = new Date();
  await logEvent(admin, seq.company_id, guard.cardId, state.agent_id, "followup_enviado", `Follow-up etapa ${state.current_step + 1}${sentText ? ` enviado` : " executado (sem mensagem)"}`, {
    sequence_id: seq.id,
    step_id: step.id,
    etapa: state.current_step + 1,
    modo: step.message_mode,
    texto: sentText,
  });

  // 3) Finalizar após envio (opcional) — encerra a cadência
  if (step.finalize) {
    await applyFinalAction(admin, seq, { ...state, card_id: guard.cardId });
    if (seq.final_action === "none" || seq.final_action === "stop") {
      // finalize do step sem ação final configurada: move para etapa de perda se existir
      const { data: st } = await admin
        .from("crm_stage")
        .select("id, nome")
        .eq("company_id", seq.company_id)
        .eq("tipo", "perda")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (st && guard.cardId) {
        await admin.from("crm_cards").update({ stage_id: st.id, status: st.nome }).eq("id", guard.cardId).eq("company_id", seq.company_id);
      }
    }
    await finishState(admin, state, "completed", { last_sent_at: sentText ? now.toISOString() : state.last_sent_at });
    return { id: state.id, result: "finalized" };
  }

  // 4) Próxima etapa (delay RELATIVO à etapa que acabou de rodar)
  const nextIndex = state.current_step + 1;
  const nextStep = steps[nextIndex];
  if (!nextStep) {
    await applyFinalAction(admin, seq, { ...state, card_id: guard.cardId });
    await finishState(admin, state, "completed", { last_sent_at: sentText ? now.toISOString() : state.last_sent_at });
    await logEvent(admin, seq.company_id, guard.cardId, state.agent_id, "followup_concluido", `Follow-up concluído (${seq.nome})`, {
      sequence_id: seq.id,
      final_action: seq.final_action,
    });
    return { id: state.id, result: "completed" };
  }
  const nextRun = shiftToAllowedWindow(addDelay(now, nextStep.delay_value, nextStep.delay_unit), seq);
  await admin
    .from("followup_state")
    .update({
      status: "pending",
      current_step: nextIndex,
      next_run_at: nextRun.toISOString(),
      last_sent_at: sentText ? now.toISOString() : state.last_sent_at,
      locked_at: null,
      last_error: null,
      card_id: guard.cardId,
    })
    .eq("id", state.id);
  return { id: state.id, result: `next:${nextIndex + 1}` };
}

/** Claim atômico + processamento em lote (idempotente entre workers). */
export async function processDueFollowups(admin: any, limit = 25) {
  const { data, error } = await admin.rpc("followup_claim_due", { _limit: limit });
  if (error) throw new Error(error.message);
  const claimed = (data ?? []) as StateRow[];
  const results: Array<{ id: string; result: string }> = [];
  for (const state of claimed) {
    try {
      results.push(await processFollowupState(admin, state));
    } catch (e: any) {
      console.error("[followup.process]", e?.message);
      await admin
        .from("followup_state")
        .update({ status: "error", last_error: String(e?.message ?? e).slice(0, 300), next_run_at: null, locked_at: null })
        .eq("id", state.id);
      results.push({ id: state.id, result: "error" });
    }
  }
  return { claimed: claimed.length, results };
}
