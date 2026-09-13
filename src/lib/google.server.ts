import { createHmac } from "node:crypto";

export function signState(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback";
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyState(state: string): { companyId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback";
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  if (sig !== expected) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!obj.companyId) return null;
    return { companyId: obj.companyId as string };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- token (reutiliza OAuth/refresh atuais)

type GoogleSession = { accessToken: string; calendarId: string };

/**
 * Resolve o access_token válido da empresa, refrescando pelo refresh_token existente.
 * Tokens NUNCA saem do servidor.
 */
export async function getGoogleSession(admin: any, companyId: string): Promise<GoogleSession> {
  const { data: gi } = await admin.from("google_integration").select("*").eq("company_id", companyId).maybeSingle();
  if (!gi?.conectado) throw new Error("Google Agenda não conectado");

  let accessToken = gi.access_token as string;
  if (gi.expiry && new Date(gi.expiry).getTime() < Date.now() + 60_000 && gi.refresh_token) {
    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: gi.refresh_token as string,
        grant_type: "refresh_token",
      }),
    });
    const tok = await tokRes.json();
    if (tok.access_token) {
      accessToken = tok.access_token;
      await admin
        .from("google_integration")
        .update({
          access_token: accessToken,
          expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
        })
        .eq("company_id", companyId);
    }
  }
  if (!accessToken) throw new Error("Google Agenda não conectado");
  return { accessToken, calendarId: (gi.calendar_id as string) || "primary" };
}

export async function isGoogleConnected(admin: any, companyId: string): Promise<boolean> {
  const { data } = await admin.from("google_integration").select("conectado").eq("company_id", companyId).maybeSingle();
  return !!data?.conectado;
}

async function gcal(session: GoogleSession, path: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google API ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ------------------------------------------------------------- free/busy e eventos

export async function googleFreeBusy(
  admin: any,
  companyId: string,
  timeMin: string,
  timeMax: string,
): Promise<Array<{ start: string; end: string }>> {
  const session = await getGoogleSession(admin, companyId);
  const out = await gcal(session, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: session.calendarId }] }),
  });
  const cal = out?.calendars?.[session.calendarId];
  if (cal?.errors?.length) throw new Error(`freeBusy: ${cal.errors[0]?.reason ?? "erro"}`);
  return (cal?.busy ?? []) as Array<{ start: string; end: string }>;
}

export async function getGoogleEvent(admin: any, companyId: string, eventId: string) {
  const session = await getGoogleSession(admin, companyId);
  return gcal(session, `/calendars/${encodeURIComponent(session.calendarId)}/events/${encodeURIComponent(eventId)}`);
}

export async function insertGoogleEvent(
  admin: any,
  companyId: string,
  data: { titulo: string; inicio: string; fim: string; descricao?: string },
): Promise<{ id: string } | null> {
  const session = await getGoogleSession(admin, companyId);
  const ev = await gcal(session, `/calendars/${encodeURIComponent(session.calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: data.titulo,
      description: data.descricao || "",
      start: { dateTime: data.inicio },
      end: { dateTime: data.fim },
    }),
  });
  return ev?.id ? { id: ev.id as string } : null;
}

export async function patchGoogleEvent(
  admin: any,
  companyId: string,
  eventId: string,
  data: { inicio?: string; fim?: string; titulo?: string; descricao?: string },
) {
  const session = await getGoogleSession(admin, companyId);
  const body: Record<string, any> = {};
  if (data.inicio) body['start'] = { dateTime: data.inicio };
  if (data.fim) body['end'] = { dateTime: data.fim };
  if (data.titulo) body['summary'] = data.titulo;
  if (data.descricao !== undefined) body['description'] = data.descricao;
  return gcal(session, `/calendars/${encodeURIComponent(session.calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteGoogleEvent(admin: any, companyId: string, eventId: string) {
  const session = await getGoogleSession(admin, companyId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(session.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  // 404/410 = já removido no Google → cancelamento repetido não é erro crítico
  if (!res.ok && ![404, 410].includes(res.status)) {
    throw new Error(`Google API ${res.status}`);
  }
  return { ok: true };
}

// ------------------------------------------------------------- compatibilidade

/**
 * Mantido por compatibilidade: cria evento + registro interno.
 * O caminho oficial agora é createAgendamento() em scheduling.server.ts,
 * que valida disponibilidade antes de gravar.
 */
export async function createCalendarEventForCompany(
  admin: any,
  companyId: string,
  data: { titulo: string; inicio: string; fim: string; descricao?: string; cardId?: string | null; numero?: string | null },
) {
  const { createAgendamento } = await import("./scheduling.server");
  const r = await createAgendamento(admin, {
    companyId,
    inicio: data.inicio,
    fim: data.fim,
    titulo: data.titulo,
    cardId: data.cardId ?? null,
    numero: data.numero ?? null,
    observacoes: data.descricao ?? "",
    criadoPor: "ia",
  });
  if (r.status !== "created") throw new Error(r.status === "conflict" ? r.message : r.message);
  return { eventId: r.agendamento.google_event_id };
}
