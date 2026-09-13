import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, saveTemplate, deleteTemplate, type MessageTemplate } from "@/lib/templates.functions";

export function TemplatesTab() {
  const fetcher = useServerFn(listTemplates);
  const saver = useServerFn(saveTemplate);
  const remover = useServerFn(deleteTemplate);
  const [list, setList] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; atalho: string; texto: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setList(await fetcher());
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line
  }, []);

  async function onSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await saver({ data: editing });
      setEditing(null);
      toast.success("Template salvo");
      await reload();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Excluir template?")) return;
    try {
      await remover({ data: { id } });
      toast.success("Excluído");
      await reload();
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Templates de mensagem</h2>
          <p className="text-xs text-muted-foreground">
            Atalhos rápidos pra usar nas conversas. Digite <code>/</code> no campo de mensagem para abrir.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ atalho: "", texto: "" })}>
          <Plus className="size-4 mr-1.5" /> Novo
        </Button>
      </div>

      {editing && (
        <Card className="p-4 space-y-3">
          <div className="grid sm:grid-cols-[200px_1fr] gap-3">
            <div>
              <Label>Atalho</Label>
              <Input
                value={editing.atalho}
                onChange={(e) => setEditing({ ...editing, atalho: e.target.value })}
                placeholder="saudacao"
              />
              <p className="text-[10.5px] text-muted-foreground mt-1">só letras/números/_/-</p>
            </div>
            <div>
              <Label>Texto</Label>
              <Textarea
                rows={3}
                value={editing.texto}
                onChange={(e) => setEditing({ ...editing, texto: e.target.value })}
                placeholder="Olá! Em que posso ajudar?"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template ainda.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id} className="border rounded-md p-3 flex items-start gap-3">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono shrink-0">/{t.atalho}</code>
              <p className="text-sm flex-1 whitespace-pre-wrap">{t.texto}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: t.id, atalho: t.atalho, texto: t.texto })}>
                  editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)} className="text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
