// BLOCO MÍDIAS — Camada central de envio, provider-neutral.
// Todo o resto do sistema (IA, Inbox, biblioteca de materiais) fala com este módulo.
// Quem sabe falar Evolution/Instagram é o resolvedor de canal, nunca o chamador.
//
//   AtendZap → outbound-message.server → channels.server → Evolution | Instagram
//
// Regras: nada é gravado como enviado antes do provider confirmar; retry nunca
// duplica mídia (idempotency key persistida em mensagens.response_key).

export const MEDIA_BUCKET = "materiais";

export type OutboundKind = "text" | "image" | "audio" | "video" | "document" | "link";
export type SenderType = "ai" | "human" | "system";

export type OutboundMedia = {
  storagePath?: string | null;
  externalUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

export type OutboundInput = {
  companyId: string;
  userId: string;
  contactId: string; // coluna `numero`
  contatoNome?: string | null;
  senderType: SenderType;
  agentId?: string | null;
  kind: OutboundKind;
  texto?: string | null; // texto (kind=text) ou URL do link (kind=link)
  caption?: string | null;
  media?: OutboundMedia | null;
  idempotencyKey?: string | null;
  materialId?: string | null;
  transcricao?: string | null;
};

export type OutboundResult = {
  ok: true;
  messageId: string | null;
  providerMessageId: string | null;
  duplicate: boolean;
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME: Record<Exclude<OutboundKind, "text" | "link">, RegExp> = {
  image: /^image\/(jpeg|jpg|png|webp|gif)$/i,
  audio: /^audio\//i,
  video: /^video\//i,
  document: /^(application\/pdf|application\/vnd|application\/msword|application\/zip|text\/|application\/json|application\/xml)/i,
};

export function sanitizeFileName(name: string | null | undefined, fallback = "arquivo"): string {
  const base = String(name || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || fallback).slice(0, 120);
}

export function kindFromMime(mime: string | null | undefined, fileName?: string | null): Exclude<OutboundKind, "text" | "link"> {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (/\.(jpe?g|png|webp|gif)$/i.test(fileName || "")) return "image";
  if (/\.(mp3|ogg|opus|m4a|wav)$/i.test(fileName || "")) return "audio";
  if (/\.(mp4|mov|webm|3gp)$/i.test(fileName || "")) return "video";
  return "document";
}

/** Valida tipo/mime/tamanho no servidor. Nunca confiar no navegador. */
export function assertValidMedia(kind: Exclude<OutboundKind, "text" | "link">, mime: string | null | undefined, bytes?: number) {
  const m = String(mime || "").split(";")[0]!.trim();
  if (!m) throw new Error("Não foi possível identificar o tipo do arquivo.");
  const rule = ALLOWED_MIME[kind];
  if (!rule.test(m)) {
    throw new Error(`Este arquivo não é compatível com o tipo "${kind}". Envie outro arquivo.`);
  }
  if (typeof bytes === "number" && bytes > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo muito grande. O limite é 25 MB.");
  }
}

// ------------------------------------------------------------------ storage

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.includes("base64,") ? base64.split("base64,").pop()! : base64;
  const bin = atob(clean.replace(/\s/g, ""));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extFor(mime: string | null | undefined, fileName?: string | null) {
  const fromName = String(fileName || "").match(/\.([A-Za-z0-9]{1,6})$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  const m = String(mime || "").split(";")[0]!.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/webm": "webm",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv",
  };
  return map[m] || "bin";
}

/** Guarda o arquivo na pasta privada da empresa e devolve o storage_path. */
export async function storeMediaBytes(
  admin: any,
  companyId: string,
  bytes: Uint8Array,
  mime: string | null | undefined,
  fileName?: string | null,
): Promise<string> {
  const ext = extFor(mime, fileName);
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: String(mime || "application/octet-stream").split(";")[0],
    upsert: false,
  });
  if (error) throw new Error(`Falha ao guardar o arquivo: ${error.message}`);
  return path;
}

export async function storeMediaBase64(
  admin: any,
  companyId: string,
  base64: string,
  mime: string | null | undefined,
  fileName?: string | null,
): Promise<string> {
  return storeMediaBytes(admin, companyId, base64ToBytes(base64), mime, fileName);
}

/** URL temporária (usada por providers que buscam o arquivo pela rede). */
export async function signMediaUrl(admin: any, storagePath: string, seconds = 3600): Promise<string> {
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, seconds);
  if (error || !data?.signedUrl) throw new Error(`Falha ao liberar o arquivo: ${error?.message ?? "sem URL"}`);
  return data.signedUrl as string;
}

export async function downloadMediaBase64(admin: any, storagePath: string): Promise<{ base64: string; mime: string | null }> {
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Arquivo não encontrado: ${error?.message ?? storagePath}`);
  const buf = new Uint8Array(await (data as Blob).arrayBuffer());
  return { base64: bytesToBase64(buf), mime: (data as Blob).type || null };
}

/** Garante que o caminho pertence à empresa (nunca aceitar caminho vindo do cliente sem validar). */
export function assertOwnedPath(companyId: string, storagePath: string) {
  if (!storagePath.startsWith(`${companyId}/`)) throw new Error("Arquivo não pertence a esta empresa.");
}

// ------------------------------------------------------------------ envio

async function alreadySent(admin: any, companyId: string, key: string) {
  const { data } = await admin
    .from("mensagens")
    .select("id, provider_message_id")
    .eq("company_id", companyId)
    .eq("response_key", key)
    .maybeSingle();
  return data as { id: string; provider_message_id: string | null } | null;
}

/**
 * Envio central. Resolve o canal, envia pelo provider correto, e só depois
 * persiste a mensagem no histórico. Falha do provider => exceção (nunca "sucesso").
 */
export async function sendOutbound(admin: any, input: OutboundInput, targetHint?: any): Promise<OutboundResult> {
  const key = input.idempotencyKey?.trim() || null;
  if (key) {
    const dup = await alreadySent(admin, input.companyId, key);
    if (dup) return { ok: true, messageId: dup.id, providerMessageId: dup.provider_message_id, duplicate: true };
  }

  const { resolveChannelTarget, sendChannelText, sendChannelMedia } = await import("./channels.server");
  const target = targetHint ?? (await resolveChannelTarget(admin, input.companyId, input.contactId));
  if (!target.ready) throw new Error(target.reason === "instagram desconectado" ? "Instagram não conectado" : "WhatsApp não conectado");

  const caption = (input.caption || "").trim() || null;
  let providerMessageId: string | null = null;
  let texto = "";
  let midia: any = null;

  if (input.kind === "text" || input.kind === "link") {
    const body =
      input.kind === "link"
        ? [caption, String(input.texto || "").trim()].filter(Boolean).join("\n")
        : String(input.texto || "").trim();
    if (!body) throw new Error("Mensagem vazia.");
    const res = await sendChannelText(target, body);
    providerMessageId = extractProviderId(res);
    texto = body;
    if (input.kind === "link") midia = { tipo: "link", external_url: String(input.texto || "").trim() };
  } else {
    const media = input.media ?? {};
    let signedUrl: string | null = null;
    let base64: string | null = null;
    let mime = media.mimeType ?? null;
    const fileName = media.fileName ? sanitizeFileName(media.fileName) : null;

    if (media.storagePath) {
      assertOwnedPath(input.companyId, media.storagePath);
      if (target.channel === "instagram") {
        signedUrl = await signMediaUrl(admin, media.storagePath, 3600);
      } else {
        const dl = await downloadMediaBase64(admin, media.storagePath);
        base64 = dl.base64;
        mime = mime || dl.mime;
      }
    } else if (media.externalUrl) {
      signedUrl = media.externalUrl;
    } else {
      throw new Error("Nenhum arquivo informado para envio.");
    }

    assertValidMedia(input.kind, mime || guessMimeFromKind(input.kind), undefined);

    const res = await sendChannelMedia(target, {
      kind: input.kind,
      base64,
      url: signedUrl,
      mimeType: mime,
      fileName,
      caption,
    });
    providerMessageId = extractProviderId(res);
    texto = caption || fallbackLabel(input.kind, fileName);
    midia = {
      tipo: input.kind,
      storage_path: media.storagePath ?? null,
      external_url: media.externalUrl ?? null,
      mime_type: mime,
      file_name: fileName,
      caption,
    };
  }

  const { data: row, error } = await admin
    .from("mensagens")
    .insert({
      company_id: input.companyId,
      user_id: input.userId,
      numero: input.contactId,
      channel: target.channel,
      contato_nome: input.contatoNome ?? null,
      direcao: "saida",
      autor: input.senderType === "ai" ? "ia" : input.senderType === "human" ? "humano" : "sistema",
      texto,
      tipo: input.kind === "link" ? "text" : input.kind,
      midia: midia ? { ...midia, material_id: input.materialId ?? null } : null,
      provider_message_id: providerMessageId,
      response_key: key,
      ai_processed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    // Mensagem já foi entregue; apenas o registro falhou — não repetir o envio.
    console.error("[outbound.persist]", error.message);
  }

  return { ok: true, messageId: (row as any)?.id ?? null, providerMessageId, duplicate: false };
}

function guessMimeFromKind(kind: OutboundKind) {
  return kind === "image" ? "image/jpeg" : kind === "audio" ? "audio/ogg" : kind === "video" ? "video/mp4" : "application/pdf";
}

export function fallbackLabel(kind: OutboundKind, fileName?: string | null) {
  if (kind === "image") return "[Imagem]";
  if (kind === "audio") return "[Áudio]";
  if (kind === "video") return "[Vídeo]";
  if (kind === "document") return `[Documento: ${fileName || "arquivo"}]`;
  return "";
}

function extractProviderId(res: any): string | null {
  const id = res?.key?.id ?? res?.message_id ?? res?.id ?? res?.data?.key?.id ?? null;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

// Atalhos nomeados (API pedida no bloco).
export const sendText = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "text" });
export const sendImage = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "image" });
export const sendAudio = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "audio" });
export const sendVideo = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "video" });
export const sendDocument = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "document" });
export const sendLink = (admin: any, i: Omit<OutboundInput, "kind">) => sendOutbound(admin, { ...i, kind: "link" });
