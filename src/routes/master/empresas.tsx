import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogIn, Pause, Play, CalendarClock, Loader2, KeyRound, Eye, Sparkles } from "lucide-react";
import { brand } from "@/config/brand";
import { listCompanies, suspendCompany, extendTrial, resetCompanyOwnerPassword, getCompanyDetails, listPlansBasic, changeCompanyPlan } from "@/lib/master.functions";
import { adminGrantCredits } from "@/lib/credits.functions";

export const Route = createFileRoute("/master/empresas")({
  head: () => ({ meta: [{ title: `${brand.name} — Empresas` }] }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const navigate = useNavigate();
  const list = useServerFn(listCompanies);
  const suspend = useServerFn(suspendCompany);
  const extend = useServerFn(extendTrial);
  const resetPwd = useServerFn(resetCompanyOwnerPassword);
  const details = useServerFn(getCompanyDetails);
  const grantCredits = useServerFn(adminGrantCredits);
  const loadPlans = useServerFn(listPlansBasic);
  const changePlan = useServerFn(changeCompanyPlan);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [newPlanId, setNewPlanId] = useState<string>("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);


  async function reload() {
    setLoading(true);
    try {
      const r = await list({ data: { search, page } });
      setRows(r.rows); setTotal(r.total); setPageSize(r.pageSize);
    } catch (e: any) { toast.error(e?.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, [page]);

  function impersonate(companyId: string) {
    try {
      sessionStorage.setItem("master_impersonate_company", companyId);
      toast.success("Entrando como empresa…");
      navigate({ to: "/app/dashboard" });
    } catch (e: any) { toast.error(e?.message); }
  }

  async function toggleSuspend(c: any) {
    const next = c.status_cobranca !== "suspenso";
    await suspend({ data: { companyId: c.id, suspend: next } });
    toast.success(next ? "Empresa suspensa" : "Empresa reativada");
    reload();
  }

  async function doExtend(c: any) {
    const days = Number(prompt("Estender trial por quantos dias?", "14"));
    if (!days || isNaN(days)) return;
    await extend({ data: { companyId: c.id, days } });
    toast.success(`Trial estendido +${days}d`);
    reload();
  }

  async function doResetPassword(c: any) {
    const custom = prompt(
      `Definir senha do responsável de "${c.nome}".\n\nDeixe em branco para gerar uma senha temporária (forçará troca no próximo login).\nOu digite uma senha (mín. 8 caracteres):`,
      "",
    );
    if (custom === null) return;
    const newPassword = custom.trim();
    if (newPassword && newPassword.length < 8) return toast.error("Mínimo 8 caracteres");
    try {
      const r: any = await resetPwd({ data: { companyId: c.id, newPassword: newPassword || undefined } });
      if (r.tempPassword) {
        try { await navigator.clipboard.writeText(r.tempPassword); } catch {}
        toast.success(
          `Senha temporária para ${r.ownerEmail ?? "responsável"}: ${r.tempPassword} (copiada)`,
          { duration: 20000 },
        );
      } else {
        toast.success(`Senha atualizada para ${r.ownerEmail ?? "responsável"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao redefinir senha");
    }
  }

  async function doGrantCredits(c: any) {
    const saldoAtual = c.creditos_saldo ?? 0;
    const raw = prompt(
      `Créditos de IA para "${c.nome}".\n\nSaldo atual: ${saldoAtual} créditos.\n\nDigite quantidade (positivo adiciona, negativo remove):`,
      "100",
    );
    if (raw === null) return;
    const qtd = Number(raw);
    if (!qtd || isNaN(qtd)) return toast.error("Quantidade inválida");
    try {
      const r: any = await grantCredits({ data: { companyId: c.id, qtd, motivo: "ajuste_admin" } });
      toast.success(`Saldo: ${saldoAtual} → ${r.saldo} créditos`);
      setRows((prev) => prev.map((x) => (x.id === c.id ? { ...x, creditos_saldo: r.saldo } : x)));
      if (detail?.company?.id === c.id) await openDetails(c.id);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ajustar créditos");
    }
  }

  async function openDetails(companyId: string) {
    setDetail({ loading: true });
    setDetailLoading(true);
    try {
      const r = await details({ data: { companyId } });
      setDetail(r);
      setNewPlanId((r as any)?.subscription?.plan_id ?? "");
      if (!plans.length) {
        try {
          const p: any = await loadPlans();
          setPlans(p.plans ?? []);
        } catch {}
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar detalhes");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function savePlan() {
    if (!detail?.company?.id || !newPlanId) return;
    setSavingPlan(true);
    try {
      const r: any = await changePlan({ data: { companyId: detail.company.id, planId: newPlanId } });
      toast.success(`Plano alterado para ${r.planNome}`);
      await openDetails(detail.company.id);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao alterar plano");
    } finally {
      setSavingPlan(false);
    }
  }


  const pages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">{total} no total</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); reload(); }}>
          <Input placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2">
          <div className="col-span-3">Nome</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Créditos</div>
          <div className="col-span-2">Conexões</div>
          <div className="col-span-1">Trial até</div>
          <div className="col-span-1">Criada</div>
          <div className="col-span-3 text-right">Ações</div>
        </div>
        {loading ? (
          <div className="p-8 grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => (
              <li key={c.id} className="grid grid-cols-12 px-4 py-3 items-center text-sm">
                <div className="col-span-3 min-w-0">
                  <div className="font-medium truncate">{c.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                </div>
                <div className="col-span-1">
                  <StatusBadge s={c.status_cobranca} />
                </div>
                <div className="col-span-1 text-xs font-medium">{c.creditos_saldo ?? 0}</div>
                <div className="col-span-2 flex flex-wrap gap-1">
                  <ConnBadge label="WA" s={c.whatsapp_status} />
                  <ConnBadge label="IG" s={c.instagram_status} />
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {c.trial_ate ? new Date(c.trial_ate).toLocaleDateString("pt-BR") : "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  <div className="text-[10px]">
                    {c.ultima_atividade ? `ativ. ${new Date(c.ultima_atividade).toLocaleDateString("pt-BR")}` : "sem ativ."}
                  </div>
                </div>

                <div className="col-span-3 flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openDetails(c.id)} title="Ver detalhes">
                    <Eye className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doResetPassword(c)} title="Redefinir senha do responsável">
                    <KeyRound className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doGrantCredits(c)} title="Créditos de IA">
                    <Sparkles className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doExtend(c)} title="Estender trial">
                    <CalendarClock className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleSuspend(c)}
                    title={c.status_cobranca === "suspenso" ? "Reativar" : "Suspender"}>
                    {c.status_cobranca === "suspenso" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  </Button>
                  <Button size="sm" onClick={() => impersonate(c.id)} title="Entrar como">
                    <LogIn className="size-3.5 mr-1" /> Entrar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Anterior</Button>
          <span className="text-muted-foreground">Página {page + 1} de {pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1}>Próxima</Button>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da empresa</DialogTitle>
          </DialogHeader>
          {detailLoading || detail?.loading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : detail?.company ? (
            <div className="space-y-5 text-sm">
              <Section title="Empresa">
                <Field k="Nome" v={detail.company.nome} />
                <Field k="Slug" v={detail.company.slug} />
                <Field k="Status" v={detail.company.status_cobranca} />
                <Field k="Email corporativo" v={detail.company.email_corporativo} />
                <Field k="Telefone" v={detail.company.telefone} />
                <Field k={detail.company.tipo_pessoa === "pf" ? "CPF" : "CNPJ"} v={detail.company.cnpj_cpf} />
                <Field k="Razão social" v={detail.company.razao_social} />
                <Field
                  k="Endereço"
                  v={[
                    [detail.company.rua, detail.company.numero].filter(Boolean).join(", "),
                    detail.company.complemento,
                    detail.company.bairro,
                    detail.company.cep,
                  ].filter(Boolean).join(" · ")}
                />
                <Field k="Cidade/UF" v={[detail.company.cidade, detail.company.estado].filter(Boolean).join(" / ")} />
                <Field k="Segmento" v={detail.company.segmento} />
                <Field k="Trial até" v={detail.company.trial_ate ? new Date(detail.company.trial_ate).toLocaleString("pt-BR") : "—"} />
                <Field k="Criada" v={new Date(detail.company.created_at).toLocaleString("pt-BR")} />
              </Section>

              <Section title="Créditos de IA">
                <Field k="Saldo atual" v={String(detail.credits?.saldo ?? 0)} />
                <Field k="Origem" v={detail.credits?.origem} />
                <Field k="Consumo (últ. movimentações)" v={String(detail.credits?.consumo_recente ?? 0)} />
                <Field k="Resetam em" v={detail.credits?.resetam_em ? new Date(detail.credits.resetam_em).toLocaleString("pt-BR") : "—"} />
                <div className="col-span-2 space-y-1 mt-1">
                  {detail.credits?.ledger?.length ? detail.credits.ledger.map((l: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border rounded-md px-3 py-1.5 text-xs">
                      <span className="truncate">
                        {new Date(l.created_at).toLocaleString("pt-BR")} · {l.motivo}{l.ref ? ` (${l.ref})` : ""}
                      </span>
                      <span className={l.delta < 0 ? "text-destructive font-medium" : "text-primary font-medium"}>
                        {l.delta > 0 ? `+${l.delta}` : l.delta} → {l.saldo_apos}
                      </span>
                    </div>
                  )) : <div className="text-muted-foreground text-xs">Sem movimentações.</div>}
                </div>
                <div className="col-span-2">
                  <Button size="sm" variant="outline" onClick={() => doGrantCredits({ ...detail.company, creditos_saldo: detail.credits?.saldo ?? 0 })}>
                    <Sparkles className="size-3.5 mr-1" /> Ajustar créditos
                  </Button>
                </div>
              </Section>

              <Section title="Conexões">
                <div className="col-span-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">WhatsApp:</span>
                    {detail.whatsapp?.length ? detail.whatsapp.map((w: any) => (
                      <span key={w.instance_name} className="flex items-center gap-1">
                        <ConnBadge label="WA" s={String(w.status ?? "").toLowerCase() === "connected" || String(w.status ?? "").toLowerCase() === "open" ? "connected" : "disconnected"} />
                        <span className="text-muted-foreground">
                          {w.numero || w.instance_name} · atualizado {w.updated_at ? new Date(w.updated_at).toLocaleString("pt-BR") : "—"}
                        </span>
                      </span>
                    )) : <ConnBadge label="WA" s="unset" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">Instagram:</span>
                    {detail.instagram ? (
                      <span className="flex items-center gap-1">
                        <ConnBadge label="IG" s={detail.instagram.status} />
                        <span className="text-muted-foreground">
                          {detail.instagram.username ? `@${detail.instagram.username}` : "—"} · atualizado{" "}
                          {detail.instagram.updated_at ? new Date(detail.instagram.updated_at).toLocaleString("pt-BR") : "—"}
                        </span>
                      </span>
                    ) : <ConnBadge label="IG" s="unset" />}
                  </div>
                </div>
              </Section>

              <Section title="Assinatura">
                {detail.subscription ? (
                  <>
                    <Field k="Plano" v={detail.subscription.plan?.nome ?? "—"} />
                    <Field k="Status" v={detail.subscription.status} />
                    <Field k="Provider" v={detail.subscription.provider ?? "—"} />
                    <Field k="ID externo" v={detail.subscription.external_subscription_id ?? "—"} />
                    <Field k="Email do comprador" v={detail.subscription.buyer_email ?? "—"} />
                    <Field k="Período atual até" v={detail.subscription.current_period_end ? new Date(detail.subscription.current_period_end).toLocaleString("pt-BR") : "—"} />
                  </>
                ) : (
                  <div className="text-muted-foreground col-span-2">Sem assinatura.</div>
                )}
              </Section>

              <Section title="Alterar plano">
                <div className="col-span-2 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Plano atual: <strong>{detail.subscription?.plan?.nome ?? "—"}</strong>
                    {detail.subscription?.provider && detail.subscription.provider !== "manual" && (
                      <> · assinatura gerenciada por <strong>{detail.subscription.provider}</strong>: a alteração é apenas administrativa (sem sincronizar com o gateway).</>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Select value={newPlanId} onValueChange={setNewPlanId}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Novo plano" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={savePlan} disabled={!newPlanId || savingPlan}>
                      {savingPlan ? <Loader2 className="size-3.5 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              </Section>

              <Section title="Usuários">
                <div className="col-span-2 space-y-1">
                  {detail.members?.length ? detail.members.map((m: any) => (
                    <div key={m.user_id} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.profile?.nome || m.profile?.email || m.user_id}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m.profile?.email}{m.profile?.telefone ? ` · ${m.profile.telefone}` : ""}
                        </div>
                      </div>
                      <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
                    </div>
                  )) : <div className="text-muted-foreground">Nenhum usuário.</div>}
                </div>
              </Section>

              <Section title="Uso">
                <Field k="Mensagens" v={String(detail.stats.mensagens)} />
                <Field k="Cards CRM" v={String(detail.stats.cards)} />
              </Section>

            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="truncate">{v || "—"}</span>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  if (s === "ativo") return <Badge className="bg-primary">Ativa</Badge>;
  if (s === "trial") return <Badge variant="secondary">Trial</Badge>;
  return <Badge variant="destructive">Suspensa</Badge>;
}

function ConnBadge({ label, s }: { label: string; s?: string }) {
  if (s === "connected") return <Badge className="bg-primary text-[10px]">{label} conectado</Badge>;
  if (s === "disconnected") return <Badge variant="destructive" className="text-[10px]">{label} desconectado</Badge>;
  return <Badge variant="outline" className="text-[10px]">{label} não configurado</Badge>;
}
