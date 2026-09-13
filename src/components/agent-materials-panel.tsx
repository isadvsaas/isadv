// BLOCO MÍDIAS — Biblioteca de materiais da empresa (UI simples para o dono do negócio).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Image as ImageIcon, FileText, Video, Music, Link2, Plus } from "lucide-react";
import { listMaterials, saveMaterial, toggleMaterial, deleteMaterial, type Material, type MaterialTipo } from "@/lib/materials.functions";

const TIPOS: Array<[MaterialTipo, string]> = [
  ["image", "Imagem"],
  ["document", "Documento (PDF)"],
  ["video", "Vídeo"],
  ["audio", "Áudio"],
  ["link", "Link"],
];

export function tipoIcon(tipo: string) {
  if (tipo === "image") return ImageIcon;
  if (tipo === "video") return Video;
  if (tipo === "audio") return Music;
  if (tipo === "link") return Link2;
  return FileText;
}

export function uploadMaterialFile(companyId: string, file: File) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return supabase.storage
    .from("materiais")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
    .then(({ error }) => {
      if (error) throw new Error(error.message);
      return path;
    });
}

export function AgentMaterialsPanel({ companyId, agentId }: { companyId?: string; agentId?: string }) {
  const doList = useServerFn(listMaterials);
  const doSave = useServerFn(saveMaterial);
  const doToggle = useServerFn(toggleMaterial);
  const doDelete = useServerFn(deleteMaterial);

  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    try {
      setItems(await doList({}));
    } catch (e: any) {
      toast.error(e?.message);
    }
    setLoading(false);
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function novo() {
    setForm({ nome: "", descricao: "", tipo: "image", externalUrl: "", storagePath: null, mimeType: null, fileName: null, somenteEste: false });
  }

  async function pickFile(f: File | null) {
    if (!f || !companyId) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("Arquivo muito grande. O limite é 25 MB.");
    setBusy(true);
    try {
      const path = await uploadMaterialFile(companyId, f);
      setForm((p: any) => ({ ...p, storagePath: path, mimeType: f.type, fileName: f.name }));
      toast.success("Arquivo carregado");
    } catch (e: any) {
      toast.error(e?.message);
    }
    setBusy(false);
  }

  async function salvar() {
    setBusy(true);
    try {
      await doSave({
        data: {
          id: form.id ?? null,
          nome: form.nome,
          descricao: form.descricao,
          tipo: form.tipo,
          agentId: form.somenteEste && agentId ? agentId : null,
          storagePath: form.storagePath,
          externalUrl: form.externalUrl,
          mimeType: form.mimeType,
          fileName: form.fileName,
        },
      });
      toast.success("Material salvo");
      setForm(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message);
    }
    setBusy(false);
  }

  if (loading) return <div className="grid place-items-center h-24 text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Materiais que o atendente pode enviar</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cadastre catálogo, tabela de preços, fotos, vídeos e áudios. Explique <b>quando usar</b> cada um: é assim que o atendente decide o momento certo de enviar.
        </p>
      </div>

      {items.length === 0 && !form && (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
          Nenhum material cadastrado ainda.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((m) => {
          const Icon = tipoIcon(m.tipo);
          return (
            <li key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 flex items-start gap-3">
              <Icon className="size-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.nome}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{m.descricao || "Sem instrução de uso."}</p>
                {m.agent_id && <p className="text-[11px] text-muted-foreground mt-1">Exclusivo deste atendente</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={m.ativo}
                  onCheckedChange={async (v) => {
                    setItems((p) => p.map((x) => (x.id === m.id ? { ...x, ativo: v } : x)));
                    try {
                      await doToggle({ data: { id: m.id, ativo: v } });
                    } catch (e: any) {
                      toast.error(e?.message);
                      void reload();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      id: m.id,
                      nome: m.nome,
                      descricao: m.descricao,
                      tipo: m.tipo,
                      externalUrl: m.external_url ?? "",
                      storagePath: m.storage_path,
                      mimeType: m.mime_type,
                      fileName: m.file_name,
                      somenteEste: !!m.agent_id,
                    })
                  }
                >
                  <FileText className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Excluir "${m.nome}"?`)) return;
                    try {
                      await doDelete({ data: { id: m.id } });
                      await reload();
                    } catch (e: any) {
                      toast.error(e?.message);
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {form ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do material</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Catálogo de produtos" />
          </div>
          <div className="space-y-1.5">
            <Label>Quando o atendente deve enviar</Label>
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex.: quando o cliente pedir preços ou quiser ver os modelos disponíveis"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.tipo === "link" ? (
            <div className="space-y-1.5">
              <Label>Link</Label>
              <Input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://..." />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Arquivo (até 25 MB)</Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />} Escolher arquivo
                </Button>
                <span className="text-xs text-muted-foreground truncate">{form.fileName || (form.storagePath ? "Arquivo salvo" : "Nenhum arquivo")}</span>
              </div>
            </div>
          )}

          {agentId && (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">Somente este atendente</p>
                <p className="text-xs text-muted-foreground">Desligado, todos os seus atendentes podem enviar.</p>
              </div>
              <Switch checked={!!form.somenteEste} onCheckedChange={(v) => setForm({ ...form, somenteEste: v })} />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-1.5 animate-spin" />} Salvar material
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={novo}>
          <Plus className="size-4 mr-1.5" /> Adicionar material
        </Button>
      )}
    </div>
  );
}
