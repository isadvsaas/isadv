import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { brand } from "@/config/brand";
import { toast } from "sonner";
import { Plus, Edit3, Star, Loader2, Trash2, Package } from "lucide-react";

export const Route = createFileRoute("/master/planos")({
  head: () => ({ meta: [{ title: `${brand.name} — Planos` }] }),
  component: PlanosPage,
});

type Plan = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_cents: number;
  moeda: string;
  intervalo: "month" | "year";
  trial_days: number;
  limite_mensagens: number;
  limite_instancias: number;
  limite_usuarios: number;
  limite_contatos: number;
  features: string[];
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  paddle_product_id: string | null;
  paddle_price_id: string | null;
  checkout_url: string | null;
};

const empty: Partial<Plan> = {
  slug: "",
  nome: "",
  descricao: "",
  preco_cents: 9700,
  moeda: "BRL",
  intervalo: "month",
  trial_days: 3,
  limite_mensagens: 2000,
  limite_instancias: 1,
  limite_usuarios: 2,
  limite_contatos: 1000,
  features: [],
  destaque: false,
  ativo: true,
  ordem: 0,
};

function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [featuresText, setFeaturesText] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("plan").select("*").order("ordem", { ascending: true });
    if (error) toast.error(error.message);
    setPlans((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing({ ...empty });
    setFeaturesText("");
  }
  function openEdit(p: Plan) {
    setEditing({ ...p });
    setFeaturesText((p.features || []).join("\n"));
  }

  async function save() {
    if (!editing) return;
    if (!editing.nome?.trim() || !editing.slug?.trim()) return toast.error("Nome e slug são obrigatórios");
    setSaving(true);
    const payload: any = {
      slug: editing.slug!.toLowerCase().trim(),
      nome: editing.nome!.trim(),
      descricao: editing.descricao ?? null,
      preco_cents: Number(editing.preco_cents ?? 0),
      moeda: editing.moeda ?? "BRL",
      intervalo: editing.intervalo ?? "month",
      trial_days: Number(editing.trial_days ?? 0),
      limite_mensagens: Number(editing.limite_mensagens ?? 0),
      limite_instancias: 1,
      limite_usuarios: Number(editing.limite_usuarios ?? 0),
      limite_contatos: Number(editing.limite_contatos ?? 0),
      features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
      destaque: !!editing.destaque,
      ativo: !!editing.ativo,
      ordem: Number(editing.ordem ?? 0),
      paddle_product_id: editing.paddle_product_id ?? null,
      paddle_price_id: editing.paddle_price_id ?? null,
      checkout_url: (editing.checkout_url ?? "").trim() || null,
    };
    const op = (editing as any).id
      ? supabase.from("plan").update(payload).eq("id", (editing as any).id)
      : supabase.from("plan").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plano salvo");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este plano? Empresas vinculadas perdem o vínculo.")) return;
    const { error } = await supabase.from("plan").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano excluído");
    load();
  }

  async function toggleAtivo(p: Plan) {
    const { error } = await supabase.from("plan").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">Catálogo de planos vendidos na landing page e dentro do app.</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-1.5" /> Novo plano</Button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum plano cadastrado.</Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id} className={`p-5 flex flex-col gap-3 relative ${!p.ativo ? "opacity-60" : ""}`}>
              {p.destaque && (
                <div className="absolute -top-2 right-4 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="size-3" /> Destaque
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.slug}</div>
                  <div className="text-lg font-bold truncate">{p.nome}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatBRL(p.preco_cents, p.moeda)}
                    <span className="text-xs text-muted-foreground font-normal">/{p.intervalo === "month" ? "mês" : "ano"}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.trial_days}d trial</div>
                </div>
              </div>
              {p.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>}
              <div className="grid grid-cols-2 gap-2 text-[11px] mt-1">
                <Limit label="Msgs" v={p.limite_mensagens} />
                <Limit label="WhatsApp" v={1} />
                <Limit label="Usuários" v={p.limite_usuarios} />
                <Limit label="Contatos" v={p.limite_contatos} />
              </div>
              <div className="flex items-center justify-between pt-2 mt-auto border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                  <span className="text-xs text-muted-foreground">{p.ativo ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit3 className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </div>
              </div>
              {p.checkout_url ? (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 -mt-1 truncate">
                  <Package className="size-3 shrink-0" />
                  <a href={p.checkout_url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {p.checkout_url}
                  </a>
                </div>
              ) : (
                <div className="text-[10px] text-amber-600 flex items-center gap-1.5 -mt-1">
                  <Package className="size-3" /> Sem URL de checkout — clientes não conseguem assinar
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editing as any)?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome"><Input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} /></Field>
              <Field label="Slug"><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="starter" /></Field>
              <Field label="Descrição" full>
                <Textarea rows={2} value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
              </Field>
              <Field label="Preço (centavos)"><Input type="number" value={editing.preco_cents ?? 0} onChange={(e) => setEditing({ ...editing, preco_cents: Number(e.target.value) })} /></Field>
              <Field label="Moeda"><Input value={editing.moeda ?? "BRL"} onChange={(e) => setEditing({ ...editing, moeda: e.target.value.toUpperCase() })} /></Field>
              <Field label="Intervalo">
                <select className="w-full h-10 px-3 rounded-md border bg-background text-sm" value={editing.intervalo ?? "month"} onChange={(e) => setEditing({ ...editing, intervalo: e.target.value as any })}>
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </select>
              </Field>
              <Field label="Dias de trial"><Input type="number" value={editing.trial_days ?? 0} onChange={(e) => setEditing({ ...editing, trial_days: Number(e.target.value) })} /></Field>
              <Field label="Ordem"><Input type="number" value={editing.ordem ?? 0} onChange={(e) => setEditing({ ...editing, ordem: Number(e.target.value) })} /></Field>
              <Field label="Limite msgs/mês"><Input type="number" value={editing.limite_mensagens ?? 0} onChange={(e) => setEditing({ ...editing, limite_mensagens: Number(e.target.value) })} /></Field>
              <Field label="Limite instâncias"><Input type="number" value={1} disabled /></Field>
              <Field label="Limite usuários"><Input type="number" value={editing.limite_usuarios ?? 0} onChange={(e) => setEditing({ ...editing, limite_usuarios: Number(e.target.value) })} /></Field>
              <Field label="Limite contatos"><Input type="number" value={editing.limite_contatos ?? 0} onChange={(e) => setEditing({ ...editing, limite_contatos: Number(e.target.value) })} /></Field>
              <Field label="Features (uma por linha)" full>
                <Textarea rows={5} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder="1 número de WhatsApp&#10;Integração Google Agenda&#10;..." />
              </Field>
              <Field label="URL de checkout (Kiwify / Cakto / Perfectpay)" full>
                <Input
                  value={editing.checkout_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, checkout_url: e.target.value })}
                  placeholder="https://pay.kiwify.com.br/abc123"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Link para onde o cliente é enviado ao clicar em "Assinar". O sistema adiciona o e-mail dele automaticamente
                  (<code>?email=</code>) pra liberar a assinatura quando o webhook chegar.
                </p>
              </Field>
              <div className="col-span-2 flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.destaque} onCheckedChange={(v) => setEditing({ ...editing, destaque: v })} /> Destaque (mais popular)</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} /> Ativo</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Limit({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-muted/50 rounded-md px-2 py-1.5 flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{v.toLocaleString("pt-BR")}</span>
    </div>
  );
}
function formatBRL(cents: number, moeda = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(cents / 100);
}
