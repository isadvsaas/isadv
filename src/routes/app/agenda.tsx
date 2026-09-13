import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getAgendaOverview,
  getAgendaDisponibilidade,
  criarAgendamentoManual,
  reagendarManual,
  cancelarManual,
  concluirAgendamento,
  salvarServico,
  excluirServico,
  salvarJanelas,
  salvarBloqueio,
  excluirBloqueio,
  setAgendamentoAtivo,
} from "@/lib/agenda.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, CalendarDays, Trash2, Check, X, Clock, CalendarOff, RefreshCw } from "lucide-react";
import { brand } from "@/config/brand";
import { DIA_LABEL } from "@/lib/business-hours";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({
    meta: [
      { title: `${brand.name} — Agenda` },
      { name: "description", content: "Veja e gerencie os agendamentos do seu negócio: horários livres, serviços e bloqueios." },
      { property: "og:title", content: `${brand.name} — Agenda` },
      { property: "og:description", content: "Agenda do negócio com horários livres, serviços e bloqueios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

type Overview = Awaited<ReturnType<typeof getAgendaOverview>>;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function fmtDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function AgendaPage() {
  const overviewFn = useServerFn(getAgendaOverview);
  const dispFn = useServerFn(getAgendaDisponibilidade);
  const criarFn = useServerFn(criarAgendamentoManual);
  const reagendarFn = useServerFn(reagendarManual);
  const cancelarFn = useServerFn(cancelarManual);
  const concluirFn = useServerFn(concluirAgendamento);
  const ativarFn = useServerFn(setAgendamentoAtivo);

  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dia, setDia] = useState<string>(ymd(new Date()));
  const [novoOpen, setNovoOpen] = useState(false);
  const [reagendarId, setReagendarId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await overviewFn({ data: {} });
      setOv(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line
  }, []);

  const tz = ov?.timezone ?? "America/Sao_Paulo";

  const dias = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base.getTime() + i * 86_400_000);
      return ymd(d);
    });
  }, []);

  const doDia = useMemo(() => {
    if (!ov) return [];
    return ov.agendamentos.filter((a: any) => {
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(a.inicio),
      );
      return key === dia;
    });
  }, [ov, dia, tz]);

  const proximos = useMemo(
    () => (ov?.agendamentos ?? []).filter((a: any) => a.status === "agendado" && new Date(a.inicio).getTime() > Date.now()).slice(0, 6),
    [ov],
  );

  async function onCancelar(id: string) {
    const r = await cancelarFn({ data: { id } });
    if (r.ok) {
      toast.success("Agendamento cancelado.");
      if (r.googleError) toast.warning("Cancelado aqui, mas o Google Agenda não confirmou a remoção.");
      void load();
    } else toast.error(r.message);
  }
  async function onConcluir(id: string) {
    await concluirFn({ data: { id } });
    toast.success("Marcado como concluído.");
    void load();
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" /> Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            Seus atendimentos marcados. A IA usa exatamente estes horários — ela nunca oferece um horário ocupado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4 mr-1.5" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovoOpen(true)}>
            <Plus className="size-4 mr-1.5" /> Novo agendamento
          </Button>
        </div>
      </div>

      <Card className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-medium">A IA pode agendar sozinha</span>
          <p className="text-xs text-muted-foreground">
            Quando ativo, o atendente consulta horários livres e marca direto na conversa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ov?.googleConectado ? (
            <Badge className="bg-emerald-500/15 text-emerald-600">Google Agenda conectado</Badge>
          ) : (
            <Badge variant="secondary">Só agenda interna</Badge>
          )}
          <Switch
            checked={!!ov?.agendamentoAtivo}
            onCheckedChange={async (v) => {
              try {
                await ativarFn({ data: { ativo: v } });
                toast.success(v ? "IA pode agendar." : "Agendamento pela IA desativado.");
                void load();
              } catch (e: any) {
                toast.error(e?.message);
              }
            }}
          />
        </div>
      </Card>

      <Tabs defaultValue="dia">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="dia">Por dia</TabsTrigger>
          <TabsTrigger value="proximos">Próximos</TabsTrigger>
          <TabsTrigger value="config">Horários</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="space-y-3 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {dias.map((d) => {
              const [y, m, dd] = d.split("-");
              const active = d === dia;
              return (
                <button
                  key={d}
                  onClick={() => setDia(d)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                >
                  {dd}/{m}
                </button>
              );
            })}
          </div>

          {doDia.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum atendimento neste dia.</Card>
          ) : (
            <div className="space-y-2">
              {doDia.map((a: any) => (
                <AgendamentoRow
                  key={a.id}
                  a={a}
                  tz={tz}
                  onCancelar={onCancelar}
                  onConcluir={onConcluir}
                  onReagendar={() => setReagendarId(a.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="proximos" className="space-y-2 pt-3">
          {proximos.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum atendimento futuro marcado.</Card>
          ) : (
            proximos.map((a: any) => (
              <AgendamentoRow
                key={a.id}
                a={a}
                tz={tz}
                showDay
                onCancelar={onCancelar}
                onConcluir={onConcluir}
                onReagendar={() => setReagendarId(a.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="config" className="pt-3">
          <ConfigPanel ov={ov} reload={load} />
        </TabsContent>
      </Tabs>

      <NovoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        ov={ov}
        tz={tz}
        dispFn={dispFn}
        onCreate={async (payload) => {
          const r = await criarFn({ data: payload });
          if (r.status === "created") {
            toast.success("Agendamento criado.");
            if ((r as any).googleError) toast.warning("Criado aqui, mas o Google Agenda não confirmou.");
            setNovoOpen(false);
            void load();
            return true;
          }
          if (r.status === "conflict") toast.error(r.message);
          else toast.error((r as any).message);
          return false;
        }}
      />

      <ReagendarDialog
        id={reagendarId}
        onClose={() => setReagendarId(null)}
        tz={tz}
        dispFn={dispFn}
        onConfirm={async (id, inicio) => {
          const r = await reagendarFn({ data: { id, inicio } });
          if (r.status === "created") {
            toast.success("Agendamento remarcado.");
            setReagendarId(null);
            void load();
          } else toast.error((r as any).message);
        }}
      />
    </div>
  );
}

function AgendamentoRow({
  a,
  tz,
  showDay,
  onCancelar,
  onConcluir,
  onReagendar,
}: {
  a: any;
  tz: string;
  showDay?: boolean;
  onCancelar: (id: string) => void;
  onConcluir: (id: string) => void;
  onReagendar: () => void;
}) {
  const cancelado = a.status === "cancelado";
  const concluido = a.status === "concluido";
  return (
    <Card className={`p-3 ${cancelado ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-muted-foreground" />
            {showDay ? `${fmtDay(a.inicio, tz)} · ` : ""}
            {fmtTime(a.inicio, tz)} – {fmtTime(a.fim, tz)}
            {cancelado && <Badge className="bg-red-500/15 text-red-600">Cancelado</Badge>}
            {concluido && <Badge className="bg-emerald-500/15 text-emerald-600">Concluído</Badge>}
          </div>
          <div className="text-sm truncate">{a.titulo}</div>
          <div className="text-xs text-muted-foreground truncate">
            {a.numero ? a.numero : "sem contato"} · {a.criado_por === "ia" ? "marcado pela IA" : "marcado no painel"}
          </div>
        </div>
        {!cancelado && !concluido && (
          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={onReagendar}>
              Remarcar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConcluir(a.id)}>
              <Check className="size-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCancelar(a.id)}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function SlotPicker({
  tz,
  dispFn,
  serviceId,
  value,
  onChange,
  ignoreId,
}: {
  tz: string;
  dispFn: any;
  serviceId?: string | null;
  value: string | null;
  onChange: (iso: string) => void;
  ignoreId?: string | null;
}) {
  const [data, setData] = useState<string>(ymd(new Date()));
  const [slots, setSlots] = useState<Array<{ inicio: string; fim: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    dispFn({ data: { data, dias: 1, serviceId: serviceId ?? null, ignoreId: ignoreId ?? null } })
      .then((r: any) => {
        if (alive) setSlots(r.slots ?? []);
      })
      .catch((e: any) => toast.error(e?.message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [data, serviceId, ignoreId]);

  return (
    <div className="space-y-2">
      <Label>Dia</Label>
      <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      {busy ? (
        <div className="py-4 grid place-items-center">
          <Loader2 className="animate-spin size-4 text-muted-foreground" />
        </div>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum horário livre neste dia.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
          {slots.map((s) => (
            <button
              key={s.inicio}
              onClick={() => onChange(s.inicio)}
              className={`rounded-md border px-2 py-2 text-xs ${value === s.inicio ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
            >
              {fmtTime(s.inicio, tz)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NovoDialog({
  open,
  onOpenChange,
  ov,
  tz,
  dispFn,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ov: Overview | null;
  tz: string;
  dispFn: any;
  onCreate: (p: any) => Promise<boolean>;
}) {
  const servicos = (ov?.servicos ?? []).filter((s: any) => s.ativo);
  const [serviceId, setServiceId] = useState<string>("");
  const [inicio, setInicio] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [numero, setNumero] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {servicos.length > 0 && (
            <div>
              <Label>Serviço</Label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setInicio(null);
                }}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">Padrão</option>
                {servicos.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.duracao_min} min)
                  </option>
                ))}
              </select>
            </div>
          )}
          <SlotPicker tz={tz} dispFn={dispFn} serviceId={serviceId || null} value={inicio} onChange={setInicio} />
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Consulta — Maria" />
          </div>
          <div>
            <Label>Contato (WhatsApp)</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="5511999999999" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!inicio || saving}
            onClick={async () => {
              if (!inicio) return;
              setSaving(true);
              try {
                await onCreate({
                  inicio,
                  serviceId: serviceId || null,
                  titulo: titulo || null,
                  numero: numero.replace(/\D/g, "") || null,
                  observacoes: obs || null,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReagendarDialog({
  id,
  onClose,
  tz,
  dispFn,
  onConfirm,
}: {
  id: string | null;
  onClose: () => void;
  tz: string;
  dispFn: any;
  onConfirm: (id: string, inicio: string) => Promise<void>;
}) {
  const [inicio, setInicio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setInicio(null), [id]);

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar atendimento</DialogTitle>
        </DialogHeader>
        {id && <SlotPicker tz={tz} dispFn={dispFn} value={inicio} onChange={setInicio} ignoreId={id} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!inicio || saving}
            onClick={async () => {
              if (!id || !inicio) return;
              setSaving(true);
              try {
                await onConfirm(id, inicio);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Remarcar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigPanel({ ov, reload }: { ov: Overview | null; reload: () => Promise<void> }) {
  const saveServ = useServerFn(salvarServico);
  const delServ = useServerFn(excluirServico);
  const saveJan = useServerFn(salvarJanelas);
  const saveBloq = useServerFn(salvarBloqueio);
  const delBloq = useServerFn(excluirBloqueio);

  const [novo, setNovo] = useState({ nome: "", duracao_min: 60, buffer_min: 0, antecedencia_min: 60 });
  const [janelas, setJanelas] = useState<Record<string, { abre: string; fecha: string } | null>>(() => {
    const out: Record<string, { abre: string; fecha: string } | null> = {};
    for (let d = 0; d <= 6; d++) {
      const j = (ov?.janelasEfetivas ?? []).find((x: any) => Number(x.dia_semana) === d);
      out[String(d)] = j ? { abre: String(j.hora_inicio).slice(0, 5), fecha: String(j.hora_fim).slice(0, 5) } : null;
    }
    return out;
  });
  const [bloq, setBloq] = useState({ inicio: "", fim: "", motivo: "" });
  const [busy, setBusy] = useState(false);

  const tz = ov?.timezone ?? "America/Sao_Paulo";

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Serviços</h2>
          <p className="text-xs text-muted-foreground">Duração, intervalo entre atendimentos e antecedência mínima.</p>
        </div>
        <div className="space-y-2">
          {(ov?.servicos ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum serviço ainda — a agenda usa 60 minutos por atendimento.</p>
          )}
          {(ov?.servicos ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border rounded-md p-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{s.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {s.duracao_min} min · intervalo {s.buffer_min} min · antecedência {s.antecedencia_min} min
                  {s.ativo ? "" : " · inativo"}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await delServ({ data: { id: s.id } });
                  toast.success("Serviço removido.");
                  await reload();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-5 items-end">
          <div className="sm:col-span-2">
            <Label>Nome</Label>
            <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Corte de cabelo" />
          </div>
          <div>
            <Label>Duração</Label>
            <Input type="number" value={novo.duracao_min} onChange={(e) => setNovo({ ...novo, duracao_min: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Intervalo</Label>
            <Input type="number" value={novo.buffer_min} onChange={(e) => setNovo({ ...novo, buffer_min: Number(e.target.value) })} />
          </div>
          <Button
            disabled={!novo.nome.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await saveServ({ data: { ...novo } });
                setNovo({ nome: "", duracao_min: 60, buffer_min: 0, antecedencia_min: 60 });
                toast.success("Serviço salvo.");
                await reload();
              } catch (e: any) {
                toast.error(e?.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus className="size-4 mr-1.5" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Dias e horários de atendimento</h2>
          <p className="text-xs text-muted-foreground">Fuso: {tz}. A IA só oferece horários dentro dessas janelas.</p>
        </div>
        <div className="space-y-2">
          {Object.keys(DIA_LABEL).map((d) => {
            const j = janelas[d];
            return (
              <div key={d} className="flex items-center gap-3 border rounded-md p-2.5">
                <div className="w-20 text-sm">{DIA_LABEL[d]}</div>
                <Switch
                  checked={!!j}
                  onCheckedChange={(v) => setJanelas({ ...janelas, [d]: v ? { abre: "09:00", fecha: "18:00" } : null })}
                />
                {j ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="w-28" value={j.abre} onChange={(e) => setJanelas({ ...janelas, [d]: { ...j, abre: e.target.value } })} />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input type="time" className="w-28" value={j.fecha} onChange={(e) => setJanelas({ ...janelas, [d]: { ...j, fecha: e.target.value } })} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const rows = Object.entries(janelas)
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => ({ dia_semana: Number(k), hora_inicio: v!.abre, hora_fim: v!.fecha }));
                await saveJan({ data: { janelas: rows } });
                toast.success("Horários salvos.");
                await reload();
              } catch (e: any) {
                toast.error(e?.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar horários
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <CalendarOff className="size-4" /> Bloqueios
          </h2>
          <p className="text-xs text-muted-foreground">Férias, feriados ou almoço: nesses períodos nada pode ser marcado.</p>
        </div>
        <div className="space-y-2">
          {(ov?.bloqueios ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum bloqueio ativo.</p>}
          {(ov?.bloqueios ?? []).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between gap-2 border rounded-md p-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate">{b.motivo || "Bloqueio"}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDay(b.inicio, tz)} {fmtTime(b.inicio, tz)} → {fmtDay(b.fim, tz)} {fmtTime(b.fim, tz)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await delBloq({ data: { id: b.id } });
                  toast.success("Bloqueio removido.");
                  await reload();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-4 items-end">
          <div>
            <Label>Início</Label>
            <Input type="datetime-local" value={bloq.inicio} onChange={(e) => setBloq({ ...bloq, inicio: e.target.value })} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="datetime-local" value={bloq.fim} onChange={(e) => setBloq({ ...bloq, fim: e.target.value })} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={bloq.motivo} onChange={(e) => setBloq({ ...bloq, motivo: e.target.value })} placeholder="Feriado" />
          </div>
          <Button
            disabled={!bloq.inicio || !bloq.fim || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await saveBloq({ data: { inicio: new Date(bloq.inicio).toISOString(), fim: new Date(bloq.fim).toISOString(), motivo: bloq.motivo } });
                setBloq({ inicio: "", fim: "", motivo: "" });
                toast.success("Bloqueio criado.");
                await reload();
              } catch (e: any) {
                toast.error(e?.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus className="size-4 mr-1.5" /> Bloquear
          </Button>
        </div>
      </Card>
    </div>
  );
}
