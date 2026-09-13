import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker de follow-up chamado por pg_cron.
 * Claim atômico via followup_claim_due (SKIP LOCKED) → sem envio duplicado.
 */
export const Route = createFileRoute("/api/public/hooks/process-followups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateWorkerRequest } = await import("@/lib/worker-auth.server");
        const denied = await authenticateWorkerRequest(request);
        if (denied) return denied;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { processDueFollowups } = await import("@/lib/followup.server");
          const out = await processDueFollowups(supabaseAdmin, 25);
          // Lembretes de agendamento no MESMO worker (nenhum cron novo).
          let lembretes: any = { sent: 0, skipped: 0 };
          try {
            const { processAppointmentReminders } = await import("@/lib/scheduling.server");
            lembretes = await processAppointmentReminders(supabaseAdmin, 50);
          } catch (e: any) {
            console.error("[agenda.lembretes]", e?.message);
            lembretes = { sent: 0, skipped: 0, error: String(e?.message ?? e) };
          }
          // Campanhas no MESMO worker (nenhum cron novo).
          let campanhas: any = { processed: [] };
          try {
            const { processDueCampaigns } = await import("@/lib/campaigns.server");
            campanhas = await processDueCampaigns(supabaseAdmin, 10);
          } catch (e: any) {
            console.error("[campanhas.worker]", e?.message);
            campanhas = { processed: [], error: String(e?.message ?? e) };
          }
          return Response.json({ ok: true, ...out, lembretes, campanhas });

        } catch (e: any) {
          console.error("[process-followups]", e?.message);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
        }

      },
    },
  },
});
