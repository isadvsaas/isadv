// BLOCO 3 — Configuração da cadência de follow-up automático do agente.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type Seq = {
  id: string;
  nome: string;
  ativo: boolean;
  eligible_stage_ids: string[] | null;
  timezone: string;
  allowed_start_time: string;
  allowed_end_time: string;
  final_action: string;
  final_stage_id: string | null;
};
type Step = {
  id: string;
  ordem: number;
  delay_value: number;
  delay_unit: string;
  message_mode: string;
  message_template: string;
  move_stage_id: string | null;
  finalize: boolean;
  active: boolean;
};
type Stage = { id: string; nome: string };

const UNITS: Array<[string, string]> = [
  ["minutes", "minutos"],
  ["hours", "horas"],
  ["days", "dias"],
];
const MODES: Array<[string, string]> = [
  ["ai", "Gerada pela IA"],
  ["template", "Mensagem fixa"],
  ["none", "Sem mensagem"],
];
const FINAL_ACTIONS: Array<[string, string]> = [
  ["none", "Nenhuma ação"],
  ["stop", "Só encerrar o follow-up (manter lead aberto)"],
  ["move_stage", "Mover para uma etapa"],
  ["finalize", "Finalizar o lead"],
];
const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Bahia", "UTC"];

export function AgentFollowupPanel({ companyId, agentId }: { companyId?: string; agentId?: string }) {
  const [seq, setSeq] = useState<Seq | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!companyId) return;
    const [{ data: seqs }, { data: st }] = await Promise.all([
      supabase.from("followup_sequence").select("*").eq("company_id", companyId),
      supabase.from("crm_stage").select("id, nome").eq("company_id", companyId).order("ordem", { ascending: true }),
    ]);
    setStages((st ?? []) as Stage[]);
    const list = (seqs ?? []) as any[];
    const mine = (agentId ? list.find((s) => s.agent_id === agentId) : null) ?? list.find((s) => s.agent_id === null) ?? list[0] ?? null;
    setSeq(mine as Seq | null);
    if (mine) {
      const { data: sp } = await supabase
        .from("followup_step")
        .select("*")
        .eq("sequence_id", mine.id)
        .order("ordem", { ascending: true });
      setSteps((sp ?? []) as Step[]);
    } else {
      setSteps([]);
    }
    setLoading(false);
  }
  useEffect(() => { void reload(); }, [companyId, agentId]);

  async function createSeq() {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("followup_sequence")
      .insert({ company_id: companyId, agent_id: agentId ?? null, nome: "Follow-up", ativo: false })
      .select("*")
      .maybeSingle();
    if (error) return toast.error(error.message);
    setSeq(data as any);
    reload();
  }

  async function updSeq(patch: Partial<Seq>) {
    if (!seq) return;
    setSeq({ ...seq, ...patch } as Seq);
    const { error } = await supabase.from("followup_sequence").update(patch as any).eq("id", seq.id);
    if (error) toast.error(error.message);
  }

  async function addStep() {
    if (!seq || !companyId) return;
    const { error } = await supabase.from("followup_step").insert({
      sequence_id: seq.id,
      company_id: companyId,
      ordem: steps.length,
      delay_value: 30,
      delay_unit: "minutes",
      message_mode: "ai",
      message_template: "",
    });
    if (error) return toast.error(error.message);
    reload();
  }
  async function updStep(id: string, patch: Partial<Step>) {
    setSteps((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("followup_step").update(patch as any).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function delStep(id: string) {
    await supabase.from("followup_step").delete().eq("id", id);
    reload();
  }
  async function moveStep(index: number, dir: -1 | 1) {
    const a = steps[index];
    const b = steps[index + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("followup_step").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("followup_step").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    reload();
  }

  function toggleStage(id: string, on: boolean) {
    const set = new Set(seq?.eligible_stage_ids ?? []);
    if (on) set.add(id); else set.delete(id);
    updSeq({ eligible_stage_ids: Array.from(set) });
  }

  if (loading) {
    return <div className="grid place-items-center h-20 text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>;
  }

  if (!seq) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Se o cliente parar de responder, o {"AtendZap"} pode entrar em contato novamente automaticamente.
        </p>
        <Button onClick={createSeq} className="w-full sm:w-auto"><Plus className="size-4 mr-1.5" /> Ativar lembretes automáticos</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Lembretes automáticos</p>
          <p className="text-xs text-muted-foreground">
            Se o cliente parar de responder, o atendente entra em contato novamente.
          </p>
        </div>
        <Switch className="shrink-0" checked={seq.ativo} onCheckedChange={(v) => updSeq({ ativo: v })} />
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          O tempo de cada lembrete conta a partir do anterior (o 1º conta da última mensagem do cliente).
        </p>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lembrete ainda. Adicione o primeiro.</p>
        ) : (
          steps.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{i + 1}º lembrete</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveStep(i, -1)}><ArrowUp className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}><ArrowDown className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => delStep(s.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Depois de</Label>
                  <Input
                    type="number"
                    min={1}
                    value={s.delay_value}
                    onChange={(e) => updStep(s.id, { delay_value: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tempo</Label>
                  <Select value={s.delay_unit} onValueChange={(v) => updStep(s.id, { delay_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mensagem</Label>
                  <Select value={s.message_mode} onValueChange={(v) => updStep(s.id, { message_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MODES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {s.message_mode !== "none" && (
                <div className="space-y-1">
                  <Label className="text-xs">
                    {s.message_mode === "template" ? "Mensagem enviada" : "Como o atendente deve retomar a conversa"}
                  </Label>
                  <Textarea
                    rows={2}
                    value={s.message_template ?? ""}
                    placeholder={s.message_mode === "template" ? "Oi! Ainda tem interesse?" : "Retome a conversa de forma curta e natural."}
                    onChange={(e) => updStep(s.id, { message_template: e.target.value })}
                  />
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Mover cliente para (opcional)</Label>
                  <Select value={s.move_stage_id ?? "none"} onValueChange={(v) => updStep(s.id, { move_stage_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mover</SelectItem>
                      {stages.map((st) => <SelectItem key={st.id} value={st.id}>{st.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={s.finalize} onCheckedChange={(v) => updStep(s.id, { finalize: v })} /> Encerrar depois deste
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={s.active} onCheckedChange={(v) => updStep(s.id, { active: v })} /> Ativo
                  </label>
                </div>
              </div>
            </div>
          ))
        )}
        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={addStep}>
          <Plus className="size-3.5 mr-1.5" /> Adicionar lembrete
        </Button>
      </div>

      <Collapsible>
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">
            Opções avançadas
            <ChevronDown className="size-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-[var(--border)] p-3 space-y-5">
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Enviar a partir de</Label>
                <Input type="time" value={(seq.allowed_start_time ?? "08:00").slice(0, 5)} onChange={(e) => updSeq({ allowed_start_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Enviar até</Label>
                <Input type="time" value={(seq.allowed_end_time ?? "20:00").slice(0, 5)} onChange={(e) => updSeq({ allowed_end_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fuso horário</Label>
                <Select value={seq.timezone} onValueChange={(v) => updSeq({ timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Etapas do funil que recebem lembrete</h4>
              <p className="text-xs text-muted-foreground">Nenhuma marcada = todas participam.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {stages.map((st) => (
                  <label key={st.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                    <span className="text-sm truncate">{st.nome}</span>
                    <Switch className="shrink-0" checked={(seq.eligible_stage_ids ?? []).includes(st.id)} onCheckedChange={(v) => toggleStage(st.id, v)} />
                  </label>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Depois do último lembrete</Label>
                <Select value={seq.final_action} onValueChange={(v) => updSeq({ final_action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FINAL_ACTIONS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {seq.final_action === "move_stage" && (
                <div className="space-y-1">
                  <Label className="text-xs">Etapa final</Label>
                  <Select value={seq.final_stage_id ?? "none"} onValueChange={(v) => updSeq({ final_stage_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecionar…</SelectItem>
                      {stages.map((st) => <SelectItem key={st.id} value={st.id}>{st.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <p className="text-xs text-muted-foreground">
        Os lembretes param automaticamente quando o cliente responde, quando alguém da equipe assume a conversa ou quando o atendimento é finalizado.
      </p>
    </div>
  );
}

