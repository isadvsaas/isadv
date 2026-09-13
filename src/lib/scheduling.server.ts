// MOTOR DE AGENDAMENTO — fonte única de verdade da agenda do AtendZap.
// Reutiliza: google_integration (OAuth/refresh atuais), tabela agendamento,
// agent_config (agendamento_ativo / horarios_atendimento), crm_cards, lead_evento.
// A agenda interna funciona SEM Google. Com Google conectado, freeBusy entra no cálculo.
// Nunca confiar na IA para calcular conflito: tudo é validado aqui, server-side.

export type AgendaService = {
  id: string;
  company_id: string;
  nome: string;
  duracao_min: number;
  buffer_min: number;
  antecedencia_min: number;
  ativo: boolean;
  lembretes_ativos: boolean;
};

export type AgendaJanela = {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
};

export type AgendaBloqueio = { id: string; inicio: string; fim: string; motivo: string };

export type Agendamento = {
  id: string;
  company_id: string;
  card_id: string | null;
  service_id: string | null;
  numero: string | null;
  channel: string;
  titulo: string;
  inicio: string;
  fim: string;
  status: string;
  observacoes: string;
  google_event_id: string | null;
};

export type Slot = { inicio: string; fim: string; label: string };

const DEFAULT_TZ = "America/Sao_Paulo";
const DOW_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ------------------------------------------------------------------ timezone

function tzOffsetMs(utcDate: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(utcDate)) if (part.type !== "literal") p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p['year']),
    Number(p['month']) - 1,
    Number(p['day']),
    Number(p['hour']) === 24 ? 0 : Number(p['hour']),
    Number(p['minute']),
    Number(p['second']),
  );
  return asUtc - utcDate.getTime();
}

/** Converte data/hora LOCAL da empresa em instante UTC. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mi, 0);
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  // segunda passada resolve DST na borda
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** Partes locais (na tz da empresa) de um instante. */
export function utcToZonedParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) if (part.type !== "literal") p[part.type] = part.value;
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(p['hour']) === 24 ? 0 : Number(p['hour']);
  return {
    y: Number(p['year']),
    m: Number(p['month']),
    d: Number(p['day']),
    hh: hour,
    mi: Number(p['minute']),
    dow: map[p['weekday'] ?? "Mon"] ?? 0,
  };
}

export function formatSlotLabel(date: Date, tz: string): string {
  const z = utcToZonedParts(date, tz);
  const dd = String(z.d).padStart(2, "0");
  const mm = String(z.m).padStart(2, "0");
  const hh = String(z.hh).padStart(2, "0");
  const mi = String(z.mi).padStart(2, "0");
  return `${DOW_LABEL[z.dow]} ${dd}/${mm} às ${hh}:${mi}`;
}

function hhmmToMin(s: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s || ""));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function ymd(date: Date, tz: string): string {
  const z = utcToZonedParts(date, tz);
  return `${z.y}-${String(z.m).padStart(2, "0")}-${String(z.d).padStart(2, "0")}`;
}

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function norm(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ------------------------------------------------------------------ contexto

export type AgendaContext = {
  timezone: string;
  services: AgendaService[];
  janelas: AgendaJanela[];
};

export async function getAgendaContext(admin: any, companyId: string): Promise<AgendaContext> {
  const [{ data: svc }, { data: jan }, { data: cfgs }] = await Promise.all([
    admin.from("agenda_servico").select("*").eq("company_id", companyId).order("nome", { ascending: true }),
    admin.from("agenda_janela").select("*").eq("company_id", companyId).order("dia_semana", { ascending: true }),
    admin.from("agent_config").select("horarios_atendimento").eq("company_id", companyId).limit(1),
  ]);

  const timezone = (cfgs?.[0]?.horarios_atendimento?.timezone as string) || DEFAULT_TZ;
  let janelas = ((jan ?? []) as AgendaJanela[]).filter((j) => j.ativo);

  // Fallback: se a empresa ainda não configurou janelas de agenda, reaproveita
  // o horário de atendimento já existente em agent_config.horarios_atendimento.
  if (!janelas.length) {
    const dias = (cfgs?.[0]?.horarios_atendimento?.dias ?? null) as Record<string, any> | null;
    if (dias) {
      janelas = Object.entries(dias)
        .filter(([, v]) => v && v.abre && v.fecha)
        .map(([k, v]: [string, any], i) => ({
          id: `cfg-${i}`,
          dia_semana: Number(k),
          hora_inicio: v.abre,
          hora_fim: v.fecha,
          ativo: true,
        }));
    }
    if (!janelas.length) {
      janelas = [1, 2, 3, 4, 5].map((d, i) => ({
        id: `def-${i}`,
        dia_semana: d,
        hora_inicio: "09:00",
        hora_fim: "18:00",
        ativo: true,
      }));
    }
  }

  return { timezone, services: (svc ?? []) as AgendaService[], janelas };
}

export function resolveService(ctx: AgendaContext, wanted?: string | null): AgendaService | null {
  const ativos = ctx.services.filter((s) => s.ativo);
  if (!ativos.length) return null;
  const w = norm(wanted);
  if (!w) return ativos[0] ?? null;
  return (
    ativos.find((s) => s.id === wanted) ??
    ativos.find((s) => norm(s.nome) === w) ??
    ativos.find((s) => norm(s.nome).includes(w) || w.includes(norm(s.nome))) ??
    ativos[0] ??
    null
  );
}

// ------------------------------------------------------------------ ocupação

type Interval = { start: number; end: number };

async function loadBusy(
  admin: any,
  companyId: string,
  fromUtc: Date,
  toUtc: Date,
  opts?: { ignoreAgendamentoId?: string | null; skipGoogle?: boolean },
): Promise<{ intervals: Interval[]; googleError: string | null }> {
  const intervals: Interval[] = [];
  let googleError: string | null = null;

  const [{ data: ags }, { data: blocks }] = await Promise.all([
    admin
      .from("agendamento")
      .select("id, inicio, fim, status")
      .eq("company_id", companyId)
      .eq("status", "agendado")
      .lt("inicio", toUtc.toISOString())
      .gt("fim", fromUtc.toISOString()),
    admin
      .from("agenda_bloqueio")
      .select("id, inicio, fim")
      .eq("company_id", companyId)
      .lt("inicio", toUtc.toISOString())
      .gt("fim", fromUtc.toISOString()),
  ]);

  for (const a of (ags ?? []) as any[]) {
    if (opts?.ignoreAgendamentoId && a.id === opts.ignoreAgendamentoId) continue;
    intervals.push({ start: new Date(a.inicio).getTime(), end: new Date(a.fim).getTime() });
  }
  for (const b of (blocks ?? []) as any[]) {
    intervals.push({ start: new Date(b.inicio).getTime(), end: new Date(b.fim).getTime() });
  }

  if (!opts?.skipGoogle) {
    try {
      const { googleFreeBusy } = await import("./google.server");
      const busy = await googleFreeBusy(admin, companyId, fromUtc.toISOString(), toUtc.toISOString());
      for (const b of busy) intervals.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!/não conectado/i.test(msg)) {
        googleError = msg;
        console.error("[agenda.freebusy]", companyId, msg);
      }
    }
  }

  return { intervals, googleError };
}

function overlaps(intervals: Interval[], start: number, end: number): boolean {
  return intervals.some((i) => start < i.end && end > i.start);
}

// ------------------------------------------------------------------ disponibilidade

export type AvailabilityResult = {
  timezone: string;
  service: { id: string | null; nome: string; duracao_min: number } | null;
  slots: Slot[];
  googleError: string | null;
};

export async function computeAvailability(
  admin: any,
  companyId: string,
  opts: {
    dateFrom?: string | null; // YYYY-MM-DD na tz da empresa
    days?: number;
    serviceId?: string | null;
    servicoNome?: string | null;
    duracaoMin?: number | null;
    turno?: string | null; // manha | tarde | noite
    limit?: number;
    ignoreAgendamentoId?: string | null;
  } = {},
): Promise<AvailabilityResult> {
  const ctx = await getAgendaContext(admin, companyId);
  const tz = ctx.timezone;
  const service = resolveService(ctx, opts.serviceId || opts.servicoNome || null);

  const duracao = Math.max(5, Math.floor(Number(opts.duracaoMin || service?.duracao_min || 60)));
  const buffer = Math.max(0, Math.floor(Number(service?.buffer_min ?? 0)));
  const antecedencia = Math.max(0, Math.floor(Number(service?.antecedencia_min ?? 60)));

  const days = Math.min(31, Math.max(1, Math.floor(Number(opts.days || 7))));
  const now = new Date();
  const base = parseYmd(opts.dateFrom || "") ?? parseYmd(ymd(now, tz))!;

  const fromUtc = zonedToUtc(base.y, base.m, base.d, 0, 0, tz);
  const toUtc = new Date(fromUtc.getTime() + days * 86_400_000 + 86_400_000);
  const { intervals, googleError } = await loadBusy(admin, companyId, fromUtc, toUtc, {
    ignoreAgendamentoId: opts.ignoreAgendamentoId ?? null,
  });

  const minStart = now.getTime() + antecedencia * 60_000;
  const turno = norm(opts.turno);
  const limit = Math.min(60, Math.max(1, Math.floor(Number(opts.limit || 24))));
  const step = duracao + buffer;
  const slots: Slot[] = [];

  for (let dayIdx = 0; dayIdx < days && slots.length < limit; dayIdx++) {
    const dayStart = new Date(fromUtc.getTime() + dayIdx * 86_400_000);
    const z = utcToZonedParts(dayStart, tz);
    const janelas = ctx.janelas.filter((j) => j.dia_semana === z.dow);
    for (const j of janelas) {
      const open = hhmmToMin(j.hora_inicio);
      const close = hhmmToMin(j.hora_fim);
      for (let m = open; m + duracao <= close; m += step) {
        if (slots.length >= limit) break;
        const startDate = zonedToUtc(z.y, z.m, z.d, Math.floor(m / 60), m % 60, tz);
        const startMs = startDate.getTime();
        const endMs = startMs + duracao * 60_000;
        if (startMs < minStart) continue;
        if (turno) {
          const h = Math.floor(m / 60);
          if (turno.startsWith("man") && h >= 12) continue;
          if (turno.startsWith("tard") && (h < 12 || h >= 18)) continue;
          if (turno.startsWith("noit") && h < 18) continue;
        }
        // buffer também protege o slot vizinho já ocupado
        if (overlaps(intervals, startMs - buffer * 60_000, endMs + buffer * 60_000)) continue;
        slots.push({
          inicio: new Date(startMs).toISOString(),
          fim: new Date(endMs).toISOString(),
          label: formatSlotLabel(new Date(startMs), tz),
        });
      }
    }
  }

  return {
    timezone: tz,
    service: service ? { id: service.id, nome: service.nome, duracao_min: service.duracao_min } : null,
    slots,
    googleError,
  };
}

/** Valida um horário específico. Retorna motivo quando indisponível. */
export async function checkSlot(
  admin: any,
  companyId: string,
  opts: { inicio: string; fim?: string | null; serviceId?: string | null; servicoNome?: string | null; ignoreAgendamentoId?: string | null },
): Promise<
  | { ok: true; inicio: string; fim: string; timezone: string; service: AgendaService | null }
  | { ok: false; reason: "invalid_date" | "past" | "outside_hours" | "conflict" | "google_error"; message: string; timezone: string }
> {
  const ctx = await getAgendaContext(admin, companyId);
  const tz = ctx.timezone;
  const start = new Date(String(opts.inicio));
  if (Number.isNaN(start.getTime())) {
    return { ok: false, reason: "invalid_date", message: "Data/hora inválida.", timezone: tz };
  }
  const service = resolveService(ctx, opts.serviceId || opts.servicoNome || null);
  const duracao = Math.max(5, Math.floor(Number(service?.duracao_min ?? 60)));
  const end = opts.fim ? new Date(String(opts.fim)) : new Date(start.getTime() + duracao * 60_000);
  if (Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, reason: "invalid_date", message: "Horário final inválido.", timezone: tz };
  }
  const buffer = Math.max(0, Math.floor(Number(service?.buffer_min ?? 0)));
  const antecedencia = Math.max(0, Math.floor(Number(service?.antecedencia_min ?? 60)));

  if (start.getTime() < Date.now() + antecedencia * 60_000) {
    return {
      ok: false,
      reason: "past",
      message: antecedencia > 0 ? `É preciso agendar com pelo menos ${antecedencia} minutos de antecedência.` : "Horário no passado.",
      timezone: tz,
    };
  }

  // dentro das janelas de funcionamento
  const z = utcToZonedParts(start, tz);
  const ze = utcToZonedParts(end, tz);
  const startMin = z.hh * 60 + z.mi;
  const endMin = ze.hh * 60 + ze.mi + (ze.d !== z.d ? 24 * 60 : 0);
  const fits = ctx.janelas.some(
    (j) => j.dia_semana === z.dow && startMin >= hhmmToMin(j.hora_inicio) && endMin <= hhmmToMin(j.hora_fim),
  );
  if (!fits) {
    return { ok: false, reason: "outside_hours", message: "Esse horário está fora do horário de atendimento.", timezone: tz };
  }

  const { intervals, googleError } = await loadBusy(admin, companyId, new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000), {
    ignoreAgendamentoId: opts.ignoreAgendamentoId ?? null,
  });
  if (overlaps(intervals, start.getTime() - buffer * 60_000, end.getTime() + buffer * 60_000)) {
    return { ok: false, reason: "conflict", message: "Esse horário não está mais disponível.", timezone: tz };
  }
  if (googleError) {
    return { ok: false, reason: "google_error", message: `Não foi possível confirmar a agenda do Google: ${googleError}`, timezone: tz };
  }

  return { ok: true, inicio: start.toISOString(), fim: end.toISOString(), timezone: tz, service };
}

// ------------------------------------------------------------------ CRUD

export type CreateResult =
  | { status: "created"; agendamento: Agendamento; timezone: string; googleSynced: boolean; googleError: string | null }
  | { status: "conflict"; message: string; alternatives: Slot[]; timezone: string }
  | { status: "error"; message: string; timezone: string };

export async function createAgendamento(
  admin: any,
  params: {
    companyId: string;
    inicio: string;
    fim?: string | null;
    titulo?: string | null;
    serviceId?: string | null;
    servicoNome?: string | null;
    cardId?: string | null;
    numero?: string | null;
    channel?: string;
    observacoes?: string | null;
    criadoPor?: "ia" | "painel";
  },
): Promise<CreateResult> {
  const check = await checkSlot(admin, params.companyId, {
    inicio: params.inicio,
    fim: params.fim ?? null,
    serviceId: params.serviceId ?? null,
    servicoNome: params.servicoNome ?? null,
  });
  if (!check.ok) {
    if (check.reason === "conflict" || check.reason === "outside_hours" || check.reason === "past") {
      const alt = await computeAvailability(admin, params.companyId, {
        dateFrom: null,
        days: 7,
        serviceId: params.serviceId ?? null,
        servicoNome: params.servicoNome ?? null,
        limit: 6,
      });
      return { status: "conflict", message: check.message, alternatives: alt.slots, timezone: check.timezone };
    }
    return { status: "error", message: check.message, timezone: check.timezone };
  }

  const titulo = String(params.titulo || check.service?.nome || "Agendamento").slice(0, 160);
  const payload = {
    company_id: params.companyId,
    card_id: params.cardId ?? null,
    service_id: check.service?.id ?? null,
    numero: params.numero ?? null,
    channel: params.channel || "whatsapp",
    titulo,
    inicio: check.inicio,
    fim: check.fim,
    status: "agendado",
    observacoes: String(params.observacoes || ""),
    criado_por: params.criadoPor || "painel",
  };

  const { data: created, error } = await admin.from("agendamento").insert(payload).select("*").maybeSingle();
  if (error) {
    // 23P01 = restrição de exclusão (sobreposição real de intervalo) no banco
    if (String(error.code) === "23P01" || /exclus/i.test(String(error.message))) {
      const { data: existing } = await admin
        .from("agendamento")
        .select("*")
        .eq("company_id", params.companyId)
        .eq("status", "agendado")
        .lt("inicio", check.fim)
        .gt("fim", check.inicio)
        .limit(1)
        .maybeSingle();
      if (existing && params.numero && existing.numero === params.numero && existing.inicio === check.inicio) {
        return { status: "created", agendamento: existing as Agendamento, timezone: check.timezone, googleSynced: !!existing.google_event_id, googleError: null };
      }
      const altEx = await computeAvailability(admin, params.companyId, {
        days: 7,
        serviceId: check.service?.id ?? null,
        limit: 6,
      });
      return { status: "conflict", message: "Esse horário já está ocupado.", alternatives: altEx.slots, timezone: check.timezone };
    }
    // índice único parcial (company_id, inicio) where status='agendado' → idempotência/concorrência
    if (String(error.code) === "23505" || /duplicate key/i.test(String(error.message))) {

      const { data: existing } = await admin
        .from("agendamento")
        .select("*")
        .eq("company_id", params.companyId)
        .eq("inicio", check.inicio)
        .eq("status", "agendado")
        .maybeSingle();
      const sameContact = existing && params.numero && existing.numero === params.numero;
      if (sameContact) {
        return { status: "created", agendamento: existing as Agendamento, timezone: check.timezone, googleSynced: !!existing.google_event_id, googleError: null };
      }
      const alt = await computeAvailability(admin, params.companyId, {
        days: 7,
        serviceId: check.service?.id ?? null,
        limit: 6,
      });
      return { status: "conflict", message: "Esse horário acabou de ser ocupado.", alternatives: alt.slots, timezone: check.timezone };
    }
    return { status: "error", message: String(error.message), timezone: check.timezone };
  }

  let googleSynced = false;
  let googleError: string | null = null;
  try {
    const { insertGoogleEvent } = await import("./google.server");
    const ev = await insertGoogleEvent(admin, params.companyId, {
      titulo,
      inicio: check.inicio,
      fim: check.fim,
      descricao: [params.numero ? `Contato: ${params.numero}` : "", params.observacoes || ""].filter(Boolean).join("\n"),
    });
    if (ev?.id) {
      await admin.from("agendamento").update({ google_event_id: ev.id }).eq("id", created.id).eq("company_id", params.companyId);
      (created as any).google_event_id = ev.id;
      googleSynced = true;
    }
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (!/não conectado/i.test(msg)) {
      googleError = msg;
      console.error("[agenda.google.create]", params.companyId, msg);
    }
  }

  return { status: "created", agendamento: created as Agendamento, timezone: check.timezone, googleSynced, googleError };
}

export async function reagendarAgendamento(
  admin: any,
  params: { companyId: string; id: string; inicio: string; fim?: string | null },
): Promise<CreateResult> {
  const { data: ag } = await admin
    .from("agendamento")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("id", params.id)
    .maybeSingle();
  if (!ag) return { status: "error", message: "Agendamento não encontrado.", timezone: DEFAULT_TZ };
  if (ag.status !== "agendado") {
    return { status: "error", message: `Este agendamento está ${ag.status} e não pode ser remarcado.`, timezone: DEFAULT_TZ };
  }
  if (new Date(String(params.inicio)).toISOString() === new Date(ag.inicio).toISOString()) {
    // idempotência: remarcar para o mesmo horário não faz nada
    return { status: "created", agendamento: ag as Agendamento, timezone: DEFAULT_TZ, googleSynced: !!ag.google_event_id, googleError: null };
  }

  const check = await checkSlot(admin, params.companyId, {
    inicio: params.inicio,
    fim: params.fim ?? null,
    serviceId: ag.service_id,
    ignoreAgendamentoId: ag.id,
  });
  if (!check.ok) {
    if (check.reason === "conflict" || check.reason === "outside_hours" || check.reason === "past") {
      const alt = await computeAvailability(admin, params.companyId, {
        days: 7,
        serviceId: ag.service_id,
        limit: 6,
        ignoreAgendamentoId: ag.id,
      });
      return { status: "conflict", message: check.message, alternatives: alt.slots, timezone: check.timezone };
    }
    return { status: "error", message: check.message, timezone: check.timezone };
  }

  const { data: updated, error } = await admin
    .from("agendamento")
    .update({ inicio: check.inicio, fim: check.fim, lembrete_24h_em: null, lembrete_2h_em: null })
    .eq("id", ag.id)
    .eq("company_id", params.companyId)
    .eq("status", "agendado")
    .select("*")
    .maybeSingle();
  if (error) {
    if (String(error.code) === "23505") {
      const alt = await computeAvailability(admin, params.companyId, { days: 7, serviceId: ag.service_id, limit: 6 });
      return { status: "conflict", message: "Esse horário acabou de ser ocupado.", alternatives: alt.slots, timezone: check.timezone };
    }
    return { status: "error", message: String(error.message), timezone: check.timezone };
  }
  if (!updated) return { status: "error", message: "Não foi possível remarcar.", timezone: check.timezone };

  let googleSynced = false;
  let googleError: string | null = null;
  if (ag.google_event_id) {
    try {
      const { patchGoogleEvent } = await import("./google.server");
      await patchGoogleEvent(admin, params.companyId, ag.google_event_id, { inicio: check.inicio, fim: check.fim });
      googleSynced = true;
    } catch (e: any) {
      googleError = String(e?.message ?? e);
      console.error("[agenda.google.patch]", params.companyId, googleError);
    }
  }
  return { status: "created", agendamento: updated as Agendamento, timezone: check.timezone, googleSynced, googleError };
}

export async function cancelarAgendamento(
  admin: any,
  params: { companyId: string; id: string; motivo?: string | null },
): Promise<{ ok: boolean; message: string; agendamento?: Agendamento; googleError?: string | null }> {
  const { data: ag } = await admin
    .from("agendamento")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("id", params.id)
    .maybeSingle();
  if (!ag) return { ok: false, message: "Agendamento não encontrado." };
  if (ag.status === "cancelado") return { ok: true, message: "Este agendamento já estava cancelado.", agendamento: ag as Agendamento };

  const obs = [ag.observacoes, params.motivo ? `Cancelado: ${params.motivo}` : ""].filter(Boolean).join("\n").slice(0, 2000);
  const { data: updated } = await admin
    .from("agendamento")
    .update({ status: "cancelado", cancelado_at: new Date().toISOString(), observacoes: obs })
    .eq("id", ag.id)
    .eq("company_id", params.companyId)
    .select("*")
    .maybeSingle();

  let googleError: string | null = null;
  if (ag.google_event_id) {
    try {
      const { deleteGoogleEvent } = await import("./google.server");
      await deleteGoogleEvent(admin, params.companyId, ag.google_event_id);
    } catch (e: any) {
      googleError = String(e?.message ?? e);
      console.error("[agenda.google.delete]", params.companyId, googleError);
    }
  }
  return { ok: true, message: "Agendamento cancelado.", agendamento: (updated ?? ag) as Agendamento, googleError };
}

export async function listAgendamentos(
  admin: any,
  companyId: string,
  opts: { from?: string | null; to?: string | null; numero?: string | null; status?: string | null; limit?: number } = {},
): Promise<Agendamento[]> {
  let q = admin.from("agendamento").select("*").eq("company_id", companyId).order("inicio", { ascending: true });
  if (opts.from) q = q.gte("inicio", opts.from);
  if (opts.to) q = q.lte("inicio", opts.to);
  if (opts.numero) q = q.eq("numero", opts.numero);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q.limit(Math.min(500, Math.max(1, opts.limit ?? 200)));
  return (data ?? []) as Agendamento[];
}

/** Agendamentos ativos e futuros de um contato. */
export async function findAgendamentosDoContato(
  admin: any,
  companyId: string,
  numero: string,
  cardId?: string | null,
): Promise<Agendamento[]> {
  const nowIso = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await admin
    .from("agendamento")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "agendado")
    .gte("inicio", nowIso)
    .order("inicio", { ascending: true })
    .limit(20);
  const rows = (data ?? []) as Agendamento[];
  return rows.filter((r) => r.numero === numero || (cardId && r.card_id === cardId));
}

// ------------------------------------------------------------------ lembretes

/**
 * Lembretes de agendamento. Roda no MESMO cron do follow-up (nenhum worker novo).
 * Isolado do follow-up comercial: não move lead, não reinicia cadência, não finaliza.
 * Idempotente via colunas lembrete_24h_em / lembrete_2h_em.
 */
export async function processAppointmentReminders(admin: any, limit = 50) {
  const now = Date.now();
  const { data } = await admin
    .from("agendamento")
    .select("id, company_id, numero, channel, titulo, inicio, service_id, lembrete_24h_em, lembrete_2h_em")
    .eq("status", "agendado")
    .gte("inicio", new Date(now - 60 * 60_000).toISOString())
    .lte("inicio", new Date(now + 25 * 60 * 60_000).toISOString())
    .order("inicio", { ascending: true })
    .limit(Math.min(200, Math.max(1, limit)));

  const rows = (data ?? []) as any[];
  let sent = 0;
  let skipped = 0;

  for (const ag of rows) {
    if (!ag.numero) { skipped++; continue; }
    const startMs = new Date(ag.inicio).getTime();
    const minsLeft = (startMs - now) / 60_000;
    let kind: "24h" | "2h" | null = null;
    if (minsLeft <= 24 * 60 && minsLeft > 12 * 60 && !ag.lembrete_24h_em) kind = "24h";
    else if (minsLeft <= 2 * 60 && minsLeft > 15 && !ag.lembrete_2h_em) kind = "2h";
    if (!kind) { skipped++; continue; }

    // Empresa suspensa/inadimplente: não envia lembrete.
    const { isCompanyOperational } = await import("@/lib/billing-guard.server");
    if (!(await isCompanyOperational(admin, ag.company_id))) { skipped++; continue; }

    const col = kind === "24h" ? "lembrete_24h_em" : "lembrete_2h_em";

    // claim antes de enviar (idempotência sob concorrência)
    const { data: claimed } = await admin
      .from("agendamento")
      .update({ [col]: new Date().toISOString() })
      .eq("id", ag.id)
      .eq("status", "agendado")
      .is(col, null)
      .select("id")
      .maybeSingle();
    if (!claimed) { skipped++; continue; }

    try {
      const svcAtivo = await (async () => {
        if (!ag.service_id) return true;
        const { data: s } = await admin.from("agenda_servico").select("lembretes_ativos").eq("id", ag.service_id).maybeSingle();
        return s ? !!s.lembretes_ativos : true;
      })();
      if (!svcAtivo) { skipped++; continue; }

      const ctx = await getAgendaContext(admin, ag.company_id);
      const quando = formatSlotLabel(new Date(ag.inicio), ctx.timezone);
      const texto =
        kind === "24h"
          ? `Oi! Passando pra lembrar do seu ${ag.titulo || "agendamento"} amanhã, ${quando}. Continua tudo certo?`
          : `Oi! Seu ${ag.titulo || "agendamento"} é hoje, ${quando}. Te espero!`;

      const { resolveChannelTarget, sendChannelText } = await import("./channels.server");
      const target = await resolveChannelTarget(admin, ag.company_id, ag.numero);
      if (!target) { skipped++; continue; }
      await sendChannelText(target, texto);
      sent++;
    } catch (e: any) {
      console.error("[agenda.lembrete]", ag.id, e?.message);
      await admin.from("agendamento").update({ [col]: null }).eq("id", ag.id);
    }
  }

  return { reminders_sent: sent, reminders_skipped: skipped };
}
