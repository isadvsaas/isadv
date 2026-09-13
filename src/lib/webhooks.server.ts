// Server-only: dispara webhooks de saída assinados (HMAC-SHA256).
import { createHmac } from "node:crypto";

export type OutboundEvent =
  | "message.received"
  | "message.sent"
  | "lead.created"
  | "lead.won"
  | "lead.lost"
  | "csat.responded";

export async function emitWebhook(companyId: string, event: OutboundEvent, payload: any) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: endpoints } = await (supabaseAdmin as any)
      .from("webhook_endpoint")
      .select("id, url, secret, eventos, ativo")
      .eq("company_id", companyId)
      .eq("ativo", true);

    const list = (endpoints ?? []).filter((e: any) => !e.eventos?.length || e.eventos.includes(event));
    if (!list.length) return;

    const body = JSON.stringify({ event, company_id: companyId, data: payload, timestamp: new Date().toISOString() });
    await Promise.all(list.map(async (ep: any) => {
      const sig = createHmac("sha256", ep.secret).update(body).digest("hex");
      let status: number | null = null; let erro: string | null = null;
      try {
        const r = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AtendeZap-Event": event,
            "X-AtendeZap-Signature": `sha256=${sig}`,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        status = r.status;
        if (!r.ok) erro = `HTTP ${r.status}`;
      } catch (e: any) {
        erro = String(e?.message ?? e).slice(0, 500);
      }
      await (supabaseAdmin as any).from("webhook_delivery_log").insert({
        company_id: companyId, endpoint_id: ep.id, evento: event, status_code: status, erro,
      });
    }));
  } catch (e) {
    console.warn("[emitWebhook]", e);
  }
}
