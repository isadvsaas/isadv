// ETAPA 5 — Atendente IA: meus atendentes + catálogo (UI simplificada).
// Mecanismo de instalação do BLOCO 6 preservado integralmente.
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bot, Check, Loader2, Star, Trash2, Plus, Settings2, Sparkles } from "lucide-react";
import { brand } from "@/config/brand";
import {
  listCatalog, listMyAgents, installTemplate, updateMyAgent, deleteMyAgent,
  type AgentTemplate, type TemplateField, type InstalledAgent,
} from "@/lib/agent-catalog.functions";

export const Route = createFileRoute("/app/agentes")({
  head: () => ({
    meta: [
      { title: `${brand.name} — Atendente IA` },
      { name: "description", content: "Configure quem atende seus clientes por você no WhatsApp e no Instagram." },
      { property: "og:title", content: `${brand.name} — Atendente IA` },
      { property: "og:description", content: "Escolha um atendente pronto para o seu tipo de negócio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }: any) => {
    const r = context?.membership?.role;
    if (r === "atendente") throw redirect({ to: "/app/dashboard" });
  },
  component: AgentesPage,
});

function AgentesPage() {
  const fetchCatalog = useServerFn(listCatalog);
  const fetchMine = useServerFn(listMyAgents);
  const doInstall = useServerFn(installTemplate);
  const doUpdate = useServerFn(updateMyAgent);
  const doDelete = useServerFn(deleteMyAgent);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [mine, setMine] = useState<InstalledAgent[]>([]);
  const [detail, setDetail] = useState<AgentTemplate | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InstalledAgent | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [cat, agents] = await Promise.all([fetchCatalog(), fetchMine()]);
      setTemplates(cat.templates);
      setFields(cat.fields);
      setInstalledIds(cat.installedTemplateIds);
      setMine(agents);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar atendentes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldsByTemplate = useMemo(() => {
    const m = new Map<string, TemplateField[]>();
    for (const f of fields) m.set(f.template_id, [...(m.get(f.template_id) ?? []), f]);
    return m;
  }, [fields]);

  async function install(t: AgentTemplate) {
    setInstalling(t.id);
    try {
      const r = await doInstall({ data: { templateId: t.id } });
      if (r.alreadyInstalled) toast.info("Este atendente já está na sua conta.");
      else toast.success(`${t.nome} adicionado`);
      setDetail(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao adicionar");
    } finally {
      setInstalling(null);
    }
  }

  async function toggleAtivo(a: InstalledAgent, ativo: boolean) {
    try {
      await doUpdate({ data: { id: a.id, ativo } });
      setMine((prev) => prev.map((x) => (x.id === a.id ? { ...x, ativo } : x)));
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  async function makeDefault(a: InstalledAgent) {
    try {
      await doUpdate({ data: { id: a.id, makeDefault: true } });
      toast.success(`${a.nome_agente} agora é o atendente principal`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    try {
      await doDelete({ data: { id: confirmDelete.id } });
      toast.success("Atendente removido");
      setConfirmDelete(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  const ativos = mine.filter((a) => a.ativo).length;

  return (
    <div className="space-y-8 w-full min-w-0">
      <header>
        <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
          <Bot className="size-6 text-primary" /> Atendente IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure quem atende seus clientes por você.</p>
      </header>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Meus atendentes */}
          <section className="space-y-3">
            {mine.length === 0 ? (
              <Card className="p-6 sm:p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem um atendente. Escolha um pronto abaixo ou crie o seu com ajuda da IA.
                </p>
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/app/agente"><Sparkles className="size-4 mr-1.5" /> Criar meu atendente</Link>
                </Button>
              </Card>
            ) : (
              <>
                {ativos > 1 && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
                    <p className="text-sm font-medium">Atendimento inteligente ativado</p>
                    <p className="text-xs text-muted-foreground">
                      Quando você tem mais de um atendente, o {brand.name} identifica automaticamente qual deles
                      deve cuidar de cada conversa.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {mine.map((a) => (
                    <Card key={a.id} className="p-4 flex flex-col gap-3 min-w-0">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{a.nome_agente}</h3>
                          {a.is_default && <Badge className="text-[11px]">Principal</Badge>}
                          <Badge variant="secondary" className="text-[11px]">{a.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>
                        <p className="text-[13px] text-muted-foreground line-clamp-2">
                          {a.descricao || "Atende seus clientes por você."}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap mt-auto">
                        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                          <Switch checked={a.ativo} onCheckedChange={(v) => toggleAtivo(a, v)} /> Ativo
                        </label>
                        <div className="flex items-center gap-1.5">
                          {!a.is_default && (
                            <Button size="sm" variant="ghost" onClick={() => makeDefault(a)}>
                              <Star className="size-4 mr-1" /> Principal
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/app/agente/configurar" search={{ id: a.id }}>
                              <Settings2 className="size-4 mr-1" /> Configurar
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(a)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Catálogo */}
          <section className="space-y-3 border-t border-[var(--border)] pt-6">
            <div>
              <h2 className="text-lg font-display font-semibold">Adicionar atendente</h2>
              <p className="text-sm text-muted-foreground">Escolha um atendente pronto para o seu tipo de negócio.</p>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendente pronto disponível ainda.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => {
                  const installed = installedIds.includes(t.id);
                  return (
                    <Card
                      key={t.id}
                      className={`p-4 flex flex-col gap-3 min-w-0 ${t.destaque ? "border-primary/50 bg-primary/[0.04]" : ""}`}
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{t.nome}</h3>
                          {t.destaque && <Star className="size-3.5 text-amber-500 shrink-0" />}
                        </div>
                        <Badge variant="secondary" className="text-[11px]">{t.categoria}</Badge>
                      </div>
                      <p className="text-[13px] text-muted-foreground line-clamp-3 flex-1">
                        {t.descricao_curta || t.descricao}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="px-2" onClick={() => setDetail(t)}>
                          Saber mais
                        </Button>
                        {installed ? (
                          <Button size="sm" variant="ghost" disabled className="ml-auto text-emerald-600">
                            <Check className="size-4 mr-1" /> Adicionado
                          </Button>
                        ) : (
                          <Button size="sm" className="ml-auto" onClick={() => install(t)} disabled={installing === t.id}>
                            {installing === t.id ? (
                              <Loader2 className="size-4 mr-1 animate-spin" />
                            ) : (
                              <Plus className="size-4 mr-1" />
                            )}
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Detalhes do atendente pronto */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.nome}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Para que serve</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{detail.descricao || detail.descricao_curta}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Especialidade</h4>
                <p className="text-muted-foreground">{detail.categoria}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">O que ele descobre com o cliente</h4>
                {(fieldsByTemplate.get(detail.id) ?? []).length === 0 ? (
                  <p className="text-muted-foreground">Nada específico.</p>
                ) : (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {(fieldsByTemplate.get(detail.id) ?? []).map((f) => (
                      <li key={f.id}>{f.label}</li>
                    ))}
                  </ul>
                )}
              </div>
              {detail.recommended_followup?.steps?.length ? (
                <p className="text-muted-foreground">
                  Já vem com lembretes automáticos sugeridos — desligados para você revisar antes.
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>Fechar</Button>
            {detail && installedIds.includes(detail.id) ? (
              <Button disabled><Check className="size-4 mr-1.5" /> Adicionado</Button>
            ) : (
              <Button onClick={() => detail && install(detail)} disabled={!!installing}>
                {installing ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Plus className="size-4 mr-1.5" />}
                Adicionar atendente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover atendente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDelete?.nome_agente} será removido. Suas conversas e seus clientes continuam salvos.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
