import { createFileRoute } from "@tanstack/react-router";
import { normalize, type NormalizedBillingEvent } from "@/lib/billing/normalize";

type Provider = "kiwify" | "cakto" | "perfectpay";

function tokenEnv(provider: Provider): string {
  return provider === "kiwify"
    ? "KIWIFY_WEBHOOK_TOKEN"
    : provider === "cakto"
    ? "CAKTO_WEBHOOK_TOKEN"
    : "PERFECTPAY_WEBHOOK_TOKEN";
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findCompanyByEmail(supabase: any, email: string): Promise<string | null> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();
  if (!prof?.user_id) return null;
  const { data: cu } = await supabase
    .from("company_user")
    .select("company_id")
    .eq("user_id", prof.user_id)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return cu?.company_id ?? null;
}

async function findPlanByRef(supabase: any, ref: string | null): Promise<string | null> {
  if (!ref) return null;
  const { data: bySlug } = await supabase.from("plan").select("id").eq("slug", ref).maybeSingle();
  if (bySlug?.id) return bySlug.id;
  const { data: byCheckout } = await supabase
    .from("plan")
    .select("id")
    .ilike("checkout_url", `%${ref}%`)
    .maybeSingle();
  return byCheckout?.id ?? null;
}

async function applyEvent(evt: NormalizedBillingEvent) {
  const supabase = await getAdmin();

  const logRow: any = {
    provider: evt.provider,
    event_type: evt.rawEventName || evt.eventType,
    external_id: evt.externalSubscriptionId,
    buyer_email: evt.buyerEmail,
    payload: evt as any,
  };

  if (!evt.buyerEmail) {
    await supabase.from("billing_event_log").insert({ ...logRow, error: "sem email do comprador" });
    return;
  }

  const companyId = await findCompanyByEmail(supabase, evt.buyerEmail);
  if (!companyId) {
    await supabase
      .from("billing_event_log")
      .insert({ ...logRow, error: "empresa não encontrada para o email" });
    return;
  }

  const planId = await findPlanByRef(supabase, evt.productRef);

  // Map status / billing
  let subStatus: string | null = null;
  let companyStatus: string | null = null;

  switch (evt.eventType) {
    case "purchase_approved":
    case "subscription_renewed":
      subStatus = "active";
      companyStatus = "ativo";
      break;
    case "subscription_canceled":
      subStatus = "canceled";
      companyStatus = "suspenso";
      break;
    case "refunded":
    case "chargeback":
      subStatus = "canceled";
      companyStatus = "suspenso";
      break;
    case "payment_failed":
      subStatus = "past_due";
      companyStatus = "pendente";
      break;
    default:
      await supabase.from("billing_event_log").insert({
        ...logRow,
        matched_company_id: companyId,
        processed: true,
        error: "evento ignorado",
      });
      return;
  }

  const subPayload: any = {
    company_id: companyId,
    provider: evt.provider,
    external_subscription_id: evt.externalSubscriptionId,
    external_customer_id: evt.externalCustomerId,
    buyer_email: evt.buyerEmail,
    status: subStatus,
    updated_at: new Date().toISOString(),
  };
  if (planId) subPayload.plan_id = planId;
  if (evt.periodEnd) subPayload.current_period_end = evt.periodEnd;
  if (subStatus === "canceled") subPayload.canceled_at = new Date().toISOString();

  // Upsert por company_id (1 assinatura por empresa).
  await supabase.from("subscription").upsert(subPayload, { onConflict: "company_id" });

  if (companyStatus) {
    await supabase
      .from("company")
      .update({ status_cobranca: companyStatus })
      .eq("id", companyId);
  }

  // Recarrega créditos do plano quando assinatura ativa/renova
  if (subStatus === "active" && planId) {
    const { data: planRow } = await supabase.from("plan").select("slug").eq("id", planId).maybeSingle();
    if (planRow?.slug) {
      await supabase.rpc("topup_plan_credits", { _company_id: companyId, _plan_slug: planRow.slug });
    }
  }

  await supabase.from("billing_event_log").insert({
    ...logRow,
    matched_company_id: companyId,
    processed: true,
  });
}

export const Route = createFileRoute("/api/public/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provider = (url.searchParams.get("provider") || "") as Provider;
        const token = url.searchParams.get("token") || request.headers.get("x-webhook-token") || "";

        if (!["kiwify", "cakto", "perfectpay"].includes(provider)) {
          return new Response("provider inválido", { status: 400 });
        }
        const expected = process.env[tokenEnv(provider)];
        if (!expected || token !== expected) {
          return new Response("token inválido", { status: 401 });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          // Alguns provedores enviam form-encoded
          try {
            const form = await request.formData();
            body = Object.fromEntries(form.entries());
          } catch {
            body = {};
          }
        }

        try {
          const evt = normalize(provider, body);
          await applyEvent(evt);
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[billing.webhook]", provider, e);
          try {
            const admin = await getAdmin();
            await admin.from("billing_event_log").insert({
              provider,
              event_type: "error",
              payload: body,
              error: String(e?.message || e),
            });
          } catch {}
          return Response.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
        }
      },
    },
  },
});
