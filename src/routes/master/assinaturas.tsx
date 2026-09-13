import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/config/brand";
import { Loader2, Search, CreditCard, Building2 } from "lucide-react";
import { listMasterSubscriptions } from "@/lib/master.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/master/assinaturas")({
  head: () => ({ meta: [{ title: `${brand.name} — Assinaturas` }] }),
  component: AssinaturasPage,
});

type Row = {
  id: string;
  company_id: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  paddle_subscription_id: string | null;
  next_billing_amount_cents: number | null;
  created_at: string;
  plan: { nome: string; preco_cents: number; moeda: string; intervalo: string } | null;
  company: { nome: string; status_cobranca: string; email_corporativo: string | null } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  trialing: { label: "Trial", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
  active: { label: "Ativa", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  past_due: { label: "Inadimplente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  canceled: { label: "Cancelada", cls: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
  paused: { label: "Pausada", cls: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  incomplete: { label: "Incompleta", cls: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
};

function AssinaturasPage() {
  const fetchSubscriptions = useServerFn(listMasterSubscriptions);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const { rows } = await fetchSubscriptions();
      setRows(rows as any);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar assinaturas");
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!s) return true;
      return (
        r.company?.nome?.toLowerCase().includes(s) ||
        r.plan?.nome?.toLowerCase().includes(s) ||
        r.paddle_subscription_id?.toLowerCase().includes(s)
      );
    });
  }, [rows, q, filter]);

  const stats = useMemo(() => {
    const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + (r.plan?.preco_cents ?? 0), 0);
    const trial = rows.filter((r) => r.status === "trialing").length;
    const active = rows.filter((r) => r.status === "active").length;
    const past = rows.filter((r) => r.status === "past_due").length;
    return { mrr, trial, active, past };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Assinaturas</h1>
        <p className="text-sm text-muted-foreground mt-1">Todas as assinaturas das empresas que usam o {brand.name}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="MRR estimado" value={formatBRL(stats.mrr)} hint="apenas ativas" />
        <Stat label="Ativas" value={stats.active.toString()} />
        <Stat label="Em trial" value={stats.trial.toString()} />
        <Stat label="Inadimplentes" value={stats.past.toString()} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por empresa, plano, ID..." className="pl-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "active", "trialing", "past_due", "canceled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-md border transition ${
                  filter === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                }`}
              >
                {s === "all" ? "Todas" : STATUS[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma assinatura encontrada.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Empresa</th>
                  <th className="text-left px-4 py-3">Plano</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Próxima cobrança</th>
                  <th className="text-left px-4 py-3">Pagamento</th>
                  <th className="text-left px-4 py-3">Criada</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const st = STATUS[r.status] || { label: r.status, cls: "bg-muted text-foreground" };
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="size-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.company?.nome ?? "—"}</div>
                            {r.company?.email_corporativo && <div className="text-[11px] text-muted-foreground truncate">{r.company.email_corporativo}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.plan?.nome ?? "—"}</div>
                        {r.plan && <div className="text-[11px] text-muted-foreground">{formatBRL(r.plan.preco_cents, r.plan.moeda)}/{r.plan.intervalo === "month" ? "mês" : "ano"}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={st.cls + " font-medium"}>{st.label}</Badge>
                        {r.cancel_at_period_end && <div className="text-[10px] text-amber-600 mt-1">cancela no fim do período</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("pt-BR") : "—"}
                        {r.trial_ends_at && r.status === "trialing" && (
                          <div className="text-[10px] text-blue-600">trial até {new Date(r.trial_ends_at).toLocaleDateString("pt-BR")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.payment_method_brand ? (
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="size-3.5 text-muted-foreground" />
                            {r.payment_method_brand} •••• {r.payment_method_last4}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
function formatBRL(cents: number, moeda = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(cents / 100);
}
