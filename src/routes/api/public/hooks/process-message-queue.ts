import { createFileRoute } from "@tanstack/react-router";

/**
 * BLOCO 4 — Worker da fila de mensagens (chamado por pg_cron a cada minuto).
 * Claim atômico via mq_claim_due (FOR UPDATE SKIP LOCKED) → nunca 2 workers na mesma conversa.
 * Faz um drain curto para reduzir latência entre execuções do cron.
 */

const BACKOFF_MIN = [1, 5, 15]; // minutos
const DRAIN_MS = 45_000;
const BATCH = 10;

export const Route = createFileRoute("/api/public/hooks/process-message-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateWorkerRequest } = await import("@/lib/worker-auth.server");
        const denied = await authenticateWorkerRequest(request);
        if (denied) return denied;


        const started = Date.now();
        let claimed = 0;
        let completed = 0;
        let skipped = 0;
        let retried = 0;
        let failed = 0;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { processConversationJob } = await import("@/lib/message-pipeline.server");
          const worker = `w-${Math.random().toString(36).slice(2, 8)}`;

          while (Date.now() - started < DRAIN_MS) {
            const { data: jobs, error } = await (supabaseAdmin as any).rpc("mq_claim_due", {
              _limit: BATCH,
              _worker: worker,
            });
            if (error) throw error;
            const list = (jobs ?? []) as any[];
            if (!list.length) {
              if (Date.now() - started > DRAIN_MS - 6_000) break;
              await new Promise((r) => setTimeout(r, 4_000));
              continue;
            }

            claimed += list.length;
            // Conversas diferentes em paralelo; a mesma conversa nunca aparece 2x (1 job ativo por conversa).
            await Promise.all(
              list.map(async (job: any) => {
                const jobStart = Date.now();
                try {
                  const out = await processConversationJob(supabaseAdmin, {
                    id: job.id,
                    company_id: job.company_id,
                    numero: job.numero,
                    instance_name: job.instance_name,
                    credit_consumed: !!job.credit_consumed,
                    routed_agent_id: job.routed_agent_id ?? null,
                    run_seq: job.run_seq ?? 0,
                  });
                  await (supabaseAdmin as any)
                    .from("message_processing_queue")
                    .update({
                      status: "completed",
                      completed_at: new Date().toISOString(),
                      last_error: null,
                    })
                    .eq("id", job.id);
                  if (out.status === "completed") completed++;
                  else skipped++;
                  console.info("[mq]", job.company_id, job.numero, out.status, out.reason ?? "", `${Date.now() - jobStart}ms`);
                } catch (e: any) {
                  const attempts = (job.attempts ?? 0) + 1;
                  const max = job.max_attempts ?? 3;
                  const msg = String(e?.message ?? e).slice(0, 500);
                  if (attempts >= max) {
                    failed++;
                    await (supabaseAdmin as any)
                      .from("message_processing_queue")
                      .update({ status: "failed", attempts, last_error: msg })
                      .eq("id", job.id);
                    console.error("[mq.failed]", job.company_id, job.numero, msg);
                  } else {
                    retried++;
                    const delayMin = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)]!;
                    await (supabaseAdmin as any)
                      .from("message_processing_queue")
                      .update({
                        status: "pending",
                        attempts,
                        last_error: msg,
                        available_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
                        locked_at: null,
                        locked_by: null,
                      })
                      .eq("id", job.id);
                    console.warn("[mq.retry]", job.company_id, job.numero, `tentativa ${attempts}/${max} em ${delayMin}min`, msg);
                  }
                  return;
                }

                // Mensagens que chegaram durante o processamento => novo job.
                try {
                  const { data: rest } = await (supabaseAdmin as any)
                    .from("mensagens")
                    .select("id")
                    .eq("company_id", job.company_id)
                    .eq("numero", job.numero)
                    .eq("direcao", "entrada")
                    .is("ai_processed_at", null)
                    .limit(1);
                  if (rest && rest.length) {
                    await (supabaseAdmin as any).from("message_processing_queue").insert({
                      company_id: job.company_id,
                      numero: job.numero,
                      instance_name: job.instance_name,
                      status: "pending",
                      available_at: new Date(Date.now() + 5_000).toISOString(),
                    });
                  }
                } catch {}
              }),
            );
          }

          return Response.json({ ok: true, claimed, completed, skipped, retried, failed, ms: Date.now() - started });
        } catch (e: any) {
          console.error("[process-message-queue]", e?.message);
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
        }
      },
    },
  },
});
