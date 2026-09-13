import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2, Send, Instagram, Phone, Sparkles, Clock, User2, Tag, Target, DollarSign } from "lucide-react";
import { channelOf, contactDisplayId, channelLabel } from "@/lib/channels";

export interface LeadCard {
  id: string; numero: string; nome: string | null;
  status: string; stage_id: string | null;
  ultima_mensagem: string | null; ultima_em: string;
  observacao: string | null; valor: number | null;
  origem: string | null; owner_id: string | null;
  tags: string[]; proxima_acao: string | null; follow_up: string | null;
  custom_data?: Record<string, any> | null;
}
export interface Stage { id: string; nome: string; cor: string; }
export interface Member { user_id: string; email?: string | null; nome?: string | null; }

export function LeadDrawer({
  card, stages, members, companyId, onClose, onChanged,
}: {
  card: LeadCard | null; stages: Stage[]; members: Member[];
  companyId: string; onClose: () => void; onChanged: () => void;
}) {
  const [local, setLocal] = useState<LeadCard | null>(card);
  const [tab, setTab] = useState("resumo");
  useEffect(() => { setLocal(card); setTab("resumo"); }, [card?.id]);

  if (!card || !local) return null;

  function set<K extends keyof LeadCard>(k: K, v: LeadCard[K]) {
    setLocal((p) => (p ? { ...p, [k]: v } : p));
  }

  async function save() {
    if (!local) return;
    const stage = stages.find((s) => s.id === local.stage_id);
    const { error } = await supabase.from("crm_cards").update({
      nome: local.nome, valor: local.valor ?? 0, stage_id: local.stage_id,
      status: stage?.nome ?? local.status, origem: local.origem, owner_id: local.owner_id,
      tags: local.tags, proxima_acao: local.proxima_acao, follow_up: local.follow_up,
      observacao: local.observacao,
    }).eq("id", local.id);
    if (error) return toast.error(error.message);
    await supabase.from("lead_evento").insert({
      company_id: companyId, card_id: local.id, tipo: "atualizacao", descricao: "Dados atualizados",
    });
    toast.success("Lead atualizado");
    onChanged();
  }

  return (
    <Sheet open={!!card} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-[var(--panel)] border-l border-[var(--border)]">
        <SheetHeader className="pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={local.nome || local.numero} size={48} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{local.nome || contactDisplayId(local.numero, local.nome)}</SheetTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                {channelOf(local.numero) === "instagram"
                  ? <><Instagram className="size-3.5 text-[#C13584]" /> Instagram Direct</>
                  : <><Phone className="size-3.5 text-emerald-600" /> <span className="font-mono">{local.numero}</span></>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="dados">Informações</TabsTrigger>
            <TabsTrigger value="conversa">Conversa</TabsTrigger>
            <TabsTrigger value="hist">Histórico</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4">
            <ResumoTab card={local} stages={stages} members={members} companyId={companyId} onGoTo={setTab} />
          </TabsContent>

          <TabsContent value="dados" className="space-y-3 mt-4">
            <Field label="Nome" value={local.nome ?? ""} onChange={(v) => set("nome", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)" type="number" value={String(local.valor ?? 0)} onChange={(v) => set("valor", Number(v) || 0)} />
              <Field label="Origem" value={local.origem ?? ""} onChange={(v) => set("origem", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={local.stage_id ?? ""} onValueChange={(v) => set("stage_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.cor }} />{s.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dono</Label>
              <Select value={local.owner_id ?? "_none"} onValueChange={(v) => set("owner_id", v === "_none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem dono" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem dono</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome || m.email || m.user_id.slice(0,8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Tags (separadas por vírgula)" value={(local.tags ?? []).join(", ")}
              onChange={(v) => set("tags", v.split(",").map(s => s.trim()).filter(Boolean))} />
            <Field label="Próxima ação" value={local.proxima_acao ?? ""} onChange={(v) => set("proxima_acao", v)} />
            <Field label="Follow-up (data/hora ISO)" value={local.follow_up ?? ""} onChange={(v) => set("follow_up", v || null as any)} />
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea value={local.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} rows={3} />
            </div>
            <Button onClick={save} className="w-full"><Save className="size-4 mr-2" />Salvar</Button>
          </TabsContent>

          <TabsContent value="conversa" className="mt-4">
            <ConversaTab numero={local.numero} companyId={companyId} />
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <NotasTab cardId={local.id} companyId={companyId} />
          </TabsContent>

          <TabsContent value="hist" className="mt-4">
            <HistTab cardId={local.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ResumoTab({ card, stages, members, companyId, onGoTo }: {
  card: LeadCard; stages: Stage[]; members: Member[]; companyId: string; onGoTo: (t: string) => void;
}) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("agent_custom_fields")
        .select("key,label").eq("company_id", companyId);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { m[r.key] = r.label || r.key; });
      setLabels(m);
    })();
  }, [companyId]);

  const stage = stages.find((s) => s.id === card.stage_id) ?? null;
  const owner = members.find((m) => m.user_id === card.owner_id) ?? null;
  const coletadas = Object.entries((card.custom_data ?? {}) as Record<string, any>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {stage ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full ring-1"
            style={{ background: `color-mix(in oklab, ${stage.cor} 18%, transparent)`, color: stage.cor, borderColor: `color-mix(in oklab, ${stage.cor} 35%, transparent)` } as any}>
            <Sparkles className="size-3.5" /> {stage.nome}
          </span>
        ) : <span className="text-xs text-muted-foreground">Sem etapa no funil</span>}
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[var(--panel-2)] border border-[var(--border)] text-muted-foreground">
          {channelOf(card.numero) === "instagram" ? <Instagram className="size-3" /> : <Phone className="size-3" />}
          {channelLabel(channelOf(card.numero))}
        </span>
      </div>

      <dl className="grid gap-2">
        <Row icon={<Clock className="size-3.5" />} label="Último contato"
          value={new Date(card.ultima_em).toLocaleString("pt-BR")} />
        {owner && <Row icon={<User2 className="size-3.5" />} label="Responsável" value={owner.nome || owner.email || "—"} />}
        {(card.valor ?? 0) > 0 && (
          <Row icon={<DollarSign className="size-3.5" />} label="Oportunidade"
            value={`R$ ${Number(card.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        )}
        {card.proxima_acao && <Row icon={<Target className="size-3.5" />} label="Próxima ação" value={card.proxima_acao} />}
        {card.origem && <Row icon={<Tag className="size-3.5" />} label="Origem" value={card.origem} />}
      </dl>

      {(card.tags ?? []).length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Tags</div>
          <div className="flex flex-wrap gap-1">
            {(card.tags ?? []).map((t) => (
              <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--panel-2)] border border-[var(--border)] text-muted-foreground">{t}</span>
            ))}
          </div>
        </div>
      )}

      {coletadas.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Informações coletadas pelo atendente</div>
          <ul className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] divide-y divide-[var(--border)]">
            {coletadas.map(([k, v]) => (
              <li key={k} className="flex gap-3 px-3 py-2 text-[13px]">
                <span className="text-muted-foreground min-w-[40%]">{labels[k] || k}</span>
                <span className="font-medium break-words">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.ultima_mensagem && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Última mensagem</div>
          <p className="text-[13px] text-foreground/85 whitespace-pre-wrap">{card.ultima_mensagem}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onGoTo("dados")}>Editar informações</Button>
        <Button variant="ghost" size="sm" onClick={() => onGoTo("conversa")}>Ver conversa</Button>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px]">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <span className="text-muted-foreground min-w-[38%]">{label}</span>
      <span className="font-medium break-words flex-1">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ConversaTab({ numero, companyId }: { numero: string; companyId: string }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("mensagens").select("*")
        .eq("company_id", companyId).eq("numero", numero)
        .order("created_at", { ascending: true }).limit(200);
      setMsgs(data ?? []);
    })();
  }, [numero, companyId]);
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto p-2">
      {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem mensagens.</div>}
      {msgs.map((m) => (
        <div key={m.id} className={`flex ${m.direcao === "saida" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direcao === "saida" ? "bg-[var(--brand)]/15 text-foreground" : "bg-[var(--panel-2)]"}`}>
            <div className="text-[10px] uppercase opacity-60 mb-0.5">{m.autor}</div>
            {m.texto}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotasTab({ cardId, companyId }: { cardId: string; companyId: string }) {
  const [notas, setNotas] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const { data } = await supabase.from("lead_nota").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
    setNotas(data ?? []);
  }
  useEffect(() => { void reload(); }, [cardId]);
  async function add() {
    if (!texto.trim()) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("lead_nota").insert({
      company_id: companyId, card_id: cardId, autor_id: u.user?.id ?? null, texto: texto.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTexto(""); reload();
  }
  async function del(id: string) {
    await supabase.from("lead_nota").delete().eq("id", id);
    reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Adicionar nota interna…" />
        <Button onClick={add} disabled={busy}><Send className="size-4" /></Button>
      </div>
      <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
        {notas.map((n) => (
          <li key={n.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
              <button onClick={() => del(n.id)} className="hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="whitespace-pre-wrap">{n.texto}</div>
          </li>
        ))}
        {notas.length === 0 && <li className="text-sm text-muted-foreground text-center py-4">Sem notas.</li>}
      </ul>
    </div>
  );
}

function HistTab({ cardId }: { cardId: string }) {
  const [evs, setEvs] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lead_evento").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
      setEvs(data ?? []);
    })();
  }, [cardId]);
  return (
    <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
      {evs.length === 0 && <li className="text-sm text-muted-foreground text-center py-6">Sem eventos.</li>}
      {evs.map((e) => (
        <li key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
          <div className="text-[11px] text-muted-foreground mb-1">{new Date(e.created_at).toLocaleString("pt-BR")}</div>
          <div><b className="text-[var(--brand-text)]">{e.tipo}</b> — {e.descricao}</div>
        </li>
      ))}
    </ul>
  );
}
