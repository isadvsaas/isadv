// Autenticação FORTE para endpoints internos de cron/worker.
// Nunca aceita SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY.
// Aceita apenas:
//   1) Authorization: Bearer <public.worker_auth.secret>  (segredo interno, só service_role lê)
//   2) Authorization: Bearer <LOVABLE_CRON_SECRET>        (segredo de ambiente já existente)

let cached: { secret: string; at: number } | null = null;
const TTL_MS = 60_000;

async function loadDbSecret(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.secret;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("worker_auth")
      .select("secret")
      .eq("id", true)
      .maybeSingle();
    const secret = data?.secret ? String(data.secret) : null;
    if (secret) cached = { secret, at: Date.now() };
    return secret;
  } catch (e: any) {
    console.error("[worker-auth] falha ao carregar segredo", e?.message);
    return null;
  }
}

/**
 * Retorna uma Response 401 quando a chamada não está autorizada, ou null quando está.
 */
export async function authenticateWorkerRequest(request: Request): Promise<Response | null> {
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1]?.trim();
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  const provided = digest(token);

  const candidates = [await loadDbSecret(), process.env["LOVABLE_CRON_SECRET"] ?? null].filter(
    (s): s is string => !!s && s.length >= 16,
  );
  for (const candidate of candidates) {
    if (timingSafeEqual(provided, digest(candidate))) return null;
  }
  return new Response("Unauthorized", { status: 401 });
}
