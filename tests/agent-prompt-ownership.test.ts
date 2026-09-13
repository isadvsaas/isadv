import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "../src/lib/ai-prompt";
import {
  MANUAL_PROMPT_CONFIRM_MESSAGE,
  PENDING_MARKER,
  filterAnsweredQuestions,
  isManualPromptMode,
  mergeGeneratedConfig,
  requiresManualPromptConfirmation,
} from "../src/lib/agent-generation";

const atual = {
  nome_agente: "Rafa",
  nome_empresa: "Pedro Bahia",
  formas_pagamento: "Pix R$397,00 — chave 11999990000 | Cartão até 3x de R$132,33 | https://pay.pedrobahia.com/trimestral",
  produtos_servicos: "Consultoria trimestral — R$397,00 — 90 dias",
  politicas: "",
};

describe("a) preço informado permanece idêntico", () => {
  test("regeneração não altera o preço confirmado", () => {
    const { config } = mergeGeneratedConfig(atual, {
      produtos_servicos: "",
      formas_pagamento: PENDING_MARKER,
    });
    expect(config.produtos_servicos).toBe("Consultoria trimestral — R$397,00 — 90 dias");
    expect(config.formas_pagamento).toBe(atual.formas_pagamento);
  });

  test("preço confirmado aparece literal no prompt", () => {
    const prompt = buildSystemPrompt(atual as any, { produtos: [{ nome: "Consultoria trimestral", preco: "397,00" }] });
    expect(prompt).toContain("R$397,00");
    expect(prompt).toContain("R$ 397,00");
  });
});

describe("b) URL informada permanece idêntica após regeneração", () => {
  test("link de pagamento não é reescrito", () => {
    const { config, conflitos } = mergeGeneratedConfig(atual, {
      formas_pagamento: "Pix e cartão (consultar link)",
    });
    expect(config.formas_pagamento).toContain("https://pay.pedrobahia.com/trimestral");
    expect(conflitos.map((c) => c.campo)).toContain("formas_pagamento");
  });
});

describe("c) política ausente vira [PENDENTE], nunca política inventada", () => {
  test("merge mantém pendência quando não há informação", () => {
    const { config } = mergeGeneratedConfig(atual, { politicas: PENDING_MARKER });
    expect(config.politicas).toBe(PENDING_MARKER);
  });

  test("prompt automático não inventa objetivo nem empresa", () => {
    const prompt = buildSystemPrompt({ nome_agente: "", nome_empresa: "", papel_objetivo: "" } as any);
    expect(prompt).toContain(PENDING_MARKER);
    expect(prompt).not.toContain("ajudar a fechar a venda.");
    expect(prompt).toContain("NUNCA invente preço, prazo, política, estoque, endereço");
  });
});

describe("d) prompt_custom tem prioridade e é preservado exatamente", () => {
  const manual = "  Regras do dono:\n  1. Nunca prometer prazo.\n  Pix: 11999990000  ";
  test("texto manual entra literal e substitui os blocos automáticos", () => {
    const prompt = buildSystemPrompt({ ...atual, prompt_custom: manual } as any);
    expect(prompt.startsWith(manual)).toBe(true);
    expect(prompt).not.toContain("Personalidade:");
  });

  test("geração nunca sobrescreve o prompt manual", () => {
    const { config } = mergeGeneratedConfig({ ...atual, prompt_custom: manual }, {
      prompt_custom: "texto gerado pela IA",
      politicas: "Política padrão razoável",
    });
    expect(config.prompt_custom).toBe(manual);
  });
});

describe("e) regeneração com prompt manual exige confirmação", () => {
  test("guarda de confirmação e mensagem exata", () => {
    expect(isManualPromptMode("meu prompt")).toBe(true);
    expect(requiresManualPromptConfirmation("meu prompt")).toBe(true);
    expect(requiresManualPromptConfirmation("   ")).toBe(false);
    expect(MANUAL_PROMPT_CONFIRM_MESSAGE).toBe(
      "Esta ação pode substituir alterações feitas manualmente. Deseja continuar?",
    );
  });
});

describe("f) nova informação não apaga campos anteriores", () => {
  test("campo novo entra, antigos permanecem", () => {
    const { config, conflitos } = mergeGeneratedConfig(atual, {
      politicas: "Cancelamento em até 7 dias (informado pelo dono)",
      nome_empresa: "",
      produtos_servicos: "Consultoria trimestral — R$397,00 — 90 dias",
    });
    expect(config.politicas).toBe("Cancelamento em até 7 dias (informado pelo dono)");
    expect(config.nome_empresa).toBe("Pedro Bahia");
    expect(config.nome_agente).toBe("Rafa");
    expect(conflitos).toHaveLength(0);
  });
});

describe("g) onboarding não repete pergunta já respondida", () => {
  const perguntas = [
    { id: "pagamento", campo: "formas_pagamento", pergunta: "Como recebe?" },
    { id: "politica", campo: "politicas", pergunta: "Qual a política?" },
    { id: "extra_1", campo: "extra", pergunta: "Algo mais?" },
  ];

  test("descarta perguntas de campos já preenchidos", () => {
    const restantes = filterAnsweredQuestions(perguntas, { config: atual, respostas: {} });
    expect(restantes.map((q) => q.id)).toEqual(["politica", "extra_1"]);
  });

  test("descarta perguntas já respondidas na entrevista", () => {
    const restantes = filterAnsweredQuestions(perguntas, {
      config: atual,
      respostas: { politica: "Sem troca, reembolso em 7 dias" },
    });
    expect(restantes.map((q) => q.id)).toEqual(["extra_1"]);
  });

  test("campo marcado como pendente volta a ser perguntado", () => {
    const restantes = filterAnsweredQuestions(perguntas, {
      config: { ...atual, formas_pagamento: PENDING_MARKER },
      respostas: {},
    });
    expect(restantes.map((q) => q.id)).toContain("pagamento");
  });
});
