// Lógica única do período grátis (trial). Controlado internamente por plan.trial_days.
// O provedor de checkout NÃO oferece trial.

export const DAY_MS = 86_400_000;

/** Vencimento do trial = criação + plan.trial_days (dias inteiros). */
export function computeTrialEnd(nowMs: number, trialDays: number): string {
  const days = Math.max(0, Math.floor(Number(trialDays) || 0));
  return new Date(nowMs + days * DAY_MS).toISOString();
}

/** Dias restantes exibidos ao usuário: max(0, ceil((trial_ate - agora) / 24h)). */
export function trialDaysRemaining(trialAte: string | null | undefined, nowMs: number = Date.now()): number {
  if (!trialAte) return 0;
  const end = new Date(trialAte).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - nowMs) / DAY_MS));
}

/** Trial ainda válido (não expirado). */
export function isTrialActive(trialAte: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!trialAte) return false;
  const end = new Date(trialAte).getTime();
  return Number.isFinite(end) && end > nowMs;
}

/** Empresa precisa passar pelo checkout? (mesma regra do guard em /app) */
export function needsCheckout(
  company: { status_cobranca: string; trial_ate: string } | null,
  nowMs: number = Date.now(),
): boolean {
  if (!company) return false;
  if (company.status_cobranca === "ativo") return false;
  if (company.status_cobranca === "trial") return !isTrialActive(company.trial_ate, nowMs);
  return ["checkout_pending", "suspenso", "pendente"].includes(company.status_cobranca);
}
