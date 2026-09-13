import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPlanUsage } from "@/lib/plan.functions";
import { featuresFor, normalizePlanSlug, type PlanFeatures, type PlanSlug } from "@/lib/plan-features";

export type PlanUsageState = {
  loading: boolean;
  slug: PlanSlug;
  planName: string;
  features: PlanFeatures;
  limites: { instancias: number; usuarios: number; contatos: number; mensagens: number };
  usage: { instancias: number; usuarios: number; contatos: number; mensagens: number };
  refresh: () => Promise<void>;
};

export function usePlanFeatures(): PlanUsageState {
  const fetcher = useServerFn(getPlanUsage);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<{ plan: any; usage: any } | null>(null);

  async function load() {
    try {
      const r = await fetcher();
      setState(r);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const slug = normalizePlanSlug(state?.plan?.slug);
  return {
    loading,
    slug,
    planName: state?.plan?.nome || "Starter",
    features: featuresFor(slug),
    limites: { ...(state?.plan?.limites || { usuarios: 1, contatos: 1000, mensagens: 1500 }), instancias: 1 },
    usage: state?.usage || { instancias: 0, usuarios: 0, contatos: 0, mensagens: 0 },
    refresh: load,
  };
}
