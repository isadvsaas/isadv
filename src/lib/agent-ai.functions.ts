import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertNoObjectCoercion, toReadableText } from "./structured-text";
import { AGENT_SAFE_COLUMNS } from "./agents";

export type GeneratedAgentConfig = {
  nome_agente: string;
  nome_empresa: string;
  segmento: string;
  regiao_horario: string;
  descricao_negocio: string;
  diferenciais: string;
  publico_alvo: string;
  sobre_empresa: string;
  produtos_servicos: string;
  papel_objetivo: string;
  estilo_comunicacao: string;
  apresentacao: string;
  ofertas: string;
  como_vender: string;
  objecoes: string;
  formas_pagamento: string;
  faq: string;
  politicas: string;
  posvenda_msg: string;
  pode_fazer: string;
  nao_pode_fazer: string;
};

const FIELDS: (keyof GeneratedAgentConfig)[] = [
  "nome_agente","nome_empresa","segmento","regiao_horario","descricao_negocio",
  "diferenciais","publico_alvo","sobre_empresa","produtos_servicos","papel_objetivo",
  "estilo_comunicacao","apresentacao","ofertas","como_vender","objecoes",
  "formas_pagamento","faq","politicas","posvenda_msg","pode_fazer","nao_pode_fazer",
];

function extractJson(raw: string): any {
  const trimmed = (raw || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(trimmed); } catch {}
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error("A IA não retornou JSON válido. Tente novamente.");
}

function answersToText(respostas: Record<string, unknown>): string {
  return Object.entries(respostas)
    .map(([key, value]) => [key, toReadableText(value)] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// ANALISADOR PRD: olha o que o usuário escreveu, identifica lacunas críticas
// e gera perguntas guiadas (com exemplos) para o leigo conseguir responder.
// ────────────────────────────────────────────────────────────────────────

export type BriefQuestion = {
  id: string;            // chave estável (ex: "produtos_precos")
  pergunta: string;      // pergunta curta, linguagem leiga
  porque: string;        // por que isso importa (1 frase)
  exemplo: string;       // exemplo concreto pra destravar o usuário
  campo: keyof GeneratedAgentConfig | "extra";
  obrigatoria: boolean;
};

export type BriefAnalysis = {
  pronto: boolean;                 // true se já dá pra gerar com qualidade
  resumo: string;                  // resumo de 1-2 linhas do que entendeu
  cobertura: number;               // 0-100
  perguntas: BriefQuestion[];      // perguntas críticas pendentes (máx 6)
};

export const analyzeBusinessBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { descricao: string; respostas?: Record<string, string> }) => {
    const desc = (d?.descricao || "").trim();
    if (desc.length < 10) throw new Error("Conte um pouco mais sobre o negócio.");
    return {
      descricao: desc.slice(0, 8000),
      respostas: d?.respostas && typeof d.respostas === "object" ? d.respostas : {},
    };
  })
  .handler(async ({ data }) => {
    const { lovableAiChat } = await import("./lovable-ai.server");

    const respostasTxt = answersToText(data.respostas);

    const system = `Você é um Product Manager sênior + consultor de vendas, especialista em montar agentes de WhatsApp para pequenos negócios brasileiros (donos leigos, topo de funil).

Sua tarefa: ANALISAR a descrição do negócio e identificar o que FALTA para um agente atender bem sem dar respostas tortas.

Pense como PRD: o agente precisa saber NO MÍNIMO:
1) O que vende (produtos/serviços com preço ou faixa de preço)
2) Como o cliente recebe/recebe atendimento (entrega, retirada, agendamento, online)
3) Região e horário de atendimento
4) Formas de pagamento
5) Política básica (troca, cancelamento, garantia)
6) O que o agente NÃO pode prometer/fazer
7) Diferencial / motivo pra comprar dali
8) Próximo passo da venda (agendar? pedir endereço? enviar link?)

REGRAS DAS PERGUNTAS:
- Faça NO MÁXIMO 6 perguntas — só as CRÍTICAS que faltam.
- Linguagem de gente, não de formulário. O dono é leigo, topo de funil.
- Cada pergunta tem um EXEMPLO concreto, plausível pro segmento dele, pra destravar.
- NUNCA pergunte coisa que já está clara na descrição ou nas respostas anteriores.
- Se o negócio é simples e já tem o essencial (produtos + como vender + região OU horário), marque "pronto: true" e devolva perguntas: [].
- Se faltar pouco mas crítico (ex: preços, formas de pagamento), marque "pronto: false".

Responda APENAS JSON válido neste formato:
{
  "pronto": boolean,
  "resumo": "string curta do que entendeu do negócio",
  "cobertura": number,   // 0-100, quanto da info essencial já temos
  "perguntas": [
    {
      "id": "snake_case_estavel",
      "pergunta": "pergunta curta em PT-BR",
      "porque": "1 frase de por que isso importa pro atendimento",
      "exemplo": "exemplo concreto e específico pro segmento",
      "campo": "uma das chaves: nome_empresa|segmento|regiao_horario|produtos_servicos|formas_pagamento|politicas|diferenciais|publico_alvo|como_vender|nao_pode_fazer|ofertas|extra",
      "obrigatoria": boolean
    }
  ]
}`;

    const user = `DESCRIÇÃO DO NEGÓCIO:
${data.descricao}

${respostasTxt ? `RESPOSTAS JÁ DADAS PELO DONO:\n${respostasTxt}` : ""}

Analise e devolva o JSON.`;

    const raw = await lovableAiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { provider: "gemini", model: "google/gemini-2.5-flash" },
    );

    const parsed = extractJson(raw);
    const perguntas: BriefQuestion[] = Array.isArray(parsed?.perguntas)
      ? parsed.perguntas.slice(0, 6).map((q: any, i: number) => ({
          id: String(q?.id || `q_${i}`).slice(0, 60),
          pergunta: String(q?.pergunta || "").slice(0, 240),
          porque: String(q?.porque || "").slice(0, 240),
          exemplo: String(q?.exemplo || "").slice(0, 320),
          campo: (typeof q?.campo === "string" ? q.campo : "extra") as any,
          obrigatoria: !!q?.obrigatoria,
        })).filter((q: BriefQuestion) => q.pergunta)
      : [];

    const analysis: BriefAnalysis = {
      pronto: !!parsed?.pronto && perguntas.filter((p) => p.obrigatoria).length === 0,
      resumo: String(parsed?.resumo || "").slice(0, 400),
      cobertura: Math.max(0, Math.min(100, Number(parsed?.cobertura) || 0)),
      perguntas,
    };

    return analysis;
  });

// ────────────────────────────────────────────────────────────────────────
// GERAÇÃO DA CONFIG: agora aceita respostas do "interview" e gera PRD completo
// ────────────────────────────────────────────────────────────────────────

export const generateAgentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { descricao: string; respostas?: Record<string, string> }) => {
    if (!d?.descricao || d.descricao.trim().length < 20) {
      throw new Error("Descreva seu negócio com pelo menos algumas frases (mín. 20 caracteres).");
    }
    return {
      descricao: d.descricao.trim().slice(0, 8000),
      respostas: d?.respostas && typeof d.respostas === "object" ? d.respostas : {},
    };
  })
  .handler(async ({ context, data }) => {
    const { lovableAiChat } = await import("./lovable-ai.server");
    const { buildSystemPrompt } = await import("./ai-prompt");

    const respostasTxt = answersToText(data.respostas);

    const system = `Você é um Product Manager sênior + copywriter de vendas, montando um AGENTE DE WHATSAPP para um pequeno negócio brasileiro.

Você recebe: (1) descrição livre do dono (leigo) e (2) respostas dele para perguntas específicas.
Sua tarefa: gerar a configuração COMPLETA do agente, no padrão de um PRD enxuto e ACIONÁVEL — nada genérico, nada "blá-blá de IA".

Responda APENAS com JSON válido (sem markdown), com EXATAMENTE estas chaves (todas strings, PT-BR):
${FIELDS.map((f) => `- ${f}`).join("\n")}

DIRETRIZES (siga à risca):
- "nome_agente": curto, humano, brasileiro (ex: Lia, Bia, Tom, Rafa). Não use "Assistente", "Bot", "IA".
- "papel_objetivo": 1-2 frases. O QUE o agente faz e PRA QUE (qualificar, vender, agendar).
- "estilo_comunicacao": tom específico pro segmento (ex: padaria de bairro = caloroso e direto; clínica = cordial e seguro).
- "apresentacao": 1ª mensagem real que o agente envia. Curta, humana, 1 emoji só se combinar. Nada de "Olá! Como posso ajudá-lo hoje?".
- "sobre_empresa": parágrafo curto que o agente pode usar quando o cliente perguntar "quem é vocês".
- "produtos_servicos": TEXTO corrido/linhas legíveis, um item por bloco, com nome em destaque e, em linhas seguintes, duração, valor, condições e link — exatamente como o dono informou. NUNCA invente preço. NUNCA devolva objeto/array.
- "como_vender": passo a passo NUMERADO (3-6 passos) baseado NAS INSTRUÇÕES DO DONO. Se ele descreveu o fluxo comercial dele, PRESERVE esse fluxo; não substitua por funil genérico.
- "objecoes": 3-5 objeções REAIS daquele segmento, em linhas "Objeção: ... / Resposta: ...". Ex: "Tá caro" → resposta concreta.
- "faq": 4-6 perguntas que clientes daquele segmento REALMENTE fazem, em linhas "Pergunta: ... / Resposta: ...".
- "politicas": troca, cancelamento, garantia, prazo — coerentes com o segmento e com o modelo de negócio. Se o dono não falou, escreva uma política padrão razoável e marcada como "(confirmar com o time)".
- "posvenda_msg": mensagem curta de pós-venda alinhada ao tom. NUNCA garanta resultado, ganho, cura ou retorno financeiro — só ofereça acompanhamento e suporte.
- "pode_fazer": lista (1 por linha) do que o agente pode prometer/fazer.
- "nao_pode_fazer": lista (1 por linha) do que NÃO pode — inclua sempre "Não inventar preço, prazo ou política que não esteja aqui", "Não tratar comprovante enviado como pagamento confirmado" e "Não fechar venda sem confirmar os dados essenciais DESTE negócio". Se houver confirmação automática real, use-a; encaminhe ao humano somente quando não houver confirmação disponível ou houver divergência.
- "ofertas": só preencha se o dono mencionou promoção/cupom. Senão, "".
- "formas_pagamento": copie LITERALMENTE valores, número máximo de parcelas, links, chave/valor do Pix e nomes informados. Não resuma, não arredonde, não remova nada. Se o dono não disse, "(consultar)".
- Use "" (string vazia) quando faltar info — NUNCA omita chaves. NUNCA crie seção vazia com texto de enchimento.
- TODAS as chaves são STRINGS de texto legível. É PROIBIDO devolver objeto, array ou JSON aninhado em qualquer chave.
- Regras precisam CABER no negócio: se for serviço 100% online, não exija endereço/CEP/entrega; se for presencial, não fale de link de acesso.
- Nunca cite nomes de etapas de CRM, funis ou status internos: quem define isso é o sistema.
- Nunca escreva horários específicos de atendimento/agenda que o dono não informou.
- NÃO invente: preço, endereço, horário, telefone, prazo, estoque. Se faltar, deixe vazio ou marque "(consultar)".

Retorne SÓ o JSON.`;

    const user = `DESCRIÇÃO DO DONO:
${data.descricao}

${respostasTxt ? `RESPOSTAS ESPECÍFICAS DO DONO:\n${respostasTxt}` : ""}

Gere o JSON do agente.`;

    const raw = await lovableAiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { provider: "gemini", model: "google/gemini-2.5-flash" },
    );

    const parsed = extractJson(raw) as Record<string, unknown>;
    const config = {} as GeneratedAgentConfig;
    for (const k of FIELDS) {
      const v = parsed?.[k];
      (config as any)[k] = toReadableText(v);
    }

    const { supabase, userId } = context;
    const { data: membership } = await supabase
      .from("company_user")
      .select("company_id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership?.company_id) throw new Error("Sem empresa ativa.");

    const companyId = membership.company_id;
    const [{ data: current }, { data: stageRows }, { data: productRows }] = await Promise.all([
      supabase.from("agent_config").select(AGENT_SAFE_COLUMNS).eq("company_id", companyId).order("is_default", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("crm_stage").select("nome,tipo,ordem").eq("company_id", companyId).order("ordem", { ascending: true }),
      supabase.from("produto").select("nome,preco,descricao,ordem").eq("company_id", companyId).eq("ativo", true).order("ordem", { ascending: true }),
    ]);
    const mergedConfig = { ...(current ?? {}), ...config };
    const agendaTools = !!mergedConfig.agendamento_ativo;
    const promptPreview = assertNoObjectCoercion(buildSystemPrompt(mergedConfig as any, {
      responderEmPartes: mergedConfig.responder_em_partes ?? true,
      produtos: (productRows ?? []).map((p: any) => ({ nome: p.nome, preco: p.preco, descricao: p.descricao })),
      stages: (stageRows ?? []).map((s: any) => ({ nome: s.nome, tipo: s.tipo })),
      agendaTools,
    }), "Prompt final gerado");

    return {
      config,
      promptPreview,
      promptHasObjectCoercion: promptPreview.includes("[object Object]"),
    };
  });
