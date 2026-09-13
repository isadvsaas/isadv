// BLOCO 6 — Super admin: gestão dos templates globais de agentes.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Star, Package } from "lucide-react";
import { brand } from "@/config/brand";
import {
  adminListTemplates, adminSaveTemplate, adminToggleTemplate, adminDeleteTemplate,
  type AgentTemplate, type TemplateField, type TemplateInput,
} from "@/lib/agent-catalog.functions";

export const Route = createFileRoute("/master/templates")({
  head: () => ({
    meta: [
      { title: `${brand.name} — Templates de agentes` },
      { name: "description", content: "Gerencie os modelos globais de agentes de IA disponíveis no catálogo." },
      { property: "og:title", content: `${brand.name} — Templates de agentes` },
      { property: "og:description", content: "Administração dos modelos globais de agentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasterTemplatesPage,
});

const ALL_TOOLS = ["atualizar_lead", "qualificar_lead", "mover_pipeline", "transferir_humano", "finalizar_lead"];
const FIELD_TYPES = ["string", "number", "date", "boolean", "select"];

type Draft = TemplateInput;

function emptyDraft(): Draft {
  return {
    nome: "",
    categoria: "geral",
    descricao_curta: "",
    descricao: "",
    prompt_base: "",
    provider_default: "openai",
    model_default: "gpt-4o-mini",
    ativo: true,
    destaque: false,
    channels_supported: ["whatsapp"],
    default_tools: ["atualizar_lead", "transferir_humano"],
    recommended_stages: [],
    recommended_followup: null,
    fields: [],
  };
}

function MasterTemplatesPage() {
  const fetchAll = useServerFn(adminListTemplates);
  const save = useServerFn(adminSaveTemplate);
  const toggle = useServerFn(adminToggleTemplate);
  const remove = useServerFn(adminDeleteTemplate);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await fetchAll();
      setTemplates(r.templates);
      setFields(r.fields);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function edit(t: AgentTemplate) {
    setDraft({
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      categoria: t.categoria,
      descricao_curta: t.descricao_curta ?? "",
      descricao: t.descricao ?? "",
      prompt_base: t.prompt_base ?? "",
      provider_default: t.provider_default,
      model_default: t.model_default,
      ativo: t.ativo,
      destaque: t.destaque,
      channels_supported: t.channels_supported,
      default_tools: t.default_tools,
      recommended_stages: t.recommended_stages ?? [],
      recommended_followup: t.recommended_followup ?? null,
      fields: fields
        .filter((f) => f.template_id === t.id)
        .map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description ?? "",
          field_type: f.field_type,
          required: f.required,
        })),
    });
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await save({ data: draft });
      toast.success("Template salvo");
      setDraft(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function patch(p: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Package className="size-6" /> Templates de agentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos globais do catálogo. Editar aqui não altera agentes já instalados nas empresas.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4 mr-1.5" /> Novo template
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{t.nome}</h3>
                  <Badge variant="secondary" className="text-[11px]">{t.categoria}</Badge>
                  {t.destaque && <Star className="size-3.5 text-amber-500" />}
                  {!t.ativo && <Badge variant="outline" className="text-[11px]">Oculto</Badge>}
                </div>
                <p className="text-[12.5px] text-muted-foreground line-clamp-1">{t.descricao_curta}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {fields.filter((f) => f.template_id === t.id).length} campos · {t.default_tools.length} ferramentas ·{" "}
                  {t.channels_supported.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  Ativo
                  <Switch
                    checked={t.ativo}
                    onCheckedChange={async (v) => {
                      await toggle({ data: { id: t.id, ativo: v } });
                      setTemplates((p) => p.map((x) => (x.id === t.id ? { ...x, ativo: v } : x)));
                    }}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  await toggle({ data: { id: t.id, destaque: !t.destaque } });
                  setTemplates((p) => p.map((x) => (x.id === t.id ? { ...x, destaque: !t.destaque } : x)));
                }}>
                  <Star className={`size-4 ${t.destaque ? "text-amber-500" : ""}`} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => edit(t)}>Editar</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm(`Excluir o template ${t.nome}? Agentes já instalados continuam funcionando.`)) return;
                    try {
                      await remove({ data: { id: t.id } });
                      toast.success("Template excluído");
                      await reload();
                    } catch (e: any) {
                      toast.error(e?.message);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={draft.nome} onChange={(e) => patch({ nome: e.target.value })} placeholder="Agente Comercial" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={draft.categoria} onChange={(e) => patch({ categoria: e.target.value })} placeholder="comercial" />
                </div>
              </div>
              <div>
                <Label>Descrição curta (card do catálogo)</Label>
                <Input value={draft.descricao_curta} onChange={(e) => patch({ descricao_curta: e.target.value })} />
              </div>
              <div>
                <Label>Descrição completa</Label>
                <Textarea rows={3} value={draft.descricao} onChange={(e) => patch({ descricao: e.target.value })} />
              </div>
              <div>
                <Label>Prompt base</Label>
                <Textarea
                  rows={6}
                  value={draft.prompt_base}
                  onChange={(e) => patch({ prompt_base: e.target.value })}
                  placeholder="Você é um agente comercial responsável por..."
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Provider padrão</Label>
                  <Input value={draft.provider_default} onChange={(e) => patch({ provider_default: e.target.value })} />
                </div>
                <div>
                  <Label>Modelo padrão</Label>
                  <Input value={draft.model_default} onChange={(e) => patch({ model_default: e.target.value })} />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Canais suportados</Label>
                <div className="flex gap-4">
                  {["whatsapp", "instagram"].map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={draft.channels_supported.includes(c)}
                        onCheckedChange={(v) =>
                          patch({
                            channels_supported: v
                              ? [...draft.channels_supported, c]
                              : draft.channels_supported.filter((x) => x !== c),
                          })
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Ferramentas liberadas</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ALL_TOOLS.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={draft.default_tools.includes(t)}
                        onCheckedChange={(v) =>
                          patch({
                            default_tools: v ? [...draft.default_tools, t] : draft.default_tools.filter((x) => x !== t),
                          })
                        }
                      />
                      <code className="text-[12px]">{t}</code>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Campos coletados</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ fields: [...draft.fields, { key: "", label: "", field_type: "string", required: false }] })
                    }
                  >
                    <Plus className="size-3.5 mr-1" /> Campo
                  </Button>
                </div>
                <div className="space-y-2">
                  {draft.fields.map((f, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2 items-center">
                      <Input
                        placeholder="chave"
                        value={f.key}
                        onChange={(e) => {
                          const next = [...draft.fields];
                          next[i] = { ...f, key: e.target.value };
                          patch({ fields: next });
                        }}
                      />
                      <Input
                        placeholder="Rótulo"
                        value={f.label}
                        onChange={(e) => {
                          const next = [...draft.fields];
                          next[i] = { ...f, label: e.target.value };
                          patch({ fields: next });
                        }}
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={f.field_type}
                        onChange={(e) => {
                          const next = [...draft.fields];
                          next[i] = { ...f, field_type: e.target.value };
                          patch({ fields: next });
                        }}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => patch({ fields: draft.fields.filter((_, x) => x !== i) })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Pipeline recomendado (uma etapa por linha)</Label>
                <Textarea
                  rows={3}
                  value={draft.recommended_stages.map((s) => s.nome).join("\n")}
                  onChange={(e) =>
                    patch({
                      recommended_stages: e.target.value
                        .split("\n")
                        .map((n) => n.trim())
                        .filter(Boolean)
                        .map((nome) => ({ nome })),
                    })
                  }
                  placeholder={"Novo lead\nQualificado\nProposta"}
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.ativo} onCheckedChange={(v) => patch({ ativo: v })} /> Visível no catálogo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.destaque} onCheckedChange={(v) => patch({ destaque: v })} /> Destaque
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
