// Normaliza payloads de diferentes plataformas (Kiwify, Cakto, Perfectpay) num formato único.

export type BillingEventType =
  | "purchase_approved"
  | "subscription_renewed"
  | "subscription_canceled"
  | "payment_failed"
  | "chargeback"
  | "refunded"
  | "unknown";

export type NormalizedBillingEvent = {
  provider: "kiwify" | "cakto" | "perfectpay";
  eventType: BillingEventType;
  rawEventName: string;
  buyerEmail: string | null;
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;
  productRef: string | null;
  amountCents: number | null;
  periodEnd: string | null;
};

function lower(s: any): string | null {
  return typeof s === "string" && s.trim() ? s.trim().toLowerCase() : null;
}

function pick<T = any>(obj: any, ...paths: string[]): T | null {
  for (const p of paths) {
    const v = p.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return null;
}

// ---------- Kiwify ----------
// Docs: https://docs.kiwify.com.br/webhooks
// Eventos comuns: order_approved, order_refunded, chargeback, subscription_canceled, subscription_renewed
function mapKiwifyEvent(name: string): BillingEventType {
  const n = name.toLowerCase();
  if (n.includes("renewed") || n.includes("renovada")) return "subscription_renewed";
  if (n.includes("canceled") || n.includes("cancelada")) return "subscription_canceled";
  if (n.includes("refund")) return "refunded";
  if (n.includes("chargeback")) return "chargeback";
  if (n.includes("billet_overdue") || n.includes("payment_failed") || n.includes("rejected")) return "payment_failed";
  if (n.includes("approved") || n.includes("paid") || n.includes("aprovad")) return "purchase_approved";
  return "unknown";
}

export function normalizeKiwify(body: any): NormalizedBillingEvent {
  const eventName = pick<string>(body, "webhook_event_type", "event") ?? "";
  return {
    provider: "kiwify",
    eventType: mapKiwifyEvent(eventName),
    rawEventName: eventName,
    buyerEmail: lower(pick(body, "Customer.email", "customer.email", "buyer.email")),
    externalSubscriptionId:
      pick<string>(body, "Subscription.id", "subscription_id", "subscription.id", "order_id", "id") ?? null,
    externalCustomerId: pick<string>(body, "Customer.id", "customer.id", "Customer.CPF") ?? null,
    productRef:
      pick<string>(body, "Product.product_id", "product_id", "Product.id", "product.id") ?? null,
    amountCents:
      typeof body?.Commissions?.charge_amount === "number"
        ? body.Commissions.charge_amount
        : typeof body?.total_amount === "number"
        ? body.total_amount
        : null,
    periodEnd: pick<string>(body, "Subscription.next_payment", "subscription.next_payment") ?? null,
  };
}

// ---------- Cakto ----------
// Eventos comuns: PURCHASE_APPROVED, SUBSCRIPTION_RENEWED, SUBSCRIPTION_CANCELED, REFUND, CHARGEBACK
function mapCaktoEvent(name: string): BillingEventType {
  const n = name.toUpperCase();
  if (n.includes("RENEW")) return "subscription_renewed";
  if (n.includes("CANCEL")) return "subscription_canceled";
  if (n.includes("REFUND")) return "refunded";
  if (n.includes("CHARGEBACK")) return "chargeback";
  if (n.includes("FAIL") || n.includes("REJECT")) return "payment_failed";
  if (n.includes("APPROVED") || n.includes("PAID")) return "purchase_approved";
  return "unknown";
}

export function normalizeCakto(body: any): NormalizedBillingEvent {
  const eventName = pick<string>(body, "event", "event_type") ?? "";
  const data = body?.data ?? body;
  return {
    provider: "cakto",
    eventType: mapCaktoEvent(eventName),
    rawEventName: eventName,
    buyerEmail: lower(pick(data, "customer.email", "buyer.email", "customer_email")),
    externalSubscriptionId:
      pick<string>(data, "subscription.id", "subscription_id", "transaction_id", "id") ?? null,
    externalCustomerId: pick<string>(data, "customer.id", "customer_id") ?? null,
    productRef: pick<string>(data, "product.id", "product_id", "offer_id") ?? null,
    amountCents:
      typeof data?.amount_cents === "number"
        ? data.amount_cents
        : typeof data?.amount === "number"
        ? Math.round(data.amount * 100)
        : null,
    periodEnd: pick<string>(data, "subscription.next_charge_at", "next_charge_at") ?? null,
  };
}

// ---------- Perfectpay ----------
function mapPerfectpayEvent(status: string): BillingEventType {
  const n = (status || "").toLowerCase();
  if (n.includes("renew")) return "subscription_renewed";
  if (n.includes("cancel")) return "subscription_canceled";
  if (n.includes("refund") || n.includes("estorn")) return "refunded";
  if (n.includes("chargeback")) return "chargeback";
  if (n.includes("approved") || n.includes("paid") || n.includes("aprovad")) return "purchase_approved";
  if (n.includes("pending") || n.includes("aguardando")) return "unknown";
  return "unknown";
}

export function normalizePerfectpay(body: any): NormalizedBillingEvent {
  const status = pick<string>(body, "sale_status_enum_key", "status", "transaction_status") ?? "";
  return {
    provider: "perfectpay",
    eventType: mapPerfectpayEvent(status),
    rawEventName: status,
    buyerEmail: lower(pick(body, "customer.email", "client.email", "email")),
    externalSubscriptionId:
      pick<string>(body, "subscription.code", "code", "sale_id", "transaction_code") ?? null,
    externalCustomerId: pick<string>(body, "customer.id", "customer_id") ?? null,
    productRef: pick<string>(body, "product.code", "product_id", "code_product") ?? null,
    amountCents:
      typeof body?.sale_amount === "number" ? Math.round(body.sale_amount * 100) : null,
    periodEnd: pick<string>(body, "subscription.next_charge", "date_next_charge") ?? null,
  };
}

export function normalize(provider: string, body: any): NormalizedBillingEvent {
  switch (provider) {
    case "kiwify":
      return normalizeKiwify(body);
    case "cakto":
      return normalizeCakto(body);
    case "perfectpay":
      return normalizePerfectpay(body);
    default:
      throw new Error(`provedor desconhecido: ${provider}`);
  }
}
