import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "../src/lib/ai-prompt";
import { toReadableText } from "../src/lib/structured-text";

describe("serialização segura do prompt", () => {
  test("transforma todos os campos estruturados em texto legível", () => {
    const promptFinal = buildSystemPrompt(
      {
        nome_agente: "Rafa",
        nome_empresa: "Pedro Bahia",
        papel_objetivo: "Qualificar e orientar a contratação do plano adequado.",
        estilo_comunicacao: "Direto, acolhedor e uma pergunta por vez.",
        sobre_empresa: "Assessoria de treino online e presencial.",
        produtos_servicos: [
          { nome: "Consultoria trimestral", valor: "R$397", duracao: "90 dias" },
        ] as unknown as string,
        formas_pagamento: {
          cartao: "até 3x",
          pix: "R$397",
          link: "https://pay.pedrobahia.com/trimestral",
        } as unknown as string,
        objecoes: [{ objecao: "Está caro", resposta: "Explique o acompanhamento incluído." }] as unknown as string,
        faq: [{ pergunta: "É online?", resposta: "Há opção online ou presencial." }] as unknown as string,
        politicas: { cancelamento: "Conforme a condição informada na contratação." } as unknown as string,
        pode_fazer: "Consultar e gerenciar agendamentos pelas ferramentas reais.",
        nao_pode_fazer: "Não tratar comprovante como pagamento confirmado.",
        telefone_transferencia: "",
        palavra_pausar: "/pausar",
        palavra_despausar: "/despausar",
        como_vender: "1. Perguntar o objetivo.\n2. Saber se já treina ou está retornando.\n3. Perguntar frequência.\n4. Identificar dores ou limitações.\n5. Confirmar online ou presencial.\n6. Recomendar plano e orientar pagamento.",
        apresentacao: "Opa! Tudo bem? Me conta, qual é seu principal objetivo hoje com o treino? 💪",
        agendamento_ativo: true,
        perguntar_uma_por_vez: true,
      },
      {
        responderEmPartes: true,
        agendaTools: true,
        stages: [
          { nome: "Conversas", tipo: "normal" },
          { nome: "Negociando", tipo: "normal" },
          { nome: "Ganho", tipo: "ganho" },
          { nome: "Perda", tipo: "perda" },
        ],
      },
    );

    expect(promptFinal.includes("[object Object]")).toBe(false);
    expect(promptFinal).toContain("consultar_disponibilidade");
    expect(promptFinal).toContain("criar_agendamento");
    expect(promptFinal).toContain("consultar_agendamento");
    expect(promptFinal).toContain("reagendar_agendamento");
    expect(promptFinal).toContain("cancelar_agendamento");
    expect(promptFinal).toContain("[ESTAGIO: Conversas | Negociando | Ganho | Perda]");
  });

  test("não deixa marcador legado sobreviver dentro de estruturas", () => {
    expect(toReadableText({ produto: "[object Object]", valor: "R$397" })).toBe("Valor: R$397");
  });
});