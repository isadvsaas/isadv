// Supervisor / roteador interno por empresa.
// Não conversa com o cliente: apenas decide QUAL agente especialista responde.
// Retorno sempre estruturado e validado contra os agentes ATIVOS da própria company.

import type { AgentRow } from "./agents";

export type RoutingDecision = {
  agent: AgentRow;
  intent: string | null;
  confidence: number;
  reason: string | null;
  supervised: boolean; // true = Supervisor foi chamado
};

const MIN_CONFIDENCE = 0.55;

type StateRow = { agent_id: string | null; intent: string | null; confidence: number | null; updated_at: string };

export async function loadConversationState(
  admin: any,
  companyId: string,
  numero: string,
): Promise<StateRow | null> {
  const { data } = await admin
    .from("conversation_agent_state")
    .select("agent_id, intent, confidence, updated_at")
    .eq("company_id", companyId)
    .eq("numero", numero)
    .maybeSingle();
  return (data as StateRow) ?? null;
}

export async function persistConversationState(
  admin: any,
  companyId: string,
  numero: string,
  d: { agentId: string; intent: string | null; confidence: number | null; reason: string | null },
) {
  try {
    await admin.from("conversation_agent_state").upsert(
      {
        company_id: companyId,
        numero,
        agent_id: d.agentId,
        intent: d.intent,
        confidence: d.confidence,
        reason: d.reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,numero" },
    );
  } catch (e: any) {
    console.error("[supervisor.state]", e?.message);
  }
}

/** Heurística: mensagem curta logo após a última interação = continuação do mesmo assunto. */
function isLikelyContinuation(text: string, state: StateRow | null): boolean {
  if (!state?.agent_id) return false;
  const minutes = (Date.now() - new Date(state.updated_at).getTime()) / 60_000;
  if (minutes > 30) return false;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words <= 4;
}

function extractJson(raw: string): any | null {
  const t = (raw || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(t);
  } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
}

/**
 * Decide o agente da conversa.
 * - 1 agente ativo  → usa direto, SEM chamar Supervisor (custo zero).
 * - continuação      → mantém o agente atual, SEM Supervisor.
 * - caso contrário   → Supervisor decide entre os agentes ativos da company.
 * - baixa confiança / falha / id inválido → agente default (ou atual).
 */
export async function routeToAgent(
  admin: any,
  params: {
    companyId: string;
    numero: string;
    text: string;
    agents: AgentRow[]; // já filtrados por company_id + ativo
    historico?: Array<{ direcao: string; texto: string }>;
  },
): Promise<RoutingDecision | null> {
  const { companyId, numero, text, agents } = params;
  if (!agents.length) return null;

  const byId = new Map(agents.map((a) => [a.id, a]));
  const fallback = agents.find((a) => a.is_default) ?? agents[0]!;

  // Caminho legado: uma empresa com um único agente se comporta exatamente como antes.
  if (agents.length === 1) {
    return { agent: agents[0]!, intent: null, confidence: 1, reason: "único agente ativo", supervised: false };
  }

  const state = await loadConversationState(admin, companyId, numero);
  const current = state?.agent_id ? byId.get(state.agent_id) ?? null : null;

  if (current && isLikelyContinuation(text, state)) {
    return { agent: current, intent: state?.intent ?? null, confidence: state?.confidence ?? 0.8, reason: "continuação", supervised: false };
  }

  const catalogo = agents
    .map((a) => `- id: ${a.id} | nome: ${a.nome_agente} | especialidade: ${(a.descricao || a.papel_objetivo || "").slice(0, 220)}`)
    .join("\n");
  const ctx = (params.historico ?? [])
    .slice(-6)
    .map((m) => `${m.direcao === "entrada" ? "CLIENTE" : "ATENDIMENTO"}: ${(m.texto || "").slice(0, 200)}`)
    .join("\n");

  const system = [
    "Você é um ROTEADOR interno de atendimento. Você NUNCA fala com o cliente.",
    "Sua única tarefa é escolher qual agente especialista deve responder a mensagem atual.",
    "Regras:",
    "- Se a mensagem continua o mesmo assunto do agente atual, MANTENHA o agente atual.",
    "- Troque de agente somente quando o assunto mudar claramente para a especialidade de outro.",
    "- Use apenas os ids listados. Nunca invente id.",
    "- Se não tiver certeza, use confidence baixo (menor que 0.5).",
    'Responda SOMENTE JSON: {"agent_id":"<id>","intent":"<palavra curta>","confidence":<0..1>,"reason":"<motivo curto>"}',
  ].join("\n");

  const user = [
    `AGENTES DISPONÍVEIS:\n${catalogo}`,
    current ? `AGENTE ATUAL DA CONVERSA: ${current.id} (${current.nome_agente})` : "AGENTE ATUAL: nenhum",
    ctx ? `CONTEXTO RECENTE:\n${ctx}` : "",
    `MENSAGEM ATUAL DO CLIENTE:\n${text.slice(0, 1200)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: any = null;
  try {
    const { lovableAiChat } = await import("./lovable-ai.server");
    const raw = await lovableAiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { provider: "gemini", model: "google/gemini-2.5-flash-lite" },
    );
    parsed = extractJson(raw);
  } catch (e: any) {
    console.error("[supervisor]", e?.message);
  }

  const confidence = Number(parsed?.confidence);
  const chosenId = typeof parsed?.agent_id === "string" ? parsed.agent_id.trim() : "";
  // Isolamento: só aceita id que está na lista de agentes ATIVOS desta company.
  const chosen = chosenId ? byId.get(chosenId) ?? null : null;

  let agent: AgentRow;
  let intent: string | null = typeof parsed?.intent === "string" ? parsed.intent.slice(0, 60) : null;
  let reason: string | null = typeof parsed?.reason === "string" ? parsed.reason.slice(0, 200) : null;
  let conf = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

  if (chosen && conf >= MIN_CONFIDENCE) {
    agent = chosen;
  } else {
    agent = current ?? fallback;
    if (!chosen) reason = reason ? `${reason} (id inválido/ausente → fallback)` : "id inválido/ausente → fallback";
    else reason = reason ? `${reason} (confiança baixa → fallback)` : "confiança baixa → fallback";
    if (!chosen) intent = state?.intent ?? intent;
    conf = conf || 0;
  }

  await persistConversationState(admin, companyId, numero, {
    agentId: agent.id,
    intent,
    confidence: conf,
    reason,
  });

  return { agent, intent, confidence: conf, reason, supervised: true };
}
