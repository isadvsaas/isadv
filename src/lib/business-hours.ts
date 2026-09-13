// Pure helper: decide if a given Date is inside the company's business hours.
// Shape stored at agent_config.horarios_atendimento:
// { enabled: boolean, timezone: string, dias: { "0": null | {abre:"HH:MM",fecha:"HH:MM"}, ... "6": ... } }

export type DaySchedule = { abre: string; fecha: string } | null;
export type BusinessHours = {
  enabled: boolean;
  timezone: string;
  dias: Record<string, DaySchedule>;
};

export function defaultHours(): BusinessHours {
  return {
    enabled: false,
    timezone: "America/Sao_Paulo",
    dias: {
      "0": null,
      "1": { abre: "09:00", fecha: "18:00" },
      "2": { abre: "09:00", fecha: "18:00" },
      "3": { abre: "09:00", fecha: "18:00" },
      "4": { abre: "09:00", fecha: "18:00" },
      "5": { abre: "09:00", fecha: "18:00" },
      "6": null,
    },
  };
}

function getZonedParts(date: Date, tz: string): { dow: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: map[wd] ?? 0, minutes: hh * 60 + mm };
}

function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function isWithinBusinessHours(h: BusinessHours | null | undefined, now: Date = new Date()): boolean {
  if (!h || !h.enabled) return true; // disabled = sempre dentro
  const tz = h.timezone || "America/Sao_Paulo";
  let parts;
  try {
    parts = getZonedParts(now, tz);
  } catch {
    parts = getZonedParts(now, "America/Sao_Paulo");
  }
  const day = h.dias?.[String(parts.dow)] ?? null;
  if (!day) return false;
  const open = hhmmToMinutes(day.abre);
  const close = hhmmToMinutes(day.fecha);
  if (open == null || close == null) return false;
  // Suporta janela cruzando meia-noite (ex: 22:00 → 02:00)
  if (close > open) return parts.minutes >= open && parts.minutes < close;
  return parts.minutes >= open || parts.minutes < close;
}

export const DIA_LABEL: Record<string, string> = {
  "0": "Domingo",
  "1": "Segunda",
  "2": "Terça",
  "3": "Quarta",
  "4": "Quinta",
  "5": "Sexta",
  "6": "Sábado",
};
