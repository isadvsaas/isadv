import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brand } from "@/config/brand";
import {
  Loader2, ShieldCheck, ArrowLeft, Check, TrendingUp, Crown, Smartphone,
  Users, MessageSquare, Headphones, Calendar, BarChart3, Webhook, Zap, ExternalLink, Sparkles, Lock,
} from "lucide-react";
import { createCheckoutCompany } from "@/lib/checkout.functions";
import { useServerFn } from "@tanstack/react-start";
import { trialDaysLeft } from "@/lib/tenant";

type Search = { plano?: string };

type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_cents: number;
  trial_days: number;
  checkout_url: string | null;
  destaque: boolean;
  limite_mensagens: number;
  limite_instancias: number;
  limite_usuarios: number;
  limite_contatos: number;
  features: string[];
};

export const Route = createFileRoute("/app/checkout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    plano: typeof s.plano === "string" ? s.plano : undefined,
  }),
  head: () => ({ meta: [{ title: `${brand.name} — Escolha seu plano` }] }),
  component: CheckoutPage,
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function defaultCompanyName(email?: string | null) {
  const local = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local ? `Empresa de ${local}` : "Minha empresa";
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  "número de WhatsApp": <Smartphone className="size-4" />,
  "usuários": <Users className="size-4" />,
  "conversas": <MessageSquare className="size-4" />,
  "contatos": <Users className="size-4" />,
  "CRM": <BarChart3 className="size-4" />,
  "IA": <Zap className="size-4" />,
  "Google Agenda": <Calendar className="size-4" />,
  "Relatórios": <BarChart3 className="size-4" />,
  "Suporte": <Headphones className="size-4" />,
  "API": <Webhook className="size-4" />,
  "Webhooks": <Webhook className="size-4" />,
  "Onboarding": <Crown className="size-4" />,
  "Gerente": <Crown className="size-4" />,
  "SLA": <ShieldCheck className="size-4" />,
};
function featureIcon(text: string) {
  for (const key of Object.keys(FEATURE_ICONS)) {
    if (text.toLowerCase().includes(key.toLowerCase())) return FEATURE_ICONS[key];
  }
  return <Check className="size-4" />;
}
function normalizeFeatureText(text: string) {
  return /n[úu]meros? de whatsapp/i.test(text) ? "1 número de WhatsApp" : text;
}
function buildCheckoutUrl(base: string, email?: string | null, companyId?: string | null) {
  try {
    const u = new URL(base);
    if (email) u.searchParams.set("email", email);
    if (companyId) u.searchParams.set("ref", companyId);
    return u.toString();
  } catch {
    return base;
  }
}

function CheckoutPage() {
  const ctx = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/checkout" }) as Search;
  const createCompany = useServerFn(createCheckoutCompany);

  const [plans, setPlans] = useState<Plano[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(search.plano ?? null);
  const [creating, setCreating] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // Modo: "trial" (sem empresa, oferecer teste grátis) vs "paywall" (empresa existe mas precisa pagar)
  const hasCompany = !!ctx.company;
  const trialActive =
    hasCompany && ctx.company!.status_cobranca === "trial" && trialDaysLeft(ctx.company!.trial_ate) > 0;
  const paywallMode = hasCompany && !trialActive && ctx.company!.status_cobranca !== "ativo";

  // Empresa ativa ou em trial ainda válido → não deveria estar aqui
  useEffect(() => {
    if (!ctx.company) return;
    if (ctx.company.status_cobranca === "ativo" || trialActive) {
      navigate({ to: ctx.company.onboarding_completed ? "/app/dashboard" : "/app/onboarding", replace: true });
    }
  }, [ctx.company, navigate, trialActive]);

  async function loadPlans() {
    setLoadingPlans(true);
    setPlansError(null);
    try {
      const { data, error } = await supabase.from("plan").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      const list = (data ?? []) as Plano[];
      setPlans(list);
      if (list.length === 0) {
        setPlansError("Nenhum plano disponível no momento.");
        return;
      }
      const initial =
        search.plano ||
        ctx.company?.selected_plan_slug ||
        list.find((p) => p.destaque)?.slug ||
        list[0].slug;
      setSelected((cur) => (cur && list.find((p) => p.slug === cur) ? cur : initial));
    } catch (e: any) {
      setPlansError(e?.message || "Não foi possível carregar os planos.");
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Polling em modo paywall: assim que webhook ativar, libera
  useEffect(() => {
    if (!waiting || !ctx.company) return;
    const id = ctx.company.id;
    const interval = setInterval(async () => {
      const { data: comp } = await supabase
        .from("company")
        .select("id, status_cobranca, onboarding_completed")
        .eq("id", id)
        .maybeSingle();
      if (comp?.status_cobranca === "ativo") {
        clearInterval(interval);
        toast.success("Pagamento confirmado! Liberando seu acesso…");
        setTimeout(() => {
          window.location.href = comp.onboarding_completed ? "/app/dashboard" : "/app/onboarding";
        }, 800);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [waiting, ctx.company]);

  const plano = useMemo(() => plans.find((p) => p.slug === selected), [plans, selected]);

  async function iniciarTrial() {
    if (!plano) return toast.error("Selecione um plano.");
    setCreating(true);
    try {
      await createCompany({ data: { nome: defaultCompanyName(ctx.user.email), plano_slug: plano.slug } });
      toast.success(`Teste grátis de ${plano.trial_days} dias iniciado!`);
      window.location.href = "/app/onboarding";
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar teste");
    } finally {
      setCreating(false);
    }
  }

  async function pagarAgora() {
    if (!plano) return toast.error("Selecione um plano.");
    if (!plano.checkout_url) {
      return toast.error("Este plano ainda não tem link de checkout configurado. Avise o administrador.");
    }
    const url = buildCheckoutUrl(plano.checkout_url, ctx.user.email, ctx.company?.id ?? null);
    window.open(url, "_blank", "noopener,noreferrer");
    setWaiting(true);
  }

  const headerBadge = paywallMode
    ? { icon: <Lock className="size-3.5 mr-1.5" />, text: "Seu período de teste terminou" }
    : { icon: <Sparkles className="size-3.5 mr-1.5" />, text: `${plans[0]?.trial_days ?? 3} dias grátis sem cartão` };
  const headerTitle = paywallMode
    ? "Ative seu plano para continuar"
    : "Comece grátis em segundos";
  const headerSubtitle = paywallMode
    ? "Seus dados ficam aqui esperando. Assim que o pagamento for confirmado, seu acesso é liberado automaticamente."
    : "Escolha um plano para começar. Você não precisa pagar agora — só vai cobrar no final do período de teste, se quiser continuar.";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="size-3.5" /> Sair
        </button>

        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {headerBadge.icon}
            {headerBadge.text}
          </Badge>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            {headerTitle}
          </h1>
          <p className="text-muted-foreground mt-3 text-base md:text-lg">
            {headerSubtitle}
          </p>
          {paywallMode && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 font-medium">
              Importante: use o mesmo e-mail do cadastro (<span className="font-mono">{ctx.user.email}</span>) na hora de pagar — é assim que a gente libera seu acesso.
            </p>
          )}
        </div>

        {loadingPlans ? (
          <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : plansError || plans.length === 0 ? (
          <Card className="max-w-md mx-auto p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">{plansError ?? "Nenhum plano disponível no momento."}</p>
            <Button onClick={() => void loadPlans()} variant="outline">Tentar novamente</Button>
          </Card>
        ) : (

          <>
            <div className="grid md:grid-cols-3 gap-4 lg:gap-6 items-stretch mb-10 md:mb-14">
              {plans.map((p) => {
                const isSelected = selected === p.slug;
                return (
                  <Card
                    key={p.id}
                    className={`relative flex flex-col p-6 md:p-7 transition-all duration-200 ${
                      isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl" : "hover:shadow-md"
                    } ${p.destaque ? "md:-my-4 md:py-10 border-primary/30 bg-gradient-to-b from-primary/5 to-background" : ""}`}
                  >
                    {p.destaque && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary px-3 py-1 text-[10px] uppercase tracking-wider font-bold shadow-sm">
                          <TrendingUp className="size-3 mr-1" /> Mais popular
                        </Badge>
                      </div>
                    )}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{p.nome}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <Check className="size-3" /> Selecionado
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold">{formatBRL(p.preco_cents)}</span>
                        <span className="text-muted-foreground text-sm">/mês</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 min-h-[2.5rem]">{p.descricao}</p>
                      {!paywallMode && (
                        <p className="text-[11px] text-primary font-semibold mt-1">
                          {p.trial_days} dias grátis — sem cartão
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      <Limit label="WhatsApp" v={1} />
                      <Limit label="Usuários" v={p.limite_usuarios} />
                      <Limit label="Conversas/mês" v={p.limite_mensagens} />
                      <Limit label="Contatos" v={p.limite_contatos} />
                    </div>
                    <ul className="space-y-2.5 text-sm flex-1 mb-6">
                      {(p.features || []).map((f) => normalizeFeatureText(f)).map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <span className="mt-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                            {featureIcon(f)}
                          </span>
                          <span className="text-foreground/90">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => setSelected(p.slug)}
                      variant={isSelected ? "default" : "outline"}
                      size="lg"
                      className="w-full font-semibold"
                    >
                      {isSelected ? (<><Check className="size-4 mr-1.5" /> Plano escolhido</>) : "Escolher este plano"}
                    </Button>
                  </Card>
                );
              })}
            </div>

            <div className="max-w-2xl mx-auto">
              <Card className="p-6 md:p-8 text-center">
                {waiting ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Aguardando confirmação do pagamento…</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A página de pagamento abriu em outra aba. Depois que o pagamento for aprovado, seu acesso é liberado aqui automaticamente
                      (pode levar alguns segundos).
                    </p>
                    {plano?.checkout_url && (
                      <a
                        href={buildCheckoutUrl(plano.checkout_url, ctx.user.email, ctx.company?.id ?? null)}
                        target="_blank" rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Reabrir página de pagamento <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                ) : paywallMode ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Lock className="size-5 text-primary" />
                      <h2 className="font-display text-xl font-bold">Assine para liberar seu acesso</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Plano selecionado: <span className="font-semibold text-foreground">{plano?.nome}</span> —{" "}
                      {formatBRL(plano?.preco_cents ?? 0)}/mês. Pagamento por cartão, Pix ou boleto via Kiwify.
                    </p>
                    <Button
                      onClick={pagarAgora}
                      disabled={!plano || !plano?.checkout_url}
                      size="lg"
                      className="w-full md:w-auto min-w-[280px] bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold"
                    >
                      <ExternalLink className="size-4 mr-2" />
                      {plano?.checkout_url ? `Assinar ${plano?.nome} agora` : "Plano sem checkout configurado"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Sparkles className="size-5 text-primary" />
                      <h2 className="font-display text-xl font-bold">Pronto pra começar?</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Plano escolhido: <span className="font-semibold text-foreground">{plano?.nome}</span>.
                      Você ganha <b>{plano?.trial_days ?? 3} dias grátis</b> pra explorar tudo, sem precisar de cartão.
                      Cobramos só se você decidir continuar.
                    </p>
                    <Button
                      onClick={iniciarTrial}
                      disabled={!plano || creating}
                      size="lg"
                      className="w-full md:w-auto min-w-[280px] bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold"
                    >
                      {creating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                      Começar {plano?.trial_days ?? 3} dias grátis
                    </Button>
                  </>
                )}
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Pagamento seguro processado pela Kiwify.
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Limit({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{v.toLocaleString("pt-BR")}</span>
    </div>
  );
}
