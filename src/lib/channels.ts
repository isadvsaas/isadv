// BLOCO 5 — Abstração de CANAL (client-safe).
//
// Identidade da conversa continua sendo a coluna `numero` de mensagens/crm_cards/
// contact_pause/followup_state/etc. Para não quebrar NADA do WhatsApp (que grava o
// telefone puro), o Instagram usa um id namespaceado: `ig:<instagram_scoped_id>`.
// Assim todos os índices únicos, RLS, filtros e telas atuais continuam válidos.

export type Channel = "whatsapp" | "instagram";

export const IG_PREFIX = "ig:";

/** Canal de uma conversa a partir do id de contato armazenado em `numero`. */
export function channelOf(contactId: string | null | undefined): Channel {
  return String(contactId ?? "").startsWith(IG_PREFIX) ? "instagram" : "whatsapp";
}

/** Id de contato do Instagram (IGSID) → identidade interna. */
export function igContactId(igsid: string): string {
  const raw = String(igsid || "").trim();
  return raw.startsWith(IG_PREFIX) ? raw : `${IG_PREFIX}${raw}`;
}

/** Id externo real do contato (telefone no WhatsApp, IGSID no Instagram). */
export function externalIdOf(contactId: string): string {
  const raw = String(contactId || "");
  return raw.startsWith(IG_PREFIX) ? raw.slice(IG_PREFIX.length) : raw;
}

export function channelLabel(channel: Channel): string {
  return channel === "instagram" ? "Instagram" : "WhatsApp";
}

/** Rótulo curto e legível do contato (Instagram não tem telefone). */
export function contactDisplayId(contactId: string, nome?: string | null): string {
  if (channelOf(contactId) === "instagram") return nome?.trim() || `@instagram (${externalIdOf(contactId).slice(-6)})`;
  return contactId;
}

/** Janela de resposta permitida por canal, em horas. Meta: 7 dias no Instagram. */
export function replyWindowHours(channel: Channel): number {
  return channel === "instagram" ? 24 * 7 : 24;
}
