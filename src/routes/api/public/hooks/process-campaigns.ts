import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker de campanhas. Exige segredo interno de servidor (Bearer).
 * Também é chamado dentro do worker de follow-up (nenhum cron novo).
 */
export const Route = createFileRoute("/api/public/hooks/process-campaigns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateWorkerRequest } = await import("@/lib/worker-auth.server");
        const denied = await authenticateWorkerRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { processDueCampaigns } = await import("@/lib/campaigns.server");
          const out = await processDueCampaigns(supabaseAdmin, 10);
          return Response.json({ ok: true, ...out });
        } catch (e: any) {
          console.error("[process-campaigns]", e?.message);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
        }
      },
    },
  },
});
