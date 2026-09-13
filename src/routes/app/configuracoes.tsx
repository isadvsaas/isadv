import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Loader2, Save, CreditCard, Sparkles, AlertTriangle, Download, Shield, Wallet, Lock,
  Building2, Users, Settings2, Webhook, RefreshCw,
} from "lucide-react";
import { brand } from "@/config/brand";
import { trialDaysLeft } from "@/lib/tenant";
import { TemplatesTab } from "@/components/config/templates-tab";
import { HorariosTab } from "@/components/config/horarios-tab";
import { EquipePanel } from "@/components/config/equipe-panel";
import { listAuditLog, exportLgpd } from "@/lib/security.functions";
import { finStatus, enableFinanceiro } from "@/lib/financeiro.functions";
import { getMyCredits } from "@/lib/credits.functions";
import { usePlanFeatures } from "@/hooks/use-plan-features";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: `${brand.name} — Configurações` }] }),
  beforeLoad: ({ context }: any) => {
    const r = context?.membership?.role;
    if (r === "atendente") throw redirect({ to: "/app/dashboard" });
  },
  component: ConfigPage,
});

function ConfigPage() {
  const ctx = Route.useRouteContext();
  const companyId = ctx.company?.id;
  const userId = ctx.user.id;
  const company = ctx.company;
  const isOwner = ctx.membership?.role === "owner";

  const [empresa, setEmpresa] = useState({ nome: "", telefone: "" });
  const [identidade, setIdentidade] = useState({ primary_color: "#22C55E", logo_url: "" });
  const [perfil, setPerfil] = useState({ nome: "", email: ctx.user.email ?? "" });
  const [senha, setSenha] = useState({ nova: "", confirma: "" });
  const [savingE, setSavingE] = useState(false);
  const [savingI, setSavingI] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const [savingS, setSavingS] = useState(false);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    if (ctx.company) {
      setEmpresa({ nome: ctx.company.nome, telefone: ctx.company.telefone ?? "" });
      setIdentidade({ primary_color: ctx.company.primary_color, logo_url: ctx.company.logo_url ?? "" });
    }
    void (async () => {
      const { data } = await supabase.from("profiles").select("nome").eq("user_id", userId).maybeSingle();
      if (data) setPerfil((p) => ({ ...p, nome: data.nome ?? "" }));
    })();
    if (companyId) {
      void (async () => {
        const { data } = await supabase
          .from("subscription")
          .select("*, plan:plan(id,nome,preco_cents,moeda,intervalo)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setSub(data);
      })();
    }
  }, [companyId, userId]);

  async function saveEmpresa() {
    if (!companyId) return;
    setSavingE(true);
    const { error } = await supabase.from("company").update({ nome: empresa.nome, telefone: empresa.telefone || null }).eq("id", companyId);
    setSavingE(false);
    if (error) return toast.error(error.message);
    toast.success("Dados da empresa salvos"); setTimeout(() => location.reload(), 500);
  }

  async function saveIdentidade() {
    if (!companyId) return;
    setSavingI(true);
    const { error } = await supabase.from("company").update({
      primary_color: identidade.primary_color, logo_url: identidade.logo_url || null,
    }).eq("id", companyId);
    setSavingI(false);
    if (error) return toast.error(error.message);
    toast.success("Identidade atualizada"); setTimeout(() => location.reload(), 500);
  }

  async function savePerfil() {
    setSavingP(true);
    const { error } = await supabase.from("profiles").update({ nome: perfil.nome || null }).eq("user_id", userId);
    setSavingP(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  }

  async function saveSenha() {
    if (senha.nova.length < 8) return toast.error("Mínimo 8 caracteres");
    if (senha.nova !== senha.confirma) return toast.error("Senhas não conferem");
    setSavingS(true);
    const { error } = await supabase.auth.updateUser({ password: senha.nova });
    setSavingS(false);
    if (error) return toast.error(error.message);
    setSenha({ nova: "", confirma: "" });
    toast.success("Senha alterada");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Configurações <HelpTip text="Dados da empresa, equipe, plano e uso. Recursos técnicos ficam em Avançado." />
        </h1>
        <p className="text-sm text-muted-foreground">Sua empresa, sua equipe e seu plano.</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="empresa" className="flex-1 sm:flex-none"><Building2 className="size-4 mr-1.5" /> Minha empresa</TabsTrigger>
          <TabsTrigger value="equipe" className="flex-1 sm:flex-none"><Users className="size-4 mr-1.5" /> Equipe</TabsTrigger>
          <TabsTrigger value="plano" className="flex-1 sm:flex-none"><CreditCard className="size-4 mr-1.5" /> Plano e uso</TabsTrigger>
          <TabsTrigger value="avancado" className="flex-1 sm:flex-none"><Settings2 className="size-4 mr-1.5" /> Avançado</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4">
          <Card className="p-5 space-y-4 max-w-xl">
            <div className="space-y-1.5"><Label>Nome da empresa</Label><Input value={empresa.nome} onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone de contato</Label><Input value={empresa.telefone} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} /></div>
            <div className="flex justify-end">
              <Button onClick={saveEmpresa} disabled={savingE}>
                {savingE ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <EquipePanel isOwner={isOwner} />
        </TabsContent>

        <TabsContent value="plano" className="mt-4">
          <PlanoUsoSection company={company} sub={sub} />
        </TabsContent>

        <TabsContent value="avancado" className="mt-4">
          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="identidade" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Identidade visual</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 max-w-xl pb-2">
                  <div>
                    <Label>Cor principal</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={identidade.primary_color} onChange={(e) => setIdentidade({ ...identidade, primary_color: e.target.value })} className="h-10 w-14 rounded border" />
                      <Input value={identidade.primary_color} onChange={(e) => setIdentidade({ ...identidade, primary_color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Endereço do logo</Label>
                    <Input value={identidade.logo_url} onChange={(e) => setIdentidade({ ...identidade, logo_url: e.target.value })} placeholder="https://…" />
                    {identidade.logo_url && <img src={identidade.logo_url} alt="Logo da empresa" className="mt-2 size-16 rounded object-cover border" />}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveIdentidade} disabled={savingI}>
                      {savingI ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="templates" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Respostas rápidas</AccordionTrigger>
              <AccordionContent><div className="pb-2"><TemplatesTab /></div></AccordionContent>
            </AccordionItem>

            <AccordionItem value="horarios" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Horário de atendimento</AccordionTrigger>
              <AccordionContent><div className="pb-2"><HorariosTab /></div></AccordionContent>
            </AccordionItem>

            <AccordionItem value="financeiro" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Módulo financeiro</AccordionTrigger>
              <AccordionContent><div className="pb-2"><FinanceiroTab /></div></AccordionContent>
            </AccordionItem>

            <AccordionItem value="perfil" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Meu acesso</AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4 pb-2">
                  <Card className="p-5 space-y-4">
                    <h3 className="font-semibold">Meus dados</h3>
                    <div className="space-y-1.5"><Label>E-mail</Label><Input value={perfil.email} disabled /></div>
                    <div className="space-y-1.5"><Label>Nome</Label><Input value={perfil.nome} onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })} /></div>
                    <div className="flex justify-end">
                      <Button onClick={savePerfil} disabled={savingP}>
                        {savingP ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
                      </Button>
                    </div>
                  </Card>
                  <Card className="p-5 space-y-4">
                    <h3 className="font-semibold">Trocar senha</h3>
                    <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Confirmar</Label><Input type="password" value={senha.confirma} onChange={(e) => setSenha({ ...senha, confirma: e.target.value })} /></div>
                    <div className="flex justify-end">
                      <Button onClick={saveSenha} disabled={savingS}>
                        {savingS ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Trocar
                      </Button>
                    </div>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="seguranca" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">Segurança e dados</AccordionTrigger>
              <AccordionContent><div className="pb-2"><SegurancaTab /></div></AccordionContent>
            </AccordionItem>

            <AccordionItem value="tecnico" className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
              <AccordionTrigger className="text-sm font-semibold">API, webhooks e links UTM</AccordionTrigger>
              <AccordionContent>
                <div className="pb-2 space-y-3">
                  <p className="text-sm text-muted-foreground">Para desenvolvedores: integrações técnicas com outros sistemas.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/integracoes"><Webhook className="size-4 mr-1.5" /> Abrir integrações técnicas</Link>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SegurancaTab() {
  const fetchLog = useServerFn(listAuditLog);
  const fetchExport = useServerFn(exportLgpd);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );

  async function load() {
    setLoading(true); setErro(null);
    try { setRows(await fetchLog()); }
    catch { setErro("Não foi possível carregar esta informação."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function pedirNotificacoes() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return toast.error("Seu navegador não suporta notificações.");
    }
    const p = await Notification.requestPermission();
    setNotifEnabled(p === "granted");
    if (p === "granted") toast.success("Notificações ativadas");
  }

  async function baixarExport() {
    setExporting(true);
    try {
      const data = await fetchExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `lgpd-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="size-4" /> Avisos no navegador</h3>
            <p className="text-sm text-muted-foreground">Receba um aviso quando chegar nova mensagem.</p>
          </div>
          <Button variant={notifEnabled ? "secondary" : "default"} onClick={pedirNotificacoes} disabled={notifEnabled}>
            {notifEnabled ? "Ativados" : "Ativar"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Download className="size-4" /> Baixar meus dados (LGPD)</h3>
            <p className="text-sm text-muted-foreground">Um arquivo com todos os dados da sua empresa guardados aqui.</p>
          </div>
          <Button onClick={baixarExport} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />} Exportar
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Shield className="size-4" /> Histórico de ações</h3>
        <p className="text-sm text-muted-foreground">Últimas 200 ações registradas.</p>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
        ) : erro ? (
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">{erro}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4 mr-1.5" /> Tentar novamente</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</div>
        ) : (
          <div className="border rounded-md divide-y max-h-[500px] overflow-auto">
            {rows.map((r) => (
              <div key={r.id} className="p-3 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.acao}{r.recurso ? ` · ${r.recurso}` : ""}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.actor_email ?? "sistema"}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FinanceiroTab() {
  const fetchStatus = useServerFn(finStatus);
  const toggle = useServerFn(enableFinanceiro);
  const [st, setSt] = useState<{ ativo: boolean; planoPermite: boolean; diasVencimento: number; planSlug: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dias, setDias] = useState(7);
  const [saving, setSaving] = useState(false);

  async function load() {
    setErro(null);
    try {
      const s = await fetchStatus();
      setSt(s);
      setDias(s.diasVencimento);
    } catch { setErro("Não foi possível carregar esta informação."); }
  }
  useEffect(() => { void load(); }, []);

  async function setEnabled(v: boolean) {
    setSaving(true);
    try {
      await toggle({ data: { enable: v, diasVencimentoPadrao: dias } });
      toast.success(v ? "Módulo ativado" : "Módulo desativado");
      void load();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  async function saveDias() {
    if (!st?.ativo) return;
    setSaving(true);
    try {
      await toggle({ data: { enable: true, diasVencimentoPadrao: dias } });
      toast.success("Configuração salva");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  if (erro) {
    return (
      <div className="text-sm space-y-2">
        <p className="text-muted-foreground">{erro}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4 mr-1.5" /> Tentar novamente</Button>
      </div>
    );
  }
  if (!st) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;

  if (!st.planoPermite) {
    return (
      <Card className="p-5 max-w-2xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-muted grid place-items-center"><Lock className="size-5" /></div>
          <div>
            <h3 className="font-semibold">Módulo Financeiro</h3>
            <p className="text-sm text-muted-foreground">Disponível nos planos <b>Pro</b> e <b>Business</b>.</p>
          </div>
        </div>
        <p className="text-sm">Inclui contas a pagar e receber, fluxo de caixa e receita automática quando um cliente é marcado como ganho.</p>
        <Button asChild><Link to="/app/checkout">Ver planos</Link></Button>
      </Card>
    );
  }

  return (
    <Card className="p-5 max-w-2xl space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="size-10 rounded-xl bg-[color:var(--brand-soft)] grid place-items-center">
          <Wallet className="size-5 text-[color:var(--brand-text)]" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-semibold flex items-center gap-2">
            Módulo Financeiro
            <Badge variant={st.ativo ? "default" : "secondary"}>{st.ativo ? "Ativado" : "Desativado"}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground">
            Se você já usa outro sistema financeiro, deixe desativado — o menu desaparece e nada muda no atendimento.
          </p>
        </div>
        <Button variant={st.ativo ? "outline" : "default"} onClick={() => setEnabled(!st.ativo)} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
          {st.ativo ? "Desativar" : "Ativar"}
        </Button>
      </div>

      {st.ativo && (
        <div className="border-t pt-4 space-y-2">
          <Label>Prazo padrão para receber de um cliente ganho</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <Input type="number" min={0} max={60} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            <span className="text-sm text-muted-foreground whitespace-nowrap">dias</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveDias} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function fmtBRL(cents: number, moeda = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(cents / 100);
}

function UsoLinha({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const hit = limit > 0 && used >= limit;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`tabular-nums ${hit ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{used} de {limit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[color:var(--panel-2)] overflow-hidden">
        <div className={`h-full rounded-full ${hit ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanoUsoSection({ company, sub }: { company: any; sub: any }) {
  const plan = usePlanFeatures();
  const creditsFn = useServerFn(getMyCredits);
  const [credits, setCredits] = useState<{ saldo: number } | null>(null);
  const [credErro, setCredErro] = useState(false);

  async function loadCredits() {
    setCredErro(false);
    try { setCredits(await creditsFn() as any); } catch { setCredErro(true); }
  }
  useEffect(() => { void loadCredits(); }, []);

  const status = company?.status_cobranca as string | undefined;
  const trialEnd = sub?.trial_ends_at ?? company?.trial_ate ?? null;
  const days = trialEnd ? trialDaysLeft(trialEnd) : 0;
  const isTrial = status === "trial" || sub?.status === "trialing";
  const isActive = status === "ativo" || sub?.status === "active";
  const isExpired = isTrial && days <= 0;
  const renovacao = sub?.current_period_end ?? sub?.proxima_cobranca ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start max-w-4xl">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Seu plano</h2>
          {isActive ? (
            <Badge className="bg-emerald-600">Ativo</Badge>
          ) : isTrial ? (
            <Badge variant={isExpired ? "destructive" : "secondary"}>{isExpired ? "Teste encerrado" : "Em teste"}</Badge>
          ) : (
            <Badge variant="destructive">Inativo</Badge>
          )}
        </div>

        <div className="text-2xl font-bold">{sub?.plan?.nome || plan.planName}</div>
        {sub?.plan ? (
          <div className="text-sm text-muted-foreground">
            {fmtBRL(sub.plan.preco_cents, sub.plan.moeda)} por {sub.plan.intervalo === "month" ? "mês" : "ano"}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhum plano contratado ainda.</div>
        )}

        {isTrial && (
          <div className={`rounded-md p-3 text-sm flex items-start gap-2 ${
            isExpired ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}>
            {isExpired ? <AlertTriangle className="size-4 mt-0.5" /> : <Sparkles className="size-4 mt-0.5" />}
            <div>
              {isExpired
                ? <>Seu período de teste terminou. Escolha um plano para continuar usando.</>
                : <>Restam <b>{days} {days === 1 ? "dia" : "dias"}</b> de teste.</>}
            </div>
          </div>
        )}

        {renovacao && !isTrial && (
          <div className="text-sm text-muted-foreground">
            Próxima renovação: {new Date(renovacao).toLocaleDateString("pt-BR")}
          </div>
        )}

        {sub?.payment_method_brand && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="size-3.5" /> {sub.payment_method_brand} •••• {sub.payment_method_last4}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild className="flex-1 sm:flex-none">
            <Link to="/app/checkout" search={{ plano: sub?.plan?.nome?.toLowerCase() } as any}>
              <CreditCard className="size-4 mr-1.5" />
              {isActive ? "Trocar de plano" : "Ver planos"}
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Uso do mês</h2>
        </div>
        {plan.loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="space-y-3">
            <UsoLinha label="Mensagens" used={plan.usage.mensagens} limit={plan.limites.mensagens} />
            <UsoLinha label="Contatos" used={plan.usage.contatos} limit={plan.limites.contatos} />
            <UsoLinha label="Usuários" used={plan.usage.usuarios} limit={plan.limites.usuarios} />
            <UsoLinha label="WhatsApps conectados" used={plan.usage.instancias} limit={plan.limites.instancias} />
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="size-4" /> Créditos de IA</div>
            {credErro ? (
              <Button size="sm" variant="outline" onClick={() => void loadCredits()}><RefreshCw className="size-4 mr-1.5" /> Tentar novamente</Button>
            ) : credits ? (
              <span className="text-sm font-semibold tabular-nums">{credits.saldo.toLocaleString("pt-BR")}</span>
            ) : (
              <span className="text-sm text-muted-foreground">…</span>
            )}
          </div>
          {credErro && <p className="text-xs text-muted-foreground">Não foi possível carregar esta informação.</p>}
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link to="/app/checkout">Adicionar créditos</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
