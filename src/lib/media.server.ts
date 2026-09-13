// Server-only: interpretação de mídia recebida no WhatsApp (áudio, imagem, documento).
// Converte cada mídia em TEXTO para seguir pelo mesmo pipeline de texto já existente.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GATEWAY_MODEL = "google/gemini-2.5-flash";

export const OPENAI_AUDIO_MODEL = "gpt-4o-mini-transcribe";
export const OPENAI_VISION_MODEL = "gpt-4o-mini";
export const OPENAI_DOC_MODEL = "gpt-4o-mini";

/** Chave própria da empresa (BYOK) quando existir; senão, chave global da plataforma. */
function resolveOpenAiKey(companyKey?: string): string {
  return (companyKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "");
}

export type MediaKind = "audio" | "image" | "document";

export type IncomingMedia = {
  kind: MediaKind;
  mimetype: string;
  fileName: string | null;
  caption: string | null;
};

/** Detecta mídia na mensagem crua da Evolution. Retorna null para texto puro. */
export function detectMedia(msg: any): IncomingMedia | null {
  if (!msg || typeof msg !== "object") return null;
  const audio = msg.audioMessage ?? msg.pttMessage;
  if (audio) {
    return {
      kind: "audio",
      mimetype: audio.mimetype || "audio/ogg",
      fileName: null,
      caption: null,
    };
  }
  const image = msg.imageMessage;
  if (image) {
    return {
      kind: "image",
      mimetype: image.mimetype || "image/jpeg",
      fileName: null,
      caption: typeof image.caption === "string" && image.caption.trim() ? image.caption.trim() : null,
    };
  }
  const doc = msg.documentMessage ?? msg.documentWithCaptionMessage?.message?.documentMessage;
  if (doc) {
    return {
      kind: "document",
      mimetype: doc.mimetype || "application/octet-stream",
      fileName: doc.fileName || doc.title || null,
      caption: typeof doc.caption === "string" && doc.caption.trim() ? doc.caption.trim() : null,
    };
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.includes("base64,") ? base64.split("base64,").pop()! : base64;
  const bin = atob(clean.replace(/\s/g, ""));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extFromMime(mime: string) {
  const m = mime.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/amr": "amr",
  };
  return map[m] || "ogg";
}

async function gatewayChat(content: any[], system: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente para fallback de mídia.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gateway mídia: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

async function openAiChat(key: string, model: string, content: any[], system: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

/** Transcreve áudio. Usa OpenAI quando a empresa tem chave; senão cai no gateway multimodal. */
export async function transcribeAudio(base64: string, mimetype: string, companyKey?: string): Promise<string> {
  const openaiKey = resolveOpenAiKey(companyKey);
  if (openaiKey) {
    const bytes = base64ToBytes(base64);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimetype.split(";")[0] }), `audio.${extFromMime(mimetype)}`);
    form.append("model", OPENAI_AUDIO_MODEL);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI áudio: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data: any = await res.json();
    return (data?.text ?? "").toString().trim();
  }

  const clean = base64.includes("base64,") ? base64.split("base64,").pop()! : base64;
  return gatewayChat(
    [
      { type: "text", text: "Transcreva literalmente este áudio em português. Responda apenas com a transcrição." },
      { type: "input_audio", input_audio: { data: clean, format: extFromMime(mimetype) === "ogg" ? "ogg" : extFromMime(mimetype) } },
    ],
    "Você transcreve áudios de WhatsApp com fidelidade.",
  );
}

/** Descreve uma imagem de forma objetiva e útil para o atendimento. */
export async function describeImage(
  base64: string,
  mimetype: string,
  caption: string | null,
  companyKey?: string,
): Promise<string> {
  const openaiKey = resolveOpenAiKey(companyKey);
  const clean = base64.includes("base64,") ? base64.split("base64,").pop()! : base64;
  const dataUrl = `data:${mimetype.split(";")[0]};base64,${clean}`;
  const system =
    "Você analisa imagens enviadas por clientes no WhatsApp de uma empresa. " +
    "Descreva objetivamente o que a imagem contém, incluindo textos visíveis, valores, produtos, comprovantes ou documentos. " +
    "Seja curto (até 80 palavras) e factual, sem cumprimentar e sem falar com o cliente.";
  const content: any[] = [
    { type: "text", text: caption ? `Legenda enviada pelo cliente: "${caption}". Descreva a imagem.` : "Descreva a imagem." },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
  if (openaiKey) return openAiChat(openaiKey, OPENAI_VISION_MODEL, content, system);
  return gatewayChat(content, system);
}

const TEXTUAL_MIMES = [
  "text/",
  "application/json",
  "application/xml",
  "application/csv",
];

export function isSupportedDocument(mimetype: string, fileName: string | null) {
  const m = (mimetype || "").split(";")[0].toLowerCase();
  if (m === "application/pdf") return true;
  if (TEXTUAL_MIMES.some((t) => m.startsWith(t))) return true;
  const name = (fileName || "").toLowerCase();
  return /\.(pdf|txt|csv|md|json|xml)$/.test(name);
}

/** Extrai/resume o conteúdo de um documento (PDF ou texto). */
export async function readDocument(
  base64: string,
  mimetype: string,
  fileName: string | null,
  caption: string | null,
  companyKey?: string,
): Promise<string> {
  const openaiKey = resolveOpenAiKey(companyKey);
  const clean = base64.includes("base64,") ? base64.split("base64,").pop()! : base64;
  const mime = (mimetype || "application/pdf").split(";")[0];
  const system =
    "Você lê documentos enviados por clientes no WhatsApp. " +
    "Extraia o conteúdo relevante (dados, valores, datas, nomes, pedidos) em até 150 palavras, de forma factual. " +
    "Não fale com o cliente, apenas relate o conteúdo.";

  if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" || mime === "application/csv") {
    const text = new TextDecoder().decode(base64ToBytes(clean)).slice(0, 20000);
    const content: any[] = [
      { type: "text", text: `Documento "${fileName ?? "arquivo"}"${caption ? ` (legenda: ${caption})` : ""}:\n\n${text}` },
    ];
    if (openaiKey) return openAiChat(openaiKey, OPENAI_DOC_MODEL, content, system);
    return gatewayChat(content, system);
  }

  const content: any[] = [
    {
      type: "text",
      text: `Leia o documento "${fileName ?? "arquivo.pdf"}"${caption ? ` (legenda do cliente: ${caption})` : ""} e relate o conteúdo.`,
    },
    { type: "file", file: { filename: fileName || "documento.pdf", file_data: `data:${mime};base64,${clean}` } },
  ];
  if (openaiKey) return openAiChat(openaiKey, OPENAI_DOC_MODEL, content, system);
  return gatewayChat(content, system);
}
