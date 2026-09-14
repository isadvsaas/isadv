import { describe, expect, it } from "bun:test";
import { computeTrialEnd, trialDaysRemaining, isTrialActive, needsCheckout, DAY_MS } from "@/lib/trial";

/** Simulação do servidor: plano obrigatório + trial_days vindos do banco. */
function criarEmpresa(
  input: { planId: string | null; trialDays?: number },
  banco: { plans: { id: string; slug: string; trial_days: number; ativo: boolean }[] },
  nowMs: number,
) {
  if (!input.planId) throw new Error("Selecione um plano ativo para criar a empresa.");
  const plan = banco.plans.find((p) => p.id === input.planId && p.ativo);
  if (!plan) throw new Error("Plano inválido ou inativo. Selecione um plano ativo.");
  const trialAte = computeTrialEnd(nowMs, plan.trial_days); // ignora input.trialDays
  return {
    company: {
      selected_plan_slug: plan.slug,
      status_cobranca: "trial" as const,
      trial_ate: trialAte,
      onboarding_completed: false,
    },
    subscription: { plan_id: plan.id, status: "trialing" as const, trial_ends_at: trialAte },
  };
}

const NOW = Date.parse("2026-01-10T12:00:00.000Z");
const BANCO = {
  plans: [
    { id: "p-starter", slug: "starter", trial_days: 3, ativo: true },
    { id: "p-old", slug: "antigo", trial_days: 30, ativo: false },
  ],
};

describe("criação de empresa com dias grátis", () => {
  it("exige plano", () => {
    expect(() => criarEmpresa({ planId: null }, BANCO, NOW)).toThrow(/plano ativo/i);
  });

  it("rejeita plano inativo sem criar empresa", () => {
    expect(() => criarEmpresa({ planId: "p-old" }, BANCO, NOW)).toThrow(/inválido ou inativo/i);
  });

  it("usa trial_days do banco e ignora o valor do formulário", () => {
    const r = criarEmpresa({ planId: "p-starter", trialDays: 90 }, BANCO, NOW);
    expect(r.company.trial_ate).toBe(new Date(NOW + 3 * DAY_MS).toISOString());
    expect(r.company.status_cobranca).toBe("trial");
    expect(r.company.selected_plan_slug).toBe("starter");
  });

  it("cria assinatura trialing vinculada ao plano", () => {
    const r = criarEmpresa({ planId: "p-starter" }, BANCO, NOW);
    expect(r.subscription).toEqual({ plan_id: "p-starter", status: "trialing", trial_ends_at: r.company.trial_ate });
  });
});

describe("contagem de dias restantes", () => {
  const fim = new Date(NOW + 3 * DAY_MS).toISOString();

  it("mostra 3 no início e 2 após ~24h", () => {
    expect(trialDaysRemaining(fim, NOW)).toBe(3);
    expect(trialDaysRemaining(fim, NOW + DAY_MS)).toBe(2);
    expect(trialDaysRemaining(fim, NOW + 2 * DAY_MS)).toBe(1);
  });

  it("nunca mostra contagem negativa", () => {
    expect(trialDaysRemaining(fim, NOW + 10 * DAY_MS)).toBe(0);
  });
});

describe("banner de trial", () => {
  function banner(company: { status_cobranca: string; trial_ate: string }, nowMs: number) {
    if (company.status_cobranca !== "trial") return null;
    const d = trialDaysRemaining(company.trial_ate, nowMs);
    if (d <= 0) return { texto: "Seu período grátis terminou.", acao: "/app/checkout" };
    return { texto: d === 1 ? "resta 1 dia grátis" : `restam ${d} dias grátis`, acao: "/app/checkout" };
  }
  const fim = new Date(NOW + 3 * DAY_MS).toISOString();

  it("singular e plural", () => {
    expect(banner({ status_cobranca: "trial", trial_ate: fim }, NOW)!.texto).toBe("restam 3 dias grátis");
    expect(banner({ status_cobranca: "trial", trial_ate: fim }, NOW + 2 * DAY_MS)!.texto).toBe("resta 1 dia grátis");
  });

  it("não aparece para assinatura paga ativa", () => {
    expect(banner({ status_cobranca: "ativo", trial_ate: fim }, NOW)).toBeNull();
  });

  it("aponta para o checkout existente", () => {
    expect(banner({ status_cobranca: "trial", trial_ate: fim }, NOW)!.acao).toBe("/app/checkout");
  });
});

describe("acesso durante e após o trial", () => {
  const emTrial = { status_cobranca: "trial", trial_ate: new Date(NOW + 3 * DAY_MS).toISOString() };

  it("durante o trial não força checkout (onboarding e painel liberados)", () => {
    expect(isTrialActive(emTrial.trial_ate, NOW)).toBe(true);
    expect(needsCheckout(emTrial, NOW)).toBe(false);
    expect(needsCheckout(emTrial, NOW + 2 * DAY_MS)).toBe(false);
  });

  it("trial vencido sem assinatura paga direciona ao checkout", () => {
    expect(needsCheckout(emTrial, NOW + 4 * DAY_MS)).toBe(true);
  });

  it("assinatura paga ativa não é bloqueada", () => {
    expect(needsCheckout({ status_cobranca: "ativo", trial_ate: emTrial.trial_ate }, NOW + 90 * DAY_MS)).toBe(false);
  });

  it("usuário Master (sem empresa) não é bloqueado", () => {
    expect(needsCheckout(null, NOW + 90 * DAY_MS)).toBe(false);
  });
});
