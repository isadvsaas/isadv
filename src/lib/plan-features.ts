// Feature flags por plano. Client-safe (sem segredos).
// Os limites numéricos vivem na tabela `plan` (limite_*); este arquivo cobre
// features booleanas que o front precisa ler para esconder/bloquear UI.

export type PlanSlug = "starter" | "pro" | "business";

export type PlanFeatures = {
  providersIA: Array<"gemini" | "openai" | "anthropic">;
  googleCalendar: boolean;
  automacoes: boolean;
  apiWebhooks: boolean;
  relatoriosAvancados: boolean;
  suportePrioritario: boolean;
  financeiro: boolean;
};

export const PLAN_FEATURES: Record<PlanSlug, PlanFeatures> = {
  starter: {
    providersIA: ["gemini"],
    googleCalendar: false,
    automacoes: false,
    apiWebhooks: false,
    relatoriosAvancados: false,
    suportePrioritario: false,
    financeiro: false,
  },
  pro: {
    providersIA: ["gemini", "openai", "anthropic"],
    googleCalendar: true,
    automacoes: true,
    apiWebhooks: false,
    relatoriosAvancados: true,
    suportePrioritario: true,
    financeiro: true,
  },
  business: {
    providersIA: ["gemini", "openai", "anthropic"],
    googleCalendar: true,
    automacoes: true,
    apiWebhooks: true,
    relatoriosAvancados: true,
    suportePrioritario: true,
    financeiro: true,
  },
};

export const PLAN_LABEL: Record<PlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export function normalizePlanSlug(slug?: string | null): PlanSlug {
  const s = String(slug || "").toLowerCase();
  if (s === "pro" || s === "business" || s === "starter") return s as PlanSlug;
  return "starter";
}

export function featuresFor(slug?: string | null): PlanFeatures {
  return PLAN_FEATURES[normalizePlanSlug(slug)];
}

export function allowsProvider(slug: string | null | undefined, provider: string): boolean {
  const f = featuresFor(slug);
  return f.providersIA.includes(provider as any);
}
