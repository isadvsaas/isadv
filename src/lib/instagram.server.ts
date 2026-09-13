// BLOCO 5 — Wrapper server-only da Meta Graph API (Instagram Messaging).
// Arquivo *.server.ts nunca entra no bundle client.

const GRAPH_VERSION = "v21.0";

function graphBase() {
  return (process.env["META_GRAPH_URL"] || `https://graph.facebook.com/${GRAPH_VERSION}`).replace(/\/+$/, "");
}

async function graph<T = any>(
  path: string,
  init: { method?: string; token: string; json?: any; query?: Record<string, string> } ,
): Promise<T> {
  const url = new URL(`${graphBase()}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${init.token}`,
        "Content-Type": "application/json",
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  } catch (e: any) {
    throw new Error(`Instagram indisponível: ${e?.message || "falha de rede"}.`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text || `HTTP ${res.status}`;
    throw new Error(`Instagram: ${msg}`);
  }
  return data as T;
}

export type IgAccount = {
  igUserId: string;
  username: string | null;
  pageId: string | null;
  pageName: string | null;
  pageToken: string;
};

/**
 * Resolve a conta do Instagram a partir de um token.
 * Aceita token de Página (Facebook Login) OU token de Instagram Login.
 */
export async function igResolveAccount(token: string): Promise<IgAccount> {
  // 1) Instagram Login: /me devolve direto o id/username da conta IG.
  try {
    const me: any = await graph("/me", { token, query: { fields: "id,username" } });
    if (me?.id && me?.username) {
      return { igUserId: String(me.id), username: String(me.username), pageId: null, pageName: null, pageToken: token };
    }
  } catch {}

  // 2) Facebook Login: percorre as Páginas e acha a conta IG vinculada.
  const pages: any = await graph("/me/accounts", {
    token,
    query: { fields: "id,name,access_token,instagram_business_account{id,username}" },
  });
  const list: any[] = Array.isArray(pages?.data) ? pages.data : [];
  const hit = list.find((p) => p?.instagram_business_account?.id);
  if (!hit) {
    throw new Error(
      "Nenhuma conta profissional do Instagram vinculada às suas Páginas. Vincule a conta do Instagram à Página do Facebook e tente de novo.",
    );
  }
  return {
    igUserId: String(hit.instagram_business_account.id),
    username: hit.instagram_business_account.username ?? null,
    pageId: String(hit.id),
    pageName: hit.name ?? null,
    pageToken: String(hit.access_token || token),
  };
}

/** Envia mensagem de texto para um IGSID. */
export async function igSendText(token: string, igsid: string, text: string) {
  return graph("/me/messages", {
    method: "POST",
    token,
    json: { recipient: { id: igsid }, message: { text: text.slice(0, 950) } },
  });
}

/** Indicador de "digitando…" (best-effort, nunca quebra o fluxo). */
export async function igSendTyping(token: string, igsid: string, on = true) {
  try {
    await graph("/me/messages", {
      method: "POST",
      token,
      json: { recipient: { id: igsid }, sender_action: on ? "typing_on" : "typing_off" },
    });
  } catch {
    // best-effort
  }
}

/** Nome/username do contato (para exibir na inbox e no CRM). */
export async function igFetchContact(token: string, igsid: string): Promise<{ nome: string | null; username: string | null }> {
  try {
    const p: any = await graph(`/${encodeURIComponent(igsid)}`, { token, query: { fields: "name,username" } });
    return { nome: p?.name ?? p?.username ?? null, username: p?.username ?? null };
  } catch {
    return { nome: null, username: null };
  }
}

/** Baixa a mídia recebida (URLs assinadas da CDN da Meta) e devolve base64. */
export async function igDownloadMedia(url: string): Promise<{ base64: string; mimetype: string | null } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimetype = res.headers.get("content-type");
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return { base64: btoa(binary), mimetype: mimetype ? mimetype.split(";")[0]!.trim() : null };
  } catch {
    return null;
  }
}

/** Assina a app na conta (best-effort; requer token de Página). */
export async function igSubscribePage(token: string, pageId: string) {
  try {
    await graph(`/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST",
      token,
      query: { subscribed_fields: "messages,messaging_postbacks,messaging_seen" },
    });
    return true;
  } catch (e: any) {
    console.warn("[instagram.subscribe]", e?.message);
    return false;
  }
}

// BLOCO MÍDIAS — anexos do Instagram Direct. A Meta busca o arquivo pela URL informada,
// por isso o backend gera uma URL assinada temporária do bucket privado.
export type IgAttachmentType = "image" | "video" | "audio" | "file";

export async function igSendAttachment(token: string, igsid: string, type: IgAttachmentType, url: string) {
  return graph("/me/messages", {
    method: "POST",
    token,
    json: {
      recipient: { id: igsid },
      message: { attachment: { type, payload: { url, is_reusable: false } } },
    },
  });
}
