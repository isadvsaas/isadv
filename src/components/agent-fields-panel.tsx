// ETAPA 5 — UI amigável para agent_custom_fields (estrutura e tipos preservados).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABEL: Array<[string, string]> = [
  ["string", "Texto"],
  ["number", "Número"],
  ["boolean", "Sim ou não"],
  ["date", "Data"],
  ["datetime", "Data e hora"],
  ["select", "Escolha única"],
  ["multiselect", "Várias escolhas"],
];

function keyFromLabel(label: string, fallback: string) {
  const k = (label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 40);
  return k || fallback;
}

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

export function AgentFieldsPanel({ companyId, agentId }: { companyId?: string; agentId?: string }) {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, agentId]);

  async function addField() {
    if (!companyId) return;
    const label = "Nova informação";
    const { data, error } = await supabase
      .from("agent_custom_fields")
      .insert({
        company_id: companyId,
        agent_id: agentId ?? null,
        key: keyFromLabel(label, `campo_${fields.length + 1}`) + `_${fields.length + 1}`,
        label,
        field_type: "string",
        sort_order: fields.length,
      })
      .select("id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    await reload();
    if (data?.id) setOpenId(data.id);
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O que esse atendente precisa descobrir durante a conversa?
      </p>

      {loading ? (
        <div className="grid place-items-center h-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada por aqui ainda. Exemplos comuns: nome, telefone, cidade, tipo de serviço, orçamento.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)]">
              <button
                type="button"
                onClick={() => setOpenId(openId === f.id ? null : f.id)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium block truncate">{f.label || "Sem nome"}</span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABEL.find(([k]) => k === f.field_type)?.[1] ?? "Texto"}
                    {f.required ? " · obrigatório" : ""}
                    {!f.active ? " · desativado" : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {openId === f.id ? "fechar" : "editar"}
                </span>
              </button>

              {openId === f.id && (
                <div className="border-t border-[var(--border)] p-3 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome da informação</Label>
                      <Input value={f.label} onChange={(e) => updField(f.id, { label: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de resposta</Label>
                      <Select value={f.field_type} onValueChange={(v) => updField(f.id, { field_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPE_LABEL.map(([k, l]) => (
                            <SelectItem key={k} value={k}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Como o atendente deve perguntar (opcional)</Label>
                    <Input
                      value={f.description ?? ""}
                      placeholder="Ex: pergunte em qual cidade o cliente está"
                      onChange={(e) => updField(f.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-5 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={f.required} onCheckedChange={(v) => updField(f.id, { required: v })} /> Sempre perguntar
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={f.active} onCheckedChange={(v) => updField(f.id, { active: v })} /> Ativo
                    </label>
                    <Button size="sm" variant="ghost" className="text-destructive sm:ml-auto" onClick={() => delField(f.id)}>
                      <Trash2 className="size-3.5 mr-1.5" /> Remover
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full sm:w-auto" onClick={addField}>
        <Plus className="size-4 mr-1.5" /> Adicionar informação
      </Button>
    </div>
  );
}
