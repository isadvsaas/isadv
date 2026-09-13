import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("company_user").select("company_id, role")
    .eq("user_id", userId).eq("ativo", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) throw new Error("Sem empresa.");
  return data.company_id as string;
}

async function requireOwnerOrAdmin(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("company_user").select("company_id, role")
    .eq("user_id", userId).eq("ativo", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) throw new Error("Sem empresa.");
  if (!["owner", "admin"].includes(String(data.role))) throw new Error("Apenas owner/admin.");
  return data.company_id as string;
}

// ---------- Audit log ----------
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await requireOwnerOrAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("audit_log").select("*")
      .eq("company_id", cid).order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

// ---------- LGPD export ----------
export const exportLgpd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await requireOwnerOrAdmin(context.supabase, context.userId);
    const s = context.supabase;
    const tables = [
      "company", "company_user", "profiles", "whatsapp_instances", "agent_config",
      "crm_stage", "crm_cards", "lead_nota", "lead_evento", "mensagens",
      "contact_pause", "agendamento", "produto", "message_template",
      "csat_response", "campaign", "campaign_target",
      "webhook_endpoint", "api_token", "audit_log",
    ];
    const out: Record<string, any[]> = {};
    for (const t of tables) {
      try {
        const tbl = (s as any).from(t);
        const q = t === "company"
          ? tbl.select("*").eq("id", cid)
          : t === "profiles"
          ? tbl.select("*").eq("user_id", context.userId)
          : tbl.select("*").eq("company_id", cid);
        const { data } = await q;
        out[t] = data ?? [];
      } catch { out[t] = []; }
    }
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      companyId: cid, userId: context.userId,
      actorEmail: (context.claims as any)?.email ?? null,
      acao: "lgpd.export", recurso: "company", detalhes: { tables: tables.length },
    });
    return {
      exported_at: new Date().toISOString(),
      company_id: cid,
      data: out,
    };
  });

// ---------- Bootstrap do super admin (apenas o PRIMEIRO usuário do sistema) ----------
// A decisão é tomada 100% no banco (função SECURITY DEFINER que compara auth.uid()
// com o usuário mais antigo de auth.users). O cliente não pode influenciar o resultado.
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ensure_super_admin_bootstrap");
    if (error) return { isSuperAdmin: false };
    return { isSuperAdmin: data === true };
  });
