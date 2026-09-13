import { assertNoObjectCoercion, toReadableText } from "./structured-text";

export interface ProdutoBrief {
  nome: string;
  preco?: number | string | null;
  descricao?: string | null;
}

export interface StageBrief {
  nome: string;
  tipo?: "normal" | "ganho" | "perda";
}

export interface AgentConfig {
  // IA provider
  ai_provider?: string;
  ai_model?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;


  /**
   * Prompt escrito manualmente pelo cliente (modo avançado).
   * Quando preenchido, substitui os blocos gerados automaticamente,
   * mas os protocolos técnicos (formato, agenda real, estágio) continuam sendo anexados.
   */
  prompt_custom?: string;

  // Identidade
  nome_agente: string;
  nome_empresa: string;
  papel_objetivo: string;
  estilo_comunicacao: string;
  sobre_empresa: string;
  produtos_servicos: string;
  pode_fazer: string;
  nao_pode_fazer: string;
  telefone_transferencia: string;
  palavra_pausar: string;
  palavra_despausar: string;

  // Buffer / partes
  segundos_buffer?: number;
  responder_em_partes?: boolean;

  // Negócio (novos)
  segmento?: string;
  descricao_negocio?: string;
  diferenciais?: string;
  publico_alvo?: string;
  regiao_horario?: string;
  ofertas?: string;
  cupom?: string;
  como_vender?: string;
  objecoes?: string;
  formas_pagamento?: string;
  ticket_medio?: string;
  faq?: string;
  politicas?: string;
  posvenda_msg?: string;
  pedir_avaliacao?: boolean;
  reativar_cliente?: boolean;

  // Personalidade
  tom?: number;            // 0-100 (sério→caloroso)
  formalidade?: number;    // 0-100
  usar_emojis?: boolean;   // legado
  tamanho_resposta?: string; // 'curtas' | 'medias' | 'longas'
  apresentacao?: string;

  // Personalidade avançada
  personalidade?: string | null;
  foco_atendimento?: string | null;
  emoji_intensidade?: string | null;
  usar_girias?: boolean | null;
  chamar_por_nome?: boolean | null;
  perguntar_uma_por_vez?: boolean | null;
  pode_brincar?: boolean | null;
  assinar_mensagens?: boolean | null;
  proatividade?: number | null;
  velocidade_resposta?: string | null;
  evitar_palavras?: string | null;
  idioma?: string | null;


  // Agendamento
  agendamento_ativo?: boolean;
  servicos_agendaveis?: string;
  duracao_padrao?: string;
  horarios_disponiveis?: string;
  antecedencia_min?: string;
}


export const PART_SEPARATOR = "|||";

/**
 * Texto seguro para o prompt: nunca gera "[object Object]".
 * Valores estruturados (objeto/array) são convertidos em texto legível.
 */
function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    const text = v.trim();
    return text === "[object Object]" ? "" : text;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return toReadableText(v);
}

function describeTom(tom?: number | null) {
  const n = typeof tom === "number" ? tom : 70;
  if (n <= 25) return "tom mais sério e contido";
  if (n <= 55) return "tom equilibrado, atencioso";
  if (n <= 80) return "tom caloroso e simpático";
  return "tom muito caloroso, próximo, quase de amigo";
}

function describeFormalidade(f?: number | null) {
  const n = typeof f === "number" ? f : 40;
  if (n <= 25) return "linguagem informal (você, oi, beleza)";
  if (n <= 55) return "linguagem semi-formal (você, com cordialidade)";
  if (n <= 80) return "linguagem formal (senhor/senhora, prezado)";
  return "linguagem muito formal (cerimoniosa)";
}

function describeTamanho(t?: string | null) {
  switch ((t || "curtas").toLowerCase()) {
    case "longas": return "respostas mais longas e explicativas quando fizer sentido";
    case "medias":
    case "médias": return "respostas de tamanho médio";
    default: return "respostas curtas, no estilo WhatsApp";
  }
}

function describePersonalidade(p?: string | null): string {
  switch ((p || "padrao").toLowerCase()) {
    case "extrovertido":
      return "personalidade EXTROVERTIDA: animado, entusiasmado, usa exclamações com naturalidade, transmite energia positiva sem soar artificial";
    case "serio":
    case "sério":
      return "personalidade SÉRIA: postura profissional, objetivo, direto ao ponto, sem brincadeiras, transmite competência e segurança";
    case "divertido":
      return "personalidade DIVERTIDA: bem-humorado, leve, pode fazer brincadeiras inteligentes sem perder o profissionalismo";
    case "consultivo":
      return "personalidade CONSULTIVA: age como especialista/consultor, faz perguntas inteligentes, recomenda com fundamento";
    case "amigavel":
    case "amigável":
      return "personalidade AMIGÁVEL: acolhedor, próximo, demonstra interesse genuíno, parece um amigo prestativo";
    default:
      return "personalidade EQUILIBRADA: simpático sem exageros, profissional sem ser frio";
  }
}

function describeFoco(f?: string | null): string {
  switch ((f || "ambos").toLowerCase()) {
    case "vendas":
      return "FOCO PRINCIPAL = VENDAS. Qualifique, gere interesse e conduza pro fechamento. Não seja agressivo, mas não perca oportunidade.";
    case "suporte":
      return "FOCO PRINCIPAL = SUPORTE. Resolva problemas e tire dúvidas com clareza e paciência. Não force venda.";
    default:
      return "FOCO HÍBRIDO: identifique a intenção. Se for dúvida/problema → resolva primeiro. Se for interesse de compra → conduza pra venda. Faça os dois com naturalidade.";
  }
}

function describeEmojis(intensidade?: string | null, legacy?: boolean | null): string {
  const i = (intensidade || (legacy === false ? "nenhum" : "pouco")).toLowerCase();
  switch (i) {
    case "nenhum": return "NUNCA use emojis";
    case "moderado": return "use emojis com frequência moderada (1 por mensagem quando combinar)";
    case "muito": return "use emojis com liberdade pra dar vida à conversa, sem exagerar";
    default: return "use no máximo 1 emoji ocasional, só quando combinar muito";
  }
}

function describeProatividade(p?: number | null): string {
  const n = typeof p === "number" ? p : 50;
  if (n <= 25) return "seja REATIVO: só responda o que o cliente perguntar, não antecipe ofertas";
  if (n <= 60) return "seja MODERADAMENTE PROATIVO: sugira o próximo passo quando fizer sentido";
  return "seja MUITO PROATIVO: antecipe necessidades, sugira upsell/cross-sell, conduza ativamente pro fechamento";
}

function montaPersonalidade(c: Partial<AgentConfig>): string {
  return [
    describePersonalidade(c.personalidade),
    describeTom(c.tom),
    describeFormalidade(c.formalidade),
    describeTamanho(c.tamanho_resposta),
    describeEmojis(c.emoji_intensidade, c.usar_emojis),
    describeProatividade(c.proatividade),
    c.usar_girias ? "pode usar gírias leves do cotidiano brasileiro" : "evite gírias e expressões muito informais",
    c.pode_brincar ? "pode fazer brincadeiras pontuais e leves" : "evite brincadeiras",
    c.chamar_por_nome === false ? "NÃO chame o cliente pelo nome a cada mensagem" : "chame o cliente pelo nome quando souber, sem repetir em toda mensagem",
    c.perguntar_uma_por_vez === false ? "" : "faça SEMPRE uma pergunta por vez (nunca dispare várias juntas)",
  ].filter(Boolean).join("; ");
}

export function buildSystemPrompt(
  c: Partial<AgentConfig>,
  opts?: {
    responderEmPartes?: boolean;
    estagioAtual?: string;
    resumoContato?: string;
    produtos?: ProdutoBrief[];
    stages?: StageBrief[];
    googleConectado?: boolean;
    /** true quando as tools de agenda estão disponíveis (motor de agendamento real). */
    agendaTools?: boolean;

  },
): string {
  const partes = opts?.responderEmPartes ?? c.responder_em_partes ?? true;
  const stages = (opts?.stages && opts.stages.length > 0) ? opts.stages : [];
  const produtos = opts?.produtos ?? [];

  const personalidade = montaPersonalidade(c);

  const produtosBloco = produtos.length
    ? "PRODUTOS / SERVIÇOS (catálogo real — use SOMENTE estes preços/itens):\n" +
      produtos
        .map((p) => {
          const precoTxt = txt(p.preco);
          const preco = precoTxt ? ` — R$ ${precoTxt}` : "";
          const descTxt = txt(p.descricao);
          const desc = descTxt ? ` (${descTxt})` : "";
          return `• ${txt(p.nome)}${preco}${desc}`;
        })
        .join("\n")
    : "";

  const stageNames = stages.map((s) => s.nome).join(" | ");
  const stagesFinaisNomes = stages.filter((s) => s.tipo === "ganho" || s.tipo === "perda").map((s) => s.nome);

  const sec = (titulo: string, valor: unknown, sufixo = "") => {
    const t = txt(valor);
    if (!t) return "";
    return `${titulo}${t.includes("\n") ? ":\n" : ": "}${t}${sufixo}`;
  };

  const agendaReal = !!(c.agendamento_ativo && opts?.agendaTools);

  const autoBlocos = [
    `Você é ${txt(c.nome_agente) || "um atendente virtual"}, atendendo no WhatsApp da empresa ${txt(c.nome_empresa) || "(empresa)"}.`,
    sec("Como se apresenta na primeira mensagem", c.apresentacao),
    `Objetivo: ${txt(c.papel_objetivo) || "atender clientes com cordialidade, descobrir o que precisam e ajudar a fechar a venda."}`,
    describeFoco(c.foco_atendimento),
    `Personalidade: ${personalidade}.`,
    sec("PALAVRAS / EXPRESSÕES PROIBIDAS (nunca use)", c.evitar_palavras),
    c.assinar_mensagens ? `Assine a primeira mensagem do dia com "— ${txt(c.nome_agente) || "Atendente"}".` : "",
    sec("Estilo de comunicação extra", c.estilo_comunicacao),

    sec("Segmento da empresa", c.segmento),
    sec("Sobre a empresa", c.sobre_empresa),
    sec("Descrição do negócio", c.descricao_negocio),
    sec("Diferenciais", c.diferenciais),
    sec("Público-alvo", c.publico_alvo),
    sec("Região / horário de atendimento", c.regiao_horario),
    sec("PRODUTOS / SERVIÇOS (informados pela empresa)", c.produtos_servicos),
    produtosBloco,
    sec("OFERTAS ATIVAS", c.ofertas),
    sec("Cupom disponível", c.cupom, " (só ofereça quando fizer sentido pra fechar)"),
    sec(
      "FORMAS DE PAGAMENTO (repita EXATAMENTE como está aqui — valores, parcelas, links e chaves)",
      c.formas_pagamento,
    ),
    sec("Ticket médio de referência", c.ticket_medio),
    sec(
      "FLUXO COMERCIAL DEFINIDO PELA EMPRESA (siga estes passos; eles têm prioridade sobre qualquer método genérico)",
      c.como_vender,
    ),
    sec("OBJEÇÕES COMUNS E COMO RESPONDER", c.objecoes),
    sec("FAQ", c.faq),
    sec("POLÍTICAS (troca/cancelamento/garantia)", c.politicas),
    sec("Mensagem padrão de pós-venda", c.posvenda_msg),
    c.pedir_avaliacao ? "Quando uma venda for concluída, peça uma avaliação de forma natural." : "",
    c.reativar_cliente ? "Pode reativar clientes inativos com mensagens leves e relevantes." : "",
    sec("O QUE VOCÊ PODE FAZER", c.pode_fazer),
    sec("O QUE VOCÊ NÃO PODE FAZER", c.nao_pode_fazer),
    `PAGAMENTO E COMPROVANTE:
- Nunca resuma, arredonde ou omita valores, número de parcelas, links ou dados de Pix: repita exatamente o que está acima.
- Comprovante enviado NÃO é pagamento confirmado. Só trate como pago após a confirmação real disponível no sistema; se não houver confirmação automática disponível, encaminhe a exceção ao time.
- Nunca peça dados que este negócio não precisa (ex.: endereço/CEP em serviço 100% online).`,
    c.agendamento_ativo && !agendaReal
      ? `AGENDAMENTO ATIVO: você pode conduzir o agendamento de ${txt(c.servicos_agendaveis) || "os serviços agendáveis"}.` +
        (txt(c.duracao_padrao) ? ` Duração padrão: ${txt(c.duracao_padrao)}.` : "") +
        (txt(c.horarios_disponiveis) ? ` Janelas informadas pela empresa: ${txt(c.horarios_disponiveis)}.` : "") +
        (txt(c.antecedencia_min) ? ` Antecedência mínima: ${txt(c.antecedencia_min)}.` : "") +
        ` Nunca invente horários: confirme com o time o que não estiver aqui.`
      : "",
    txt(c.telefone_transferencia)
      ? `Se o cliente pedir atendimento humano, reclamar de algo sensível, ou precisar de algo fora do seu escopo, oriente a falar com ${txt(c.telefone_transferencia)} e diga que vai transferir.`
      : "Se o cliente pedir atendimento humano ou for algo sensível, diga educadamente que vai chamar alguém do time.",
    sec("Contexto do contato", opts?.resumoContato),
    opts?.estagioAtual ? `Estágio atual no CRM: ${opts.estagioAtual}.` : "",
    `MÉTODO DE ATENDIMENTO (siga sempre):
1. Cumprimente com naturalidade só na PRIMEIRA mensagem da conversa. Depois NÃO repita saudação.
2. Antes de oferecer qualquer coisa, ENTENDA a necessidade do cliente. Faça UMA pergunta por vez (nunca várias juntas).
3. Para qualificar, siga primeiro o FLUXO COMERCIAL DEFINIDO PELA EMPRESA. Não substitua as perguntas específicas do negócio por uma lista genérica.
4. Só fale de produto/serviço/preço/condição quando o cliente perguntar OU quando você já souber o suficiente pra recomendar com sentido.
5. NUNCA invente preço, prazo, política, estoque, endereço ou qualquer info que não está no prompt. Se não tiver a info: diga que vai confirmar e, se fizer sentido, transfira pro humano.
6. Conduza pro próximo passo concreto: agendar, enviar proposta, confirmar pedido, marcar visita, etc.
7. Respeite SEMPRE o que está em "NÃO pode fazer".

ESTILO DE MENSAGEM (WhatsApp humano):
- Português do Brasil, tom próximo, sem ser formal demais e sem ser infantil.
- Mensagens CURTAS, frases naturais, como gente digita no WhatsApp. Nada de textão.
- Sem markdown pesado, sem listas com bullets, sem emojis em excesso.
- Não repita o nome do cliente em toda mensagem. Não repita o que ele acabou de dizer.
- Não soe como robô ("Como posso ajudá-lo hoje?"). Soe como um atendente real e atencioso.`,
  ];

  // Prompt manual do cliente (edição avançada) tem prioridade sobre os blocos gerados.
  // Os protocolos técnicos abaixo continuam sendo anexados para o motor não quebrar.
  const promptManual = txt(c.prompt_custom);
  const blocos: string[] = promptManual ? [promptManual] : autoBlocos;

  if (partes) {
    blocos.push(
      `FORMATO DA RESPOSTA (OBRIGATÓRIO):
Responda em 1 a 3 mensagens curtas, separadas pelo marcador "${PART_SEPARATOR}" (três pipes).
Cada parte é uma "bolha" curta, como se você estivesse digitando uma de cada vez no WhatsApp.
Exemplo: "oi, tudo bem? ${PART_SEPARATOR} aqui é a Ana da Padaria do Bairro ${PART_SEPARATOR} me conta, é pra retirar ou entrega?"
Se uma frase só já resolve, use UMA parte e pronto (sem o marcador). Nunca mais de 3 partes.`,
    );
  } else {
    blocos.push(`FORMATO DA RESPOSTA: uma mensagem só, curta e natural.`);
  }

  if (c.agendamento_ativo && opts?.agendaTools) {
    const nowIso = new Date().toISOString();
    blocos.push(
      `AGENDA REAL (motor de agendamento ativo):
Agora é ${nowIso} (UTC). Você NÃO tem acesso direto à agenda: use SEMPRE as ferramentas de agenda.
Você pode consultar horários, criar, consultar, reagendar e cancelar usando, respectivamente: consultar_disponibilidade, criar_agendamento, consultar_agendamento, reagendar_agendamento e cancelar_agendamento.
Nunca invente, estime ou repita horários de memória. Antes de qualquer proposta de horário, consulte a disponibilidade.
Ao criar, remarcar ou cancelar, use a ferramenta correspondente e siga o resultado retornado pelo servidor (inclusive quando vier conflito).
Não transfira para humano para operações normais de agenda. Chame o time somente se uma ferramenta retornar erro sem solução ou surgir uma exceção que exija análise humana.`,
    );
  } else if (c.agendamento_ativo && opts?.googleConectado) {
    const nowIso = new Date().toISOString();
    blocos.push(
      `AGENDAMENTO REAL (Google Agenda conectado):
Hoje é ${nowIso} (UTC, fuso America/Sao_Paulo). Quando o cliente CONFIRMAR um horário específico (dia + hora) para um serviço agendável, ` +
        `na MESMA resposta, em uma nova linha, escreva exatamente:
[AGENDAR: AAAA-MM-DDTHH:MM | AAAA-MM-DDTHH:MM | título curto]
A primeira data é o início, a segunda é o fim (use ${c.duracao_padrao || "30 min"} se o cliente não disser). ` +
        `Use o fuso -03:00 nos horários (ex.: 2026-06-20T15:00:00-03:00). Esse marcador é interno e NÃO aparece pro cliente. ` +
        `Só emita o marcador quando o cliente confirmou claramente. O horário será validado pelo servidor e pode ser recusado se estiver ocupado.`,
    );
  }


  if (stages.length) {
    blocos.push(
      `AO FINAL DA RESPOSTA, em uma nova linha, escreva exatamente:
[ESTAGIO: ${stageNames}]
Escolha 1 entre as etapas reais do CRM da empresa listadas acima — nunca crie ou adapte nomes de etapa. ` +
        (stagesFinaisNomes.length
          ? `Use uma etapa final (${stagesFinaisNomes.join(" / ")}) APENAS se o cliente confirmou (ganho) ou recusou claramente (perda). `
          : "") +
        `Esse marcador é interno, NÃO aparece pro cliente.`,
    );
  }

  return assertNoObjectCoercion(blocos.filter(Boolean).join("\n\n"));
}

export interface AgendarBrief { inicio: string; fim: string; titulo: string; }

export function parseAiOutput(
  raw: string,
  stages?: StageBrief[],
): { parts: string[]; stage: string | null; agendar: AgendarBrief | null } {
  let text = raw || "";
  let stage: string | null = null;
  let agendar: AgendarBrief | null = null;

  const agMatch = text.match(/\[\s*AGENDAR\s*:\s*([^\]]+)\]/i);
  if (agMatch) {
    const parts = agMatch[1].split("|").map((s) => s.trim());
    if (parts.length >= 2) {
      agendar = {
        inicio: parts[0],
        fim: parts[1],
        titulo: (parts[2] || "Agendamento").slice(0, 120),
      };
    }
    text = text.replace(agMatch[0], "").trim();
  }

  const stageMatch = text.match(/\[\s*ESTAGIO\s*:\s*([^\]]+)\]/i);
  if (stageMatch) {
    const candidate = stageMatch[1].trim().toLowerCase();
    if (stages && stages.length) {
      const found = stages.find((s) => s.nome.toLowerCase() === candidate);
      if (found) stage = found.nome;
      else {
        const starts = stages.find((s) => candidate.startsWith(s.nome.toLowerCase()));
        if (starts) stage = starts.nome;
      }
    } else {
      stage = stageMatch[1].trim();
    }
    text = text.replace(stageMatch[0], "").trim();
  }
  const parts = text
    .split(PART_SEPARATOR)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 3);
  return { parts: parts.length ? parts : [text.trim()].filter(Boolean), stage, agendar };
}

export function classifyStagePromptInstruction(): string {
  return (
    "Você é um classificador. Dado o histórico curto de mensagens entre um vendedor e um lead pelo WhatsApp, " +
    "responda APENAS com UMA palavra correspondente ao nome de uma etapa do CRM."
  );
}
