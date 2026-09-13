import { createFileRoute } from "@tanstack/react-router";

/**
 * BLOCO 4 — WEBHOOK RÁPIDO (somente RECEBIMENTO).
 * Valida → normaliza → grava mensagem → cancela follow-up → enfileira job → 200.
 * Todo o processamento pesado (mídia, Supervisor, IA, tools, envio) roda no worker
 * /api/public/hooks/process-message-queue via src/lib/message-pipeline.server.ts.
 */
export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t0 = Date.now();
        try {
          const payload: any = await request.json().catch(() => ({}));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const event: string | undefined = payload?.event;
          const instanceName: string | undefined =
            payload?.instance || payload?.instanceName || payload?.data?.instance;

          if (!instanceName) return new Response("ok", { status: 200 });
          if (event && event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
            return new Response("ignored", { status: 200 });
          }

          const data = payload?.data ?? payload;
          const key = data?.key ?? {};
          const fromMe: boolean = !!key.fromMe;
          const whatsappMessageId: string | null = typeof key.id === "string" && key.id.trim() ? key.id.trim() : null;
          const remoteJid: string = key.remoteJid || "";
          if (!remoteJid) return new Response("no jid", { status: 200 });
          if (remoteJid.endsWith("@g.us")) return new Response("group", { status: 200 });
          if (fromMe) return new Response("fromMe", { status: 200 });

          const number = remoteJid.split("@")[0]!;
          const pushName: string | undefined = data?.pushName;
          const msg = data?.message ?? {};
          const { detectMedia } = await import("@/lib/media.server");
          const media = detectMedia(msg);
          const text: string =
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            (media ? "" : msg.imageMessage?.caption || "") ||
            msg.videoMessage?.caption ||
            "";
          if (!text.trim() && !media) return new Response("no text", { status: 200 });

          const suppliedToken =
            new URL(request.url).searchParams.get("t") || request.headers.get("x-webhook-token") || "";
          const { data: inst } = await (supabaseAdmin as any)
            .from("whatsapp_instances")
            .select("company_id, user_id, instance_name, webhook_token")
            .eq("instance_name", instanceName)
            .maybeSingle();
          if (!inst) return new Response("unknown instance", { status: 200 });
          if (!suppliedToken || suppliedToken !== (inst as any).webhook_token) {
            return new Response("invalid webhook", { status: 401 });
          }
          const companyId = (inst as any).company_id as string;
          const userId = (inst as any).user_id as string;

          // Idempotência de entrada (índice único company_id + whatsapp_message_id)
          const label =
            media?.kind === "audio"
              ? "[Áudio]"
              : media?.kind === "image"
              ? "[Imagem]"
              : media
              ? `[Documento: ${media.fileName || "arquivo"}]`
              : "";
          const storedText = text.trim() || `${label} (processando...)`;

          const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
            .from("mensagens")
            .insert({
              company_id: companyId,
              user_id: userId,
              numero: number,
              contato_nome: pushName ?? null,
              direcao: "entrada",
              autor: "contato",
              texto: storedText,
              whatsapp_message_id: whatsappMessageId,
              media_ref: media ? { ...media, key, message: msg } : null,
            })
            .select("id")
            .maybeSingle();
          if (insertErr) {
            // 23505 = unique violation => evento reenviado pela Evolution
            if ((insertErr as any).code === "23505") return new Response("duplicate", { status: 200 });
            throw insertErr;
          }

          const lower = storedText.toLowerCase().trim();

          // Comandos instantâneos (sem IA, sem fila)
          const { data: cmdCfg } = await (supabaseAdmin as any)
            .from("agent_config")
            .select("palavra_pausar, palavra_despausar, segundos_buffer")
            .eq("company_id", companyId)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle();
          const palavraPausar = ((cmdCfg as any)?.palavra_pausar || "/pausar").toLowerCase().trim();
          const palavraDespausar = ((cmdCfg as any)?.palavra_despausar || "/despausar").toLowerCase().trim();

          // Cliente respondeu: cancela follow-up pendente imediatamente (Bloco 3)
          try {
            const { cancelFollowups } = await import("@/lib/followup.server");
            await cancelFollowups(supabaseAdmin, companyId, number, "cliente respondeu");
          } catch (e: any) {
            console.error("[followup.reset]", e?.message);
          }

          try {
            const { emitWebhook } = await import("@/lib/webhooks.server");
            void emitWebhook(companyId, "message.received", {
              numero: number,
              contato_nome: pushName ?? null,
              texto: storedText,
              message_id: inserted?.id,
            });
          } catch {}

          try {
            const utmMatch = storedText.match(/\[utm:([^/\]]*)\/([^/\]]*)\/([^\]]*)\]/i);
            if (utmMatch) {
              const [, s, m, c] = utmMatch;
              await (supabaseAdmin as any)
                .from("crm_cards")
                .update({ utm_source: s || null, utm_medium: m || null, utm_campaign: c || null })
                .eq("company_id", companyId)
                .eq("numero", number)
                .is("utm_source", null);
            }
          } catch {}

          if (isOptOutMessage(lower) || lower === palavraPausar) {
            await (supabaseAdmin as any)
              .from("contact_pause")
              .upsert(
                { company_id: companyId, user_id: userId, numero: number, pausado: true },
                { onConflict: "company_id,numero" },
              );
            await (supabaseAdmin as any).from("mensagens").update({ ai_processed_at: new Date().toISOString() }).eq("id", inserted?.id);
            return new Response("paused", { status: 200 });
          }
          if (lower === palavraDespausar) {
            await (supabaseAdmin as any)
              .from("contact_pause")
              .upsert(
                { company_id: companyId, user_id: userId, numero: number, pausado: false },
                { onConflict: "company_id,numero" },
              );
            await (supabaseAdmin as any).from("mensagens").update({ ai_processed_at: new Date().toISOString() }).eq("id", inserted?.id);
            return new Response("resumed", { status: 200 });
          }

          // ---- Fila: 1 job por conversa. Nova mensagem só empurra a janela de debounce.
          const bufferSec = Math.max(0, Math.min(20, Number((cmdCfg as any)?.segundos_buffer ?? 8)));
          const availableAt = new Date(Date.now() + bufferSec * 1000).toISOString();
          const { data: job } = await (supabaseAdmin as any)
            .from("message_processing_queue")
            .select("id, status")
            .eq("company_id", companyId)
            .eq("numero", number)
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
              numero: number,
              instance_name: instanceName,
              status: "pending",
              available_at: availableAt,
            });
            // corrida entre dois webhooks simultâneos: índice único resolve, nada a fazer
            if (qErr && (qErr as any).code !== "23505") console.error("[queue.enqueue]", (qErr as any).message);
          }
          // job em "processing": a mensagem fica pendente e entra no próximo job/ciclo.

          console.info("[webhook] recebido em", Date.now() - t0, "ms", companyId, number);
          return new Response("queued", { status: 200 });
        } catch (e: any) {
          console.error("[webhook]", e?.message, e?.stack);
          return new Response("error", { status: 200 });
        }
      },
      GET: async () => new Response("AtendAI webhook online", { status: 200 }),
    },
  },
});

const OPT_OUT_WORDS = ["parar", "pare", "cancelar", "sair", "remover", "descadastrar", "stop", "unsubscribe"];

function isOptOutMessage(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return OPT_OUT_WORDS.some((word) => normalized === word || normalized.includes(` ${word} `));
}
