import * as QRCode from "qrcode";

// Wrapper server-only para a Evolution API v2.
// Arquivo *.server.ts é bloqueado do bundle client.

const SUPPORT_SUFFIX = " Se persistir, fale com o suporte: https://wa.me/5551982913030";

function env() {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) {
    throw new Error(`Servidor do WhatsApp não configurado. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY nos segredos do backend.${SUPPORT_SUFFIX}`);
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function evo<T = any>(
  path: string,
  init: RequestInit & { json?: any } = {},
): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch (e: any) {
    throw new Error(`Evolution API indisponível: ${e?.message || "falha de rede"}.${SUPPORT_SUFFIX}`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Evolution API: ${msg}.${SUPPORT_SUFFIX}`);
  }
  return data as T;
}

export async function evoCreateInstance(instanceName: string, webhookUrl?: string) {
  // Evolution v2: POST /instance/create
  const body: any = {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  };
  if (webhookUrl) {
    body.webhook = {
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ["MESSAGES_UPSERT"],
    };
  }
  return evo(`/instance/create`, { method: "POST", json: body });
}

export async function evoConnect(instanceName: string): Promise<{ base64?: string; code?: string; pairingCode?: string }> {
  // GET /instance/connect/{instance} → { base64, code, pairingCode }
  return evo(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
}

function asImageDataUrl(value: unknown, allowRawBase64 = false): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.startsWith("data:image/")) return text;
  const base64 = text.includes("base64,") ? text.split("base64,").pop()?.trim() : text;
  if (allowRawBase64 && base64 && base64.length > 120 && /^[A-Za-z0-9+/=\s]+$/.test(base64) && looksLikeImageBase64(base64)) {
    return `data:image/png;base64,${base64.replace(/\s/g, "")}`;
  }
  return null;
}

function looksLikeImageBase64(base64: string) {
  try {
    const bin = atob(base64.replace(/\s/g, "").slice(0, 64));
    return (
      (bin.charCodeAt(0) === 0x89 && bin.slice(1, 4) === "PNG") ||
      (bin.charCodeAt(0) === 0xff && bin.charCodeAt(1) === 0xd8) ||
      (bin.slice(0, 4) === "RIFF" && bin.slice(8, 12) === "WEBP")
    );
  } catch {
    return false;
  }
}

function extractQrCode(payload: any): string | null {
  const candidates = [
    payload?.code,
    payload?.qrcode?.code,
    payload?.qrCode,
    payload?.qrcode,
    payload?.qr,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() && !asImageDataUrl(value, false)) return value.trim();
  }
  return null;
}

export async function evoGetQr(instanceName: string): Promise<{ qrBase64: string | null; code: string | null; pairingCode: string | null }> {
  const payload: any = await evoConnect(instanceName);
  const image =
    asImageDataUrl(payload?.base64, true) ||
    asImageDataUrl(payload?.qrcode?.base64, true) ||
    asImageDataUrl(payload?.qr?.base64, true) ||
    asImageDataUrl(payload?.qrcode, true) ||
    asImageDataUrl(payload?.qr, true);
  const code = extractQrCode(payload);

  if (image) return { qrBase64: image, code, pairingCode: payload?.pairingCode ?? payload?.qrcode?.pairingCode ?? null };
  if (code) {
    const qrBase64 = await QRCode.toDataURL(code, { width: 320, margin: 2, errorCorrectionLevel: "M" });
    return { qrBase64, code, pairingCode: payload?.pairingCode ?? payload?.qrcode?.pairingCode ?? null };
  }
  return { qrBase64: null, code: null, pairingCode: payload?.pairingCode ?? payload?.qrcode?.pairingCode ?? null };
}

export async function evoState(instanceName: string): Promise<{ instance?: { state?: string }; state?: string }> {
  return evo(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
}

export async function evoSetWebhook(instanceName: string, webhookUrl: string) {
  return evo(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    json: {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    },
  });
}

export async function evoSendText(instanceName: string, number: string, text: string) {
  return evo(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    json: { number, text },
  });
}

// Baixa a mídia de uma mensagem recebida e devolve o base64 (Evolution v2).
export async function evoGetMediaBase64(
  instanceName: string,
  message: { key: any; message?: any },
): Promise<{ base64: string; mimetype: string | null; fileName: string | null } | null> {
  const res: any = await evo(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    json: { message, convertToMp4: false },
  });
  const payload = res?.data ?? res;
  const base64: string | undefined = payload?.base64 ?? payload?.media ?? payload?.buffer;
  if (!base64 || typeof base64 !== "string") return null;
  return {
    base64,
    mimetype: payload?.mimetype ?? payload?.mimeType ?? null,
    fileName: payload?.fileName ?? payload?.filename ?? null,
  };
}


export async function evoSendPresence(instanceName: string, number: string, presence: "composing" | "paused" | "available", delayMs = 1500) {
  try {
    await evo(`/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      json: { number, presence, delay: delayMs },
    });
  } catch {
    // best-effort
  }
}

export async function evoLogout(instanceName: string) {
  return evo(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export async function evoDelete(instanceName: string) {
  return evo(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export async function evoFetchNumberFromInstance(instanceName: string): Promise<string | null> {
  try {
    const data: any = await evo(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
      method: "GET",
    });
    const inst = Array.isArray(data) ? data[0] : data?.[0] ?? data;
    return inst?.instance?.owner || inst?.owner || inst?.number || null;
  } catch {
    return null;
  }
}

// BLOCO MÍDIAS — envio de mídia (Evolution v2). Endpoints oficiais da mesma versão já usada.
export type EvoMediaType = "image" | "video" | "document";

export async function evoSendMedia(
  instanceName: string,
  number: string,
  args: { mediatype: EvoMediaType; media: string; mimetype?: string | null; fileName?: string | null; caption?: string | null },
) {
  return evo(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    json: {
      number,
      mediatype: args.mediatype,
      media: args.media,
      ...(args.mimetype ? { mimetype: args.mimetype } : {}),
      ...(args.fileName ? { fileName: args.fileName } : {}),
      ...(args.caption ? { caption: args.caption } : {}),
    },
  });
}

export async function evoSendAudio(instanceName: string, number: string, audioBase64OrUrl: string) {
  return evo(`/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    json: { number, audio: audioBase64OrUrl },
  });
}
