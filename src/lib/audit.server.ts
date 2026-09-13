// Server-only helper to write audit log entries.
export async function writeAudit(params: {
  companyId: string;
  userId?: string | null;
  actorEmail?: string | null;
  acao: string;
  recurso?: string | null;
  detalhes?: any;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("audit_log").insert({
      company_id: params.companyId,
      user_id: params.userId ?? null,
      actor_email: params.actorEmail ?? null,
      acao: params.acao,
      recurso: params.recurso ?? null,
      detalhes: params.detalhes ?? {},
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch (e) {
    console.warn("[writeAudit]", e);
  }
}
