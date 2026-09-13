// Dados mockados para o modo demonstração público (/demo/*). NÃO toca no banco.
export const demoCompany = {
  nome: "Clínica Vitalis",
  segmento: "Estética & Bem-estar",
  primary_color: "#7C3AED",
};

export type DemoMsg = {
  id: string; numero: string; nome: string;
  direcao: "entrada" | "saida"; autor: "ia" | "humano" | "contato";
  texto: string; quando: Date;
};

// Timestamp FIXO para evitar hydration mismatch entre SSR e client.
const NOW = new Date("2026-06-16T14:30:00.000Z").getTime();
const m = (min: number) => new Date(NOW - min * 60000);
const d = (days: number) => new Date(NOW - days * 86400000);
const dPlus = (days: number) => new Date(NOW + days * 86400000);

const seedContatos = [
  { numero: "5511987651001", nome: "Mariana Costa" },
  { numero: "5511987651002", nome: "Juliana Almeida" },
  { numero: "5521987651003", nome: "Rafael Tavares" },
  { numero: "5531987651004", nome: "Camila Ribeiro" },
  { numero: "5541987651005", nome: "Beatriz Souza" },
  { numero: "5511987651006", nome: "Patrícia Rocha" },
  { numero: "5511987651007", nome: "Letícia Moreira" },
];

export const demoMensagens: DemoMsg[] = [
  // Mariana — agendou
  { id: "1", numero: seedContatos[0].numero, nome: seedContatos[0].nome, direcao: "entrada", autor: "contato", texto: "Oi! Gostaria de agendar uma limpeza de pele profunda.", quando: m(50) },
  { id: "2", numero: seedContatos[0].numero, nome: seedContatos[0].nome, direcao: "saida", autor: "ia", texto: "Olá, Mariana! 👋 Posso te encaixar. Prefere manhã ou tarde?", quando: m(49) },
  { id: "3", numero: seedContatos[0].numero, nome: seedContatos[0].nome, direcao: "entrada", autor: "contato", texto: "Tarde, pode ser quinta.", quando: m(45) },
  { id: "4", numero: seedContatos[0].numero, nome: seedContatos[0].nome, direcao: "saida", autor: "ia", texto: "Quinta 19/06 às 15h com a Dra. Helena, R$ 280. Confirmo?", quando: m(44) },
  { id: "5", numero: seedContatos[0].numero, nome: seedContatos[0].nome, direcao: "entrada", autor: "contato", texto: "Confirmado! 💜", quando: m(8) },
  // Juliana — pacote de drenagem
  { id: "6", numero: seedContatos[1].numero, nome: seedContatos[1].nome, direcao: "entrada", autor: "contato", texto: "Bom dia! Quanto custa o pacote de drenagem linfática?", quando: m(180) },
  { id: "7", numero: seedContatos[1].numero, nome: seedContatos[1].nome, direcao: "saida", autor: "ia", texto: "Oi, Juliana! Pacote de 10 sessões R$ 1.890 (R$ 189 cada). Quer agendar avaliação?", quando: m(178) },
  { id: "8", numero: seedContatos[1].numero, nome: seedContatos[1].nome, direcao: "entrada", autor: "contato", texto: "Quero, tem sábado de manhã?", quando: m(170) },
  { id: "9", numero: seedContatos[1].numero, nome: seedContatos[1].nome, direcao: "saida", autor: "humano", texto: "Tem sim! Sáb 21/06 às 10h fechado. Te mando o endereço.", quando: m(160) },
  // Rafael — pensando
  { id: "10", numero: seedContatos[2].numero, nome: seedContatos[2].nome, direcao: "entrada", autor: "contato", texto: "Vocês fazem botox masculino?", quando: m(300) },
  { id: "11", numero: seedContatos[2].numero, nome: seedContatos[2].nome, direcao: "saida", autor: "ia", texto: "Fazemos sim, Rafael! Aplicação a partir de R$ 1.200 com a Dra. Helena (dermato). Quer marcar avaliação grátis?", quando: m(298) },
  { id: "12", numero: seedContatos[2].numero, nome: seedContatos[2].nome, direcao: "entrada", autor: "contato", texto: "Vou pensar e retorno, obrigado.", quando: m(290) },
  // Camila — perda
  { id: "13", numero: seedContatos[3].numero, nome: seedContatos[3].nome, direcao: "entrada", autor: "contato", texto: "Vocês fazem cirurgia plástica?", quando: m(1440) },
  { id: "14", numero: seedContatos[3].numero, nome: seedContatos[3].nome, direcao: "saida", autor: "ia", texto: "Não trabalhamos com cirurgia, só procedimentos estéticos não invasivos. Posso te indicar um parceiro?", quando: m(1438) },
  { id: "15", numero: seedContatos[3].numero, nome: seedContatos[3].nome, direcao: "entrada", autor: "contato", texto: "Não, obrigada.", quando: m(1430) },
  // Beatriz — negociando pacote laser
  { id: "16", numero: seedContatos[4].numero, nome: seedContatos[4].nome, direcao: "entrada", autor: "contato", texto: "Quero depilação a laser axilas + virilha. Tem combo?", quando: m(120) },
  { id: "17", numero: seedContatos[4].numero, nome: seedContatos[4].nome, direcao: "saida", autor: "ia", texto: "Tem! Pacote 8 sessões R$ 2.400 (12x no cartão). Posso reservar avaliação?", quando: m(118) },
  { id: "18", numero: seedContatos[4].numero, nome: seedContatos[4].nome, direcao: "entrada", autor: "contato", texto: "Me passa as condições de pagamento.", quando: m(60) },
  // Patrícia
  { id: "19", numero: seedContatos[5].numero, nome: seedContatos[5].nome, direcao: "entrada", autor: "contato", texto: "Aceita Pix com desconto?", quando: m(25) },
  { id: "20", numero: seedContatos[5].numero, nome: seedContatos[5].nome, direcao: "saida", autor: "ia", texto: "Aceitamos! 5% off à vista no Pix 💳", quando: m(24) },
  // Letícia
  { id: "21", numero: seedContatos[6].numero, nome: seedContatos[6].nome, direcao: "entrada", autor: "contato", texto: "Quero agendar avaliação de harmonização facial.", quando: m(12) },
];

export type DemoCard = {
  id: string; numero: string; nome: string;
  status: "conversas" | "negociando" | "ganho" | "perda";
  ultima_mensagem: string; ultima_em: Date;
  valor?: number; observacao?: string; tags?: string[];
};

export const demoCards: DemoCard[] = [
  { id: "c1", numero: seedContatos[0].numero, nome: seedContatos[0].nome, status: "ganho", ultima_mensagem: "Confirmado! 💜", ultima_em: m(8), valor: 280, observacao: "Limpeza de pele profunda agendada 19/06 15h — Dra. Helena.", tags: ["vip", "facial"] },
  { id: "c2", numero: seedContatos[1].numero, nome: seedContatos[1].nome, status: "ganho", ultima_mensagem: "Sáb 21/06 às 10h fechado.", ultima_em: m(160), valor: 1890, observacao: "Pacote 10 sessões drenagem. Avaliação sáb 21/06 10h.", tags: ["pacote", "corporal"] },
  { id: "c3", numero: seedContatos[2].numero, nome: seedContatos[2].nome, status: "conversas", ultima_mensagem: "Vou pensar e retorno, obrigado.", ultima_em: m(290), tags: ["botox", "lead-quente"] },
  { id: "c4", numero: seedContatos[3].numero, nome: seedContatos[3].nome, status: "perda", ultima_mensagem: "Não, obrigada.", ultima_em: m(1430), observacao: "Procurava cirurgia plástica (não atendemos).", tags: ["fora-escopo"] },
  { id: "c5", numero: seedContatos[4].numero, nome: seedContatos[4].nome, status: "negociando", ultima_mensagem: "Me passa as condições de pagamento.", ultima_em: m(60), valor: 2400, observacao: "Combo depilação laser axilas + virilha — 8 sessões.", tags: ["laser", "pacote"] },
  { id: "c6", numero: seedContatos[5].numero, nome: seedContatos[5].nome, status: "conversas", ultima_mensagem: "Aceita Pix com desconto?", ultima_em: m(25), tags: ["lead"] },
  { id: "c7", numero: seedContatos[6].numero, nome: seedContatos[6].nome, status: "negociando", ultima_mensagem: "Quero agendar avaliação de harmonização facial.", ultima_em: m(12), valor: 1500, observacao: "Avaliação de harmonização — interessada em preenchimento labial.", tags: ["harmonizacao", "lead-quente"] },
];

export const demoStats = {
  conversas: demoCards.filter((c) => c.status === "conversas").length,
  negociando: demoCards.filter((c) => c.status === "negociando").length,
  ganho: demoCards.filter((c) => c.status === "ganho").length,
  perda: demoCards.filter((c) => c.status === "perda").length,
};

export const demoAgentConfig = {
  nome_agente: "Vivi (assistente da Vitalis)",
  nome_empresa: "Clínica Vitalis",
  papel_objetivo: "Atender clientes no WhatsApp, tirar dúvidas de procedimentos, qualificar leads e agendar avaliações.",
  estilo_comunicacao: "Acolhedor, elegante e profissional. Usa emojis com moderação (💜 ✨).",
  sobre_empresa: "Clínica de estética e bem-estar em Pinheiros (SP). Equipe dermato + esteticistas. Foco em pele, corpo e harmonização.",
  produtos_servicos: "Limpeza de pele, botox, preenchimento, harmonização facial, drenagem linfática, depilação a laser, peeling, massagens.",
  pode_fazer: "Mostrar procedimentos, informar preços, agendar avaliação, enviar localização.",
  nao_pode_fazer: "Não prescreve, não promete resultado, não atende emergência médica, não fala mal de concorrentes.",
  telefone_transferencia: "+55 11 99999-0000",
  palavra_pausar: "/pausar",
  palavra_despausar: "/despausar",
};

// ===== Templates (Fase 1) =====
export type DemoTemplate = { id: string; atalho: string; titulo: string; conteudo: string };
export const demoTemplates: DemoTemplate[] = [
  { id: "t1", atalho: "/precos", titulo: "Tabela de preços", conteudo: "Olá! Segue nossa tabela:\n• Limpeza de pele — R$ 280\n• Botox — a partir de R$ 1.200\n• Drenagem (10 sessões) — R$ 1.890\n• Laser axilas+virilha (8x) — R$ 2.400\n\nQuer agendar uma avaliação? 💜" },
  { id: "t2", atalho: "/endereco", titulo: "Endereço da clínica", conteudo: "Estamos na Rua dos Pinheiros, 1500 — Pinheiros, São Paulo/SP. Manobrista no local. 📍" },
  { id: "t3", atalho: "/horario", titulo: "Horário de atendimento", conteudo: "Funcionamos seg a sex 9h-20h e sáb 9h-15h. Atendimento só com hora marcada. ✨" },
  { id: "t4", atalho: "/pix", titulo: "Pagamento Pix", conteudo: "Pix com 5% de desconto à vista. Chave CNPJ: 12.345.678/0001-00 (Clínica Vitalis Ltda)." },
  { id: "t5", atalho: "/preparo-laser", titulo: "Preparo p/ laser", conteudo: "Pra sessão de laser:\n1) Não se depilar 30 dias antes (só raspar)\n2) Sem sol nos 7 dias prévios\n3) Vir sem hidratante na região\n\nDúvida? Me chama!" },
];

// ===== Horários (Fase 1) =====
export type DemoHora = { dia: string; ativo: boolean; abre: string; fecha: string };
export const demoHorarios: DemoHora[] = [
  { dia: "Segunda", ativo: true, abre: "09:00", fecha: "20:00" },
  { dia: "Terça", ativo: true, abre: "09:00", fecha: "20:00" },
  { dia: "Quarta", ativo: true, abre: "09:00", fecha: "20:00" },
  { dia: "Quinta", ativo: true, abre: "09:00", fecha: "20:00" },
  { dia: "Sexta", ativo: true, abre: "09:00", fecha: "20:00" },
  { dia: "Sábado", ativo: true, abre: "09:00", fecha: "15:00" },
  { dia: "Domingo", ativo: false, abre: "09:00", fecha: "18:00" },
];
export const demoMsgForaHorario = "Oi! Recebemos sua mensagem 💜 Nossa equipe responde de seg a sex 9h-20h e sáb até 15h. Já já te chamamos!";

// ===== Campanhas (Fase 2) =====
export type DemoCampanha = {
  id: string; nome: string; status: "rascunho" | "agendada" | "enviando" | "concluida";
  segmento: string; quando: Date; total: number; enviados: number; lidos: number; respondidos: number; falharam: number;
};
export const demoCampanhas: DemoCampanha[] = [
  { id: "cmp1", nome: "Promo Botox · Junho", status: "concluida", segmento: "Tag: botox", quando: d(7), total: 84, enviados: 84, lidos: 71, respondidos: 19, falharam: 0 },
  { id: "cmp2", nome: "Reativação clientes inativos 90d", status: "concluida", segmento: "Sem agendamento ≥ 90 dias", quando: d(3), total: 156, enviados: 152, lidos: 118, respondidos: 27, falharam: 4 },
  { id: "cmp3", nome: "Lembrete pacote drenagem", status: "agendada", segmento: "Tag: pacote · corporal", quando: dPlus(1), total: 42, enviados: 0, lidos: 0, respondidos: 0, falharam: 0 },
  { id: "cmp4", nome: "Aniversariantes de julho", status: "rascunho", segmento: "Aniversário em julho", quando: dPlus(15), total: 38, enviados: 0, lidos: 0, respondidos: 0, falharam: 0 },
];

// ===== CSAT (Fase 3) =====
export type DemoCsat = { id: string; nome: string; score: number; comentario?: string; quando: Date };
export const demoCsat: DemoCsat[] = [
  { id: "s1", nome: "Mariana Costa", score: 5, comentario: "Atendimento perfeito, a Vivi me ajudou super rápido!", quando: m(120) },
  { id: "s2", nome: "Juliana Almeida", score: 5, comentario: "Adorei a estrutura, recomendo.", quando: d(1) },
  { id: "s3", nome: "Patrícia Rocha", score: 4, quando: d(2) },
  { id: "s4", nome: "Beatriz Souza", score: 5, comentario: "Equipe nota 10 💜", quando: d(3) },
  { id: "s5", nome: "Rafael Tavares", score: 3, comentario: "Demorou um pouco pra responder no sábado.", quando: d(4) },
];

// ===== Audit log (Fase 5) =====
export type DemoAudit = { id: string; acao: string; recurso?: string; actor: string; quando: Date };
export const demoAuditLog: DemoAudit[] = [
  { id: "a1", acao: "config.update", recurso: "business_hours", actor: "ana@clinicavitalis.com.br", quando: m(15) },
  { id: "a2", acao: "template.create", recurso: "/preparo-laser", actor: "ana@clinicavitalis.com.br", quando: m(60) },
  { id: "a3", acao: "campaign.send", recurso: "Reativação clientes inativos 90d", actor: "helena@clinicavitalis.com.br", quando: d(3) },
  { id: "a4", acao: "user.invite", recurso: "recepcao@clinicavitalis.com.br", actor: "ana@clinicavitalis.com.br", quando: d(5) },
  { id: "a5", acao: "lgpd.export", actor: "ana@clinicavitalis.com.br", quando: d(7) },
  { id: "a6", acao: "agent.update", recurso: "Vivi", actor: "ana@clinicavitalis.com.br", quando: d(10) },
];

// ===== Webhooks (Fase 4) =====
export type DemoWebhook = { id: string; url: string; eventos: string[]; ativo: boolean; ultimo: Date };
export const demoWebhooks: DemoWebhook[] = [
  { id: "w1", url: "https://crm.clinicavitalis.com.br/webhooks/atendezap", eventos: ["lead.created", "csat.responded"], ativo: true, ultimo: m(30) },
  { id: "w2", url: "https://hooks.zapier.com/hooks/catch/123/abc", eventos: ["message.received"], ativo: true, ultimo: m(120) },
];

// ===== API tokens (Fase 4) =====
export type DemoToken = { id: string; nome: string; prefixo: string; criado: Date; ultimoUso?: Date };
export const demoTokens: DemoToken[] = [
  { id: "tk1", nome: "Integração CRM", prefixo: "azp_live_4F7•••••KQ2", criado: d(45), ultimoUso: m(5) },
  { id: "tk2", nome: "Zapier", prefixo: "azp_live_9B2•••••XT8", criado: d(20), ultimoUso: m(180) },
];

// ===== Agendamentos próximos (UI) =====
export type DemoAgenda = { id: string; cliente: string; procedimento: string; profissional: string; quando: Date };
export const demoAgendamentos: DemoAgenda[] = [
  { id: "ag1", cliente: "Mariana Costa", procedimento: "Limpeza de pele profunda", profissional: "Dra. Helena", quando: dPlus(0.1) },
  { id: "ag2", cliente: "Letícia Moreira", procedimento: "Avaliação harmonização", profissional: "Dra. Helena", quando: dPlus(0.6) },
  { id: "ag3", cliente: "Juliana Almeida", procedimento: "Drenagem linfática (1ª sessão)", profissional: "Esteticista Paula", quando: dPlus(2) },
  { id: "ag4", cliente: "Beatriz Souza", procedimento: "Laser axilas + virilha", profissional: "Esteticista Paula", quando: dPlus(3) },
];
