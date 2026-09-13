// Helpers compartilhados de agentes (client-safe).
// agent_config passou a ser multi-linha: N agentes por company.
// O agente "padrão" (is_default) é o que as telas atuais editam.

export type AgentRow = Record<string, any> & {
  id: string;
  company_id: string;
  nome_agente: string;
  slug: string;
  descricao: string;
  ativo: boolean;
  prioridade: number;
  is_default: boolean;
};

// Colunas seguras de agent_config para clientes (navegador/servidor autenticado).
// As credenciais openai_api_key/anthropic_api_key NUNCA saem do servidor
// (privilégio revogado no banco para anon/authenticated).
export const AGENT_SAFE_COLUMNS = "prompt_custom,user_id,nome_agente,nome_empresa,papel_objetivo,estilo_comunicacao,sobre_empresa,produtos_servicos,pode_fazer,nao_pode_fazer,telefone_transferencia,palavra_pausar,palavra_despausar,updated_at,company_id,segundos_buffer,responder_em_partes,segmento,descricao_negocio,diferenciais,publico_alvo,regiao_horario,ofertas,cupom,como_vender,objecoes,formas_pagamento,ticket_medio,faq,politicas,posvenda_msg,pedir_avaliacao,reativar_cliente,tom,formalidade,usar_emojis,tamanho_resposta,apresentacao,agendamento_ativo,servicos_agendaveis,duracao_padrao,horarios_disponiveis,antecedencia_min,ai_provider,ai_model,horarios_atendimento,mensagem_fora_horario,personalidade,foco_atendimento,emoji_intensidade,usar_girias,chamar_por_nome,perguntar_uma_por_vez,pode_brincar,assinar_mensagens,proatividade,velocidade_resposta,evitar_palavras,idioma,id,slug,descricao,ativo,prioridade,is_default,created_at,allowed_tools,source_template_id,channels";

/** Remove credenciais privadas de qualquer payload vindo do cliente. */
export function stripAgentSecrets<T extends Record<string, any>>(payload: T): T {
  const { openai_api_key: _o, anthropic_api_key: _a, ...rest } = payload as any;
  return rest as T;
}

export function agentSlugify(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "agente"
  );
}

/** Lista todos os agentes ATIVOS da company, em ordem de preferência. */
export async function fetchActiveAgents(client: any, companyId: string): Promise<AgentRow[]> {
  const { data } = await client
    .from("agent_config")
    .select(AGENT_SAFE_COLUMNS)
    .eq("company_id", companyId)
    .eq("ativo", true)
    .order("is_default", { ascending: false })
    .order("prioridade", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as AgentRow[];
}

/** Agente padrão (ou o primeiro ativo por prioridade). Nunca deixa a empresa sem agente. */
export function pickDefaultAgent(agents: AgentRow[]): AgentRow | null {
  return agents.find((a) => a.is_default) ?? agents[0] ?? null;
}

/** Busca direta do agente padrão da company (usado pelas telas atuais). */
export async function fetchDefaultAgent(client: any, companyId: string): Promise<AgentRow | null> {
  const { data } = await client
    .from("agent_config")
    .select(AGENT_SAFE_COLUMNS)
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("prioridade", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as AgentRow) ?? null;
}

/**
 * Salva a configuração do agente padrão da company (update quando já existe,
 * insert do primeiro agente quando não existe). Substitui o antigo
 * upsert onConflict:"company_id".
 */
export async function saveDefaultAgentConfig(
  client: any,
  companyId: string,
  userId: string,
  payload: Record<string, any>,
): Promise<{ error: { message: string } | null }> {
  const { id: _id, company_id: _c, user_id: _u, updated_at: _ua, created_at: _ca, ...rest0 } = payload;
  const rest = stripAgentSecrets(rest0);
  const existing = await fetchDefaultAgent(client, companyId);
  if (existing) {
    const { error } = await client
      .from("agent_config")
      .update(rest)
      .eq("id", existing.id)
      .eq("company_id", companyId);
    return { error };
  }
  const { error } = await client.from("agent_config").insert({
    company_id: companyId,
    user_id: userId,
    slug: agentSlugify(rest.nome_agente || "agente"),
    descricao: rest.descricao ?? "",
    ativo: true,
    is_default: true,
    prioridade: 0,
    ...rest,
  });
  return { error };
}

/** Lê as credenciais privadas do provedor — SOMENTE server-side (service_role). */
export async function fetchAgentProviderKeys(companyId: string, agentId?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = (supabaseAdmin as any).from("agent_config").select("openai_api_key, anthropic_api_key").eq("company_id", companyId);
  if (agentId) q = q.eq("id", agentId);
  else q = q.order("is_default", { ascending: false });
  const { data } = await q.limit(1).maybeSingle();
  return {
    openaiKey: String(data?.openai_api_key ?? "").trim(),
    anthropicKey: String(data?.anthropic_api_key ?? "").trim(),
  };
}
