import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

// BLOCO 5 — Conexão do Instagram do CLIENTE pelo painel.
// O cliente cola o token de acesso gerado no Meta (Página ou Instagram Login);
// o servidor resolve a conta, salva e devolve a URL/Token de verificação do webhook.

function stableHost(host: string) {
  const m = host.match(/^id-preview--([0-9a-fA-F-]{36})\./);
  if (m) return `project--${m[1]}-dev.lovable.app`;
  return host;
}

function webhookUrl() {
  try {
    const req = getRequest();
    const url = new URL(req.url);
    return `${url.protocol}//${stableHost(url.host)}/api/public/instagram-webhook`;
  } catch {
    return "";
  }
}

async function resolveCompanyId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_user")
    .select("company_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Você ainda não possui uma empresa. Finalize o onboarding.");
  return data.company_id as string;
}

export const getInstagramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data } = await (supabase as any)
      .from("instagram_integration")
      .select("ig_user_id, page_id, page_name, username, conectado, verify_token, ultimo_erro, updated_at")
      .eq("company_id", companyId)
      .maybeSingle();
    return {
      conectado: !!(data as any)?.conectado,
      username: (data as any)?.username ?? null,
      pageName: (data as any)?.page_name ?? null,
      igUserId: (data as any)?.ig_user_id ?? null,
      verifyToken: (data as any)?.verify_token ?? null,
      ultimoErro: (data as any)?.ultimo_erro ?? null,
      webhookUrl: webhookUrl(),
    };
  });

export const connectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => {
    const token = String(d?.token ?? "").trim();
    if (token.length < 40) throw new Error("Cole um token de acesso válido do Meta.");
    return { token };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { igResolveAccount, igSubscribePage } = await import("./instagram.server");

    const account = await igResolveAccount(data.token);
    if (account.pageId) await igSubscribePage(account.pageToken, account.pageId);

    const { error } = await (supabase as any).from("instagram_integration").upsert(
      {
        company_id: companyId,
        user_id: userId,
        ig_user_id: account.igUserId,
        page_id: account.pageId,
        page_name: account.pageName,
        username: account.username,
        page_access_token: account.pageToken,
        conectado: true,
        ultimo_erro: null,
      },
      { onConflict: "company_id" },
    );
    if (error) throw new Error(error.message);

    const { data: row } = await (supabase as any)
      .from("instagram_integration")
      .select("verify_token")
      .eq("company_id", companyId)
      .maybeSingle();

    return {
      ok: true,
      username: account.username,
      pageName: account.pageName,
      igUserId: account.igUserId,
      verifyToken: (row as any)?.verify_token ?? null,
      webhookUrl: webhookUrl(),
    };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { error } = await (supabase as any)
      .from("instagram_integration")
      .update({ conectado: false, page_access_token: null })
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendChannelMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { numero: string; texto: string; contatoNome?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { channelOf, replyWindowHours } = await import("./channels");
    const channel = channelOf(data.numero);

    const { data: recentInbound } = await supabase
      .from("mensagens")
      .select("id")
      .eq("company_id", companyId)
      .eq("numero", data.numero)
      .eq("direcao", "entrada")
      .gte("created_at", new Date(Date.now() - replyWindowHours(channel) * 60 * 60_000).toISOString())
      .limit(1);
    if (!recentInbound?.length) {
      throw new Error(
        channel === "instagram"
          ? "O Instagram só permite responder contatos que interagiram nos últimos 7 dias."
          : "Por segurança, só é possível responder contatos que mandaram mensagem nas últimas 24h.",
      );
    }

    // Proteção de qualidade do número (comportamento original do WhatsApp preservado).
    if (channel === "whatsapp") {
      const { data: recentOutbound } = await supabase
        .from("mensagens")
        .select("id")
        .eq("company_id", companyId)
        .eq("numero", data.numero)
        .eq("direcao", "saida")
        .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
        .limit(6);
      if ((recentOutbound?.length ?? 0) >= 6) {
        throw new Error("Envio pausado por alguns minutos para proteger a qualidade do número.");
      }
    }

    const { assertWithinLimit } = await import("./plan-limits.server");
    await assertWithinLimit(companyId, "mensagens");


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveChannelTarget, sendChannelText } = await import("./channels.server");
    const target = await resolveChannelTarget(supabaseAdmin, companyId, data.numero);
    if (!target.ready) throw new Error(target.reason === "instagram desconectado" ? "Instagram não conectado" : "WhatsApp não conectado");
    try {
      await sendChannelText(target, data.texto);
    } catch (e: any) {
      throw new Error(`Falha ao enviar: ${e?.message ?? e}`);
    }

    const { error } = await supabase.from("mensagens").insert({
      company_id: companyId,
      user_id: userId,
      numero: data.numero,
      channel,
      contato_nome: data.contatoNome ?? null,
      direcao: "saida",
      autor: "humano",
      texto: data.texto,
    } as any);
    if (error) throw new Error(error.message);

    await supabase.from("contact_pause").upsert(
      { company_id: companyId, user_id: userId, numero: data.numero, pausado: true },
      { onConflict: "company_id,numero" },
    );
    return { ok: true };
  });
