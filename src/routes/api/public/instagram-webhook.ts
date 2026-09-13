import { createFileRoute } from "@tanstack/react-router";
import { igContactId } from "@/lib/channels";

/**
 * BLOCO 5 — WEBHOOK RÁPIDO DO INSTAGRAM (somente RECEBIMENTO).
 * Mesmo contrato do webhook do WhatsApp: valida → grava mensagem → cancela follow-up
 * → enfileira job → 200. Todo o processamento pesado roda no worker da fila.
 *
 * Identidade da conversa: `ig:<IGSID>` na coluna `numero` (não colide com telefones).
 */
export const Route = createFileRoute("/api/public/instagram-webhook")({
  server: {
    handlers: {
      // Verificação do webhook exigida pela Meta.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") || "";
        const challenge = url.searchParams.get("hub.challenge") || "";
        if (mode !== "subscribe" || !token) return new Response("AtendAI Instagram webhook online", { status: 200 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const envToken = (process.env["META_VERIFY_TOKEN"] || "").trim();
          if (envToken && token === envToken) return new Response(challenge, { status: 200 });
          const { data } = await (supabaseAdmin as any)
            .from("instagram_integration")
            .select("company_id")
            .eq("verify_token", token)
            .maybeSingle();
          if (data) return new Response(challenge, { status: 200 });
        } catch (e: any) {
          console.error("[instagram-webhook.verify]", e?.message);
        }
        return new Response("invalid verify token", { status: 403 });
      },

      POST: async ({ request }) => {
        const t0 = Date.now();
        try {
          const raw = await request.text();
          // Assinatura da Meta: SEMPRE obrigatória. Sem META_APP_SECRET o webhook
          // permaneceria aberto silenciosamente, então falhamos fechado.
          const appSecret = (process.env["META_APP_SECRET"] || "").trim();
          if (!appSecret) {
            console.error("[instagram-webhook] META_APP_SECRET ausente — webhook recusado (fail-closed)");
            return new Response("webhook signature not configured", { status: 503 });
          }
          {
            const header = (request.headers.get("x-hub-signature-256") || "").trim();
            const provided = header.startsWith("sha256=") ? header.slice(7) : "";
            const { createHmac, timingSafeEqual } = await import("node:crypto");
            const expected = createHmac("sha256", appSecret).update(raw, "utf8").digest("hex");
            const a = Buffer.from(provided, "utf8");
            const b = Buffer.from(expected, "utf8");
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              console.warn("[instagram-webhook] assinatura inválida");
              return new Response("invalid signature", { status: 401 });
            }
          }
          let payload: any = {};
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            payload = {};
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


          const entries: any[] = Array.isArray(payload?.entry) ? payload.entry : [];
          if (!entries.length) return new Response("ok", { status: 200 });

          let queued = 0;
          for (const entry of entries) {
            const events: any[] = Array.isArray(entry?.messaging) ? entry.messaging : [];
            for (const ev of events) {
              const message = ev?.message;
              if (!message || message.is_echo) continue;

              const senderId = String(ev?.sender?.id || "").trim();
              const recipientId = String(ev?.recipient?.id || entry?.id || "").trim();
              if (!senderId || !recipientId) continue;

              // Resolve a empresa pela conta que RECEBEU a mensagem.
              const { data: ig } = await (supabaseAdmin as any)
                .from("instagram_integration")
                .select("company_id, user_id, ig_user_id, page_id, page_access_token, conectado")
                .or(`ig_user_id.eq.${recipientId},page_id.eq.${recipientId}`)
                .maybeSingle();
              if (!ig || !(ig as any).conectado) continue;

              const companyId = (ig as any).company_id as string;
              const userId = (ig as any).user_id as string | null;
              if (!userId) continue;

              const contactId = igContactId(senderId);
              const mid: string | null = typeof message.mid === "string" && message.mid.trim() ? message.mid.trim() : null;

              // ---- mídia
              const att = Array.isArray(message.attachments) ? message.attachments[0] : null;
              const attType = String(att?.type || "").toLowerCase();
              const attUrl = att?.payload?.url ? String(att.payload.url) : null;
              let media: any = null;
              if (attUrl) {
                const kind =
                  attType === "audio"
                    ? "audio"
                    : attType === "image" || attType === "story_mention" || attType === "share"
                    ? "image"
                    : attType === "video"
                    ? "document"
                    : attType === "file"
                    ? "document"
                    : null;
                if (kind) {
                  media = {
                    kind,
                    provider: "instagram",
                    url: attUrl,
                    mimetype: attType === "audio" ? "audio/mp4" : attType === "image" ? "image/jpeg" : "application/octet-stream",
                    fileName: null,
                    caption: typeof message.text === "string" ? message.text : null,
                  };
                }
              }

              const text: string = typeof message.text === "string" ? message.text : "";
              if (!text.trim() && !media) continue;

              const label = media?.kind === "audio" ? "[Áudio]" : media?.kind === "image" ? "[Imagem]" : media ? "[Arquivo]" : "";
              const storedText = text.trim() || `${label} (processando...)`;

              // Nome do contato (best-effort, uma vez por conversa).
              let contatoNome: string | null = null;
              const { data: knownCard } = await (supabaseAdmin as any)
                .from("crm_cards")
                .select("nome")
                .eq("company_id", companyId)
                .eq("numero", contactId)
                .maybeSingle();
              contatoNome = (knownCard as any)?.nome ?? null;
              if (!contatoNome && (ig as any).page_access_token) {
                try {
                  const { igFetchContact } = await import("@/lib/instagram.server");
                  contatoNome = (await igFetchContact((ig as any).page_access_token, senderId)).nome;
                } catch {}
              }

              const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
                .from("mensagens")
                .insert({
                  company_id: companyId,
                  user_id: userId,
                  numero: contactId,
                  channel: "instagram",
                  contato_nome: contatoNome,
                  direcao: "entrada",
                  autor: "contato",
                  texto: storedText,
                  whatsapp_message_id: mid,
                  media_ref: media,
                })
                .select("id")
                .maybeSingle();
              if (insertErr) {
                if ((insertErr as any).code === "23505") continue; // reentrega da Meta
                console.error("[instagram-webhook.insert]", (insertErr as any).message);
                continue;
              }

              const lower = storedText.toLowerCase().trim();

              const { data: cmdCfg } = await (supabaseAdmin as any)
                .from("agent_config")
                .select("palavra_pausar, palavra_despausar, segundos_buffer")
                .eq("company_id", companyId)
                .order("is_default", { ascending: false })
                .limit(1)
                .maybeSingle();
              const palavraPausar = ((cmdCfg as any)?.palavra_pausar || "/pausar").toLowerCase().trim();
              const palavraDespausar = ((cmdCfg as any)?.palavra_despausar || "/despausar").toLowerCase().trim();

              // Cliente respondeu → cancela follow-up pendente (Bloco 3).
              try {
                const { cancelFollowups } = await import("@/lib/followup.server");
                await cancelFollowups(supabaseAdmin, companyId, contactId, "cliente respondeu");
              } catch (e: any) {
                console.error("[followup.reset]", e?.message);
              }

              try {
                const { emitWebhook } = await import("@/lib/webhooks.server");
                void emitWebhook(companyId, "message.received", {
                  numero: contactId,
                  channel: "instagram",
                  contato_nome: contatoNome,
                  texto: storedText,
                  message_id: inserted?.id,
                });
              } catch {}

              if (lower === palavraPausar) {
                await (supabaseAdmin as any).from("contact_pause").upsert(
                  { company_id: companyId, user_id: userId, numero: contactId, pausado: true },
                  { onConflict: "company_id,numero" },
                );
                await (supabaseAdmin as any)
                  .from("mensagens")
                  .update({ ai_processed_at: new Date().toISOString() })
                  .eq("id", inserted?.id);
                continue;
              }
              if (lower === palavraDespausar) {
                await (supabaseAdmin as any).from("contact_pause").upsert(
                  { company_id: companyId, user_id: userId, numero: contactId, pausado: false },
                  { onConflict: "company_id,numero" },
                );
                await (supabaseAdmin as any)
                  .from("mensagens")
                  .update({ ai_processed_at: new Date().toISOString() })
                  .eq("id", inserted?.id);
                continue;
              }

              // ---- Fila (Bloco 4): 1 job por conversa, debounce por empresa.
              const bufferSec = Math.max(0, Math.min(20, Number((cmdCfg as any)?.segundos_buffer ?? 8)));
              const availableAt = new Date(Date.now() + bufferSec * 1000).toISOString();
              const { data: job } = await (supabaseAdmin as any)
                .from("message_processing_queue")
                .select("id, status")
                .eq("company_id", companyId)
                .eq("numero", contactId)
                .in("status", ["pending", "processing"])
                .maybeSingle();

              if (job?.status === "pending") {
                await (supabaseAdmin as any)
                  .from("message_processing_queue")
                  .update({ available_at: availableAt })
                  .eq("id", job.id);
              } else if (!job) {
                const { error: qErr } = await (supabaseAdmin as any).from("message_processing_queue").insert({
                  company_id: companyId,
                  numero: contactId,
                  instance_name: null,
                  status: "pending",
                  available_at: availableAt,
                });
                if (qErr && (qErr as any).code !== "23505") console.error("[queue.enqueue]", (qErr as any).message);
              }
              queued++;
            }
          }

          console.info("[instagram-webhook] recebido em", Date.now() - t0, "ms", queued, "job(s)");
          return new Response("queued", { status: 200 });
        } catch (e: any) {
          console.error("[instagram-webhook]", e?.message, e?.stack);
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
