import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Check } from "lucide-react";
import { brand } from "@/config/brand";
import { createCompanyWithOwner, listPlansBasic } from "@/lib/master.functions";

export const Route = createFileRoute("/master/nova-empresa")({
  head: () => ({ meta: [{ title: `${brand.name} — Nova empresa` }] }),
  component: NovaEmpresa,
});

type Plan = { id: string; nome: string; preco_cents: number; moeda: string; intervalo: string; trial_days: number };

function fmt(cents: number, moeda = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(cents / 100);
}

function NovaEmpresa() {
  const create = useServerFn(createCompanyWithOwner);
  const fetchPlans = useServerFn(listPlansBasic);
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [nome, setNome] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [trialDays, setTrialDays] = useState<number>(3);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchPlans();
        setPlans(r.plans as any);
        const mid = r.plans?.find((p: any) => p.nome?.toLowerCase().includes("pro")) ?? r.plans?.[0];
        if (mid) setPlanId(mid.id);
        if (mid?.trial_days != null) setTrialDays(mid.trial_days);
      } catch (e: any) { toast.error(e?.message); }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setCreated(null);
    try {
      const r = await create({
        data: { nome, ownerEmail, planId: planId || null, trialDays, password: password || null },
      });
      toast.success("Empresa criada e liberada com trial");
      setCreated({ email: ownerEmail, password: r.tempPassword ?? (password || null) });
      setNome(""); setOwnerEmail(""); setPassword("");
    } catch (e: any) { toast.error(e?.message || "Falha"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova empresa</h1>
        <p className="text-sm text-muted-foreground">
          Cria a empresa, o usuário responsável e libera o plano com período de teste.
          Ao fim do trial o cliente precisa cadastrar o cartão para continuar.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da empresa</Label>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padaria do Bairro" />
            </div>
            <div>
              <Label>Email do responsável</Label>
              <Input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dono@empresa.com" />
            </div>
            <div>
              <Label>Senha (opcional)</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para gerar automática"
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Se preencher, esta será a senha de acesso.</p>
            </div>
            <div>
              <Label>Dias de teste grátis</Label>
              <Input
                type="number" min={0} max={90}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Após esse prazo o cliente precisa pagar pra continuar.</p>
            </div>
          </div>

          <div>
            <Label>Plano</Label>
            <div className="grid sm:grid-cols-3 gap-2 mt-2">
              {plans.map((p) => {
                const sel = planId === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPlanId(p.id)}
                    className={`text-left rounded-xl border p-3 transition ${
                      sel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{p.nome}</div>
                      {sel && <Check className="size-4 text-primary" />}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {fmt(p.preco_cents, p.moeda)}<span className="text-xs">/{p.intervalo === "month" ? "mês" : "ano"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !planId}>
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Plus className="size-4 mr-1.5" />}
              Criar e liberar acesso
            </Button>
          </div>
        </form>

        {created && (
          <div className="mt-5 rounded-xl border bg-emerald-500/10 p-4 space-y-2">
            <div className="font-semibold text-sm">Acesso criado ✅</div>
            <div className="text-xs text-muted-foreground">
              Envie estes dados para o cliente. Ele entra em <code className="bg-background px-1 rounded">/entrar</code>.
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="Email" value={created.email} />
              {created.password && <Field label="Senha" value={created.password} />}
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/master/empresas" })}>
                Ir para empresas
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="text-xs flex-1 break-all">{value}</code>
        <Button
          size="sm" variant="ghost" type="button"
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
