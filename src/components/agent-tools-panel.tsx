// BLOCO 2 — Administração mínima de Tools permitidas e Campos coletados do agente.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TOOLS: Array<[string, string]> = [
  ["atualizar_lead", "Atualizar lead"],
  ["qualificar_lead", "Qualificar lead"],
  ["mover_pipeline", "Mover pipeline"],
  ["transferir_humano", "Transferir humano"],
  ["finalizar_lead", "Finalizar lead"],
];

const TYPES = ["string", "number", "boolean", "date", "datetime", "select", "multiselect"];

type FieldRow = {
  id: string;
  key: string;
  label: string;
  description: string;
  field_type: string;
  required: boolean;
  active: boolean;
  sort_order: number;
};

export function AgentToolsPanel({
  companyId,
  agentId,
  allowedTools,
  onChangeTools,
}: {
  companyId?: string;
  agentId?: string;
  allowedTools: string[];
  onChangeTools: (v: string[]) => void;
}) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!companyId) return;
    const { data } = await supabase
      .from("agent_custom_fields")
      .select("id, key, label, description, field_type, required, active, sort_order")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    setFields((data ?? []) as FieldRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void reload();
  }, [companyId, agentId]);

  function toggleTool(t: string, on: boolean) {
    const set = new Set(allowedTools ?? []);
    if (on) set.add(t);
    else set.delete(t);
    onChangeTools(Array.from(set));
  }

  async function addField() {
    if (!companyId) return;
    const key = `campo_${fields.length + 1}`;
    const { error } = await supabase.from("agent_custom_fields").insert({
      company_id: companyId,
      agent_id: agentId ?? null,
      key,
      label: "Novo campo",
      field_type: "string",
      sort_order: fields.length,
    });
    if (error) return toast.error(error.message);
    reload();
  }
  async function updField(id: string, patch: Partial<FieldRow>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const { error } = await supabase.from("agent_custom_fields").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function delField(id: string) {
    await supabase.from("agent_custom_fields").delete().eq("id", id);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Tools permitidas</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          {TOOLS.map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
              <span className="text-sm">{l}</span>
              <Switch checked={(allowedTools ?? []).includes(k)} onCheckedChange={(v) => toggleTool(k, v)} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A IA só executa as ações marcadas aqui. O servidor valida a permissão em cada chamada.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Campos coletados</h4>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="size-3.5 mr-1.5" /> Adicionar campo
          </Button>
        </div>
        {loading ? (
          <div className="grid place-items-center h-16 text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo personalizado. A IA só salva campos definidos aqui.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Chave</Label>
                    <Input value={f.key} onChange={(e) => updField(f.id, { key: e.target.value.trim() })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={f.label} onChange={(e) => updField(f.id, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={f.field_type} onValueChange={(v) => updField(f.id, { field_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição (ajuda a IA a saber o que perguntar)</Label>
                  <Input value={f.description ?? ""} onChange={(e) => updField(f.id, { description: e.target.value })} />
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={f.required} onCheckedChange={(v) => updField(f.id, { required: v })} /> Obrigatório
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={f.active} onCheckedChange={(v) => updField(f.id, { active: v })} /> Ativo
                  </label>
                  <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => delField(f.id)}>
                    <Trash2 className="size-3.5 mr-1.5" /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
