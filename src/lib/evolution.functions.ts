import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

function deriveInstanceName(companyId: string) {
  return `atendezap_${companyId.replace(/-/g, "").slice(0, 16)}`;
}

function stableHost(host: string) {
  // O host de preview (id-preview--<id>.lovable.app) fica atrás do gate de sessão
  // e responde 302 para chamadas externas — a Evolution nunca entrega o webhook.
  // Usamos sempre o host estável do projeto.
  const m = host.match(/^id-preview--([0-9a-fA-F-]{36})\./);
  if (m) return `project--${m[1]}-dev.lovable.app`;
  return host;
}

function buildWebhookUrl(token?: string | null) {
  try {
    const req = getRequest();
    const url = new URL(req.url);
    const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : "";
    return `${url.protocol}//${stableHost(url.host)}/api/public/whatsapp-webhook${tokenQuery}`;
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

export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const {
      evoCreateInstance,
      evoGetQr,
      evoSetWebhook,
      evoState,
    } = await import("./evolution.server");

    const { data: existing } = await (supabase as any)
      .from("whatsapp_instances")
      .select("instance_name,status,numero,webhook_token")
      .eq("company_id", companyId)
      .maybeSingle();
    const instanceName = existing?.instance_name || deriveInstanceName(companyId);
    const webhookToken = existing?.webhook_token || crypto.randomUUID();
    const webhookUrl = buildWebhookUrl(webhookToken);
    if (existing?.instance_name) {
      try {
        const s = await evoState(existing.instance_name);
        const existingState = s?.instance?.state || (s as any)?.state;
        if (existingState === "open") {
          if (webhookUrl) {
            try { await evoSetWebhook(existing.instance_name, webhookUrl); } catch (e) { console.warn("[evolution.setWebhook]", e); }
          }
          if (existing.status !== "connected") {
            await supabase
              .from("whatsapp_instances")
              .update({ status: "connected", webhook_token: webhookToken, webhook_configured_at: new Date().toISOString() } as any)
              .eq("company_id", companyId);
          }
          return { instanceName: existing.instance_name, qrBase64: null, code: null, state: "open", webhookUrl };
        }
      } catch {}
    }

    await supabase
      .from("whatsapp_instances")
      .upsert(
        { company_id: companyId, user_id: userId, instance_name: instanceName, status: "connecting", webhook_token: webhookToken } as any,
        { onConflict: "company_id" },
      );

    try {
      await evoCreateInstance(instanceName, webhookUrl);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (!/exists|already/i.test(msg)) console.warn("[evolution.create]", msg);
      if (!/exists|already/i.test(msg)) throw e;
    }

    if (webhookUrl) {
      try { await evoSetWebhook(instanceName, webhookUrl); } catch (e) { console.warn("[evolution.setWebhook]", e); }
    }

    let qrBase64: string | null = null;
    let code: string | null = null;
    let lastQrError: unknown = null;
    for (let i = 0; i < 6; i++) {
      try {
        const qr = await evoGetQr(instanceName);
        qrBase64 = qr.qrBase64;
        code = qr.code;
        if (qrBase64 || code) break;
      } catch (e) { lastQrError = e; console.warn("[evolution.connect]", e); }
      await new Promise((r) => setTimeout(r, 800));
    }

    if (!qrBase64 && !code && lastQrError) {
      throw lastQrError;
    }

    let state: string | undefined;
    try {
      const s = await evoState(instanceName);
      state = s?.instance?.state || (s as any)?.state;
    } catch {}

    return { instanceName, qrBase64, code, state, webhookUrl };
  });

export const checkWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { evoState, evoFetchNumberFromInstance, evoSetWebhook } = await import("./evolution.server");

    const { data: row } = await (supabase as any)
      .from("whatsapp_instances")
      .select("instance_name,status,numero,webhook_token,webhook_configured_at")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!row) return { status: "disconnected", state: null, numero: null, qrBase64: null, code: null };

    let state: string | null = null;
    let stateError = false;
    try {
      const s = await evoState(row.instance_name);
      state = s?.instance?.state || (s as any)?.state || null;
    } catch (e) {
      stateError = true;
      console.warn("[evolution.state]", e);
    }

    // IMPORTANTE: NUNCA chamar evoGetQr aqui. Chamar /instance/connect em sessão
    // ativa DERRUBA a sessão do WhatsApp pra gerar um QR novo. QR só é buscado
    // explicitamente em connectWhatsapp (botão "Conectar"). Em erro transitório,
    // preservar o último status conhecido pra não causar "flicker" de desconexão.
    if (stateError) {
      return {
        status: row.status || "disconnected",
        state: null,
        numero: row.numero ?? null,
        qrBase64: null,
        code: null,
      };
    }

    const newStatus =
      state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";

    let numero: string | null = row.numero ?? null;
    if (newStatus === "connected" && !numero) {
      try { numero = await evoFetchNumberFromInstance(row.instance_name); } catch {}
    }
    if (newStatus === "connected" && row.webhook_token && !row.webhook_configured_at) {
      const webhookUrl = buildWebhookUrl(row.webhook_token);
      if (webhookUrl) {
        try {
          await evoSetWebhook(row.instance_name, webhookUrl);
          await supabase.from("whatsapp_instances").update({ webhook_configured_at: new Date().toISOString() } as any).eq("company_id", companyId);
        } catch (e) { console.warn("[evolution.setWebhook]", e); }
      }
    }

    if (newStatus !== row.status || (numero && numero !== row.numero)) {
      await supabase
        .from("whatsapp_instances")
        .update({ status: newStatus, ...(numero ? { numero } : {}) })
        .eq("company_id", companyId);
    }

    return { status: newStatus, state, numero, qrBase64: null, code: null };
  });

export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { evoLogout } = await import("./evolution.server");
    const { data: row } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("company_id", companyId)
      .maybeSingle();
    if (row) {
      try { await evoLogout(row.instance_name); } catch (e) { console.warn("[evolution.logout]", e); }
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected" })
        .eq("company_id", companyId);
    }
    return { ok: true };
  });

export const sendWhatsappText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { numero: string; texto: string; contatoNome?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: inst } = await supabase
      .from("whatsapp_instances").select("instance_name,status").eq("company_id", companyId).maybeSingle();
    if (!inst?.instance_name) throw new Error("WhatsApp não conectado");
    const { data: recentInbound } = await supabase
      .from("mensagens")
      .select("id")
      .eq("company_id", companyId)
      .eq("numero", data.numero)
      .eq("direcao", "entrada")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
      .limit(1);
    if (!recentInbound?.length) {
      throw new Error("Por segurança, só é possível responder contatos que mandaram mensagem nas últimas 24h. Para iniciar conversa, use a API oficial com template aprovado.");
    }
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
    const { assertWithinLimit } = await import("./plan-limits.server");
    await assertWithinLimit(companyId, "mensagens");
    const { evoSendText } = await import("./evolution.server");
    try { await evoSendText(inst.instance_name, data.numero, data.texto); }
    catch (e: any) { throw new Error(`Falha ao enviar: ${e?.message ?? e}`); }
    const { error } = await supabase.from("mensagens").insert({
      company_id: companyId, user_id: userId, numero: data.numero,
      contato_nome: data.contatoNome ?? null,
      direcao: "saida", autor: "humano", texto: data.texto,
    });
    if (error) throw new Error(error.message);
    // Pause IA on this contact (humano assumed)
    await supabase.from("contact_pause").upsert(
      { company_id: companyId, user_id: userId, numero: data.numero, pausado: true },
      { onConflict: "company_id,numero" },
    );
    return { ok: true };
  });

export const setContactIaActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { numero: string; ativa: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { error } = await supabase.from("contact_pause").upsert(
      { company_id: companyId, user_id: userId, numero: data.numero, pausado: !data.ativa },
      { onConflict: "company_id,numero" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { lovableAiChat } = await import("./lovable-ai.server");
    const { buildSystemPrompt, parseAiOutput } = await import("./ai-prompt");
    const [{ data: cfg }, { data: stagesRows }, { data: prodRows }] = await Promise.all([
      (await import("./agents")).fetchDefaultAgent(supabase, companyId).then((d: any) => ({ data: d })),
      supabase.from("crm_stage").select("nome, tipo, ordem").eq("company_id", companyId).order("ordem", { ascending: true }),
      supabase.from("produto").select("nome, preco, descricao, ordem").eq("company_id", companyId).eq("ativo", true).order("ordem", { ascending: true }),
    ]);
    const stages = (stagesRows ?? []).map((s: any) => ({ nome: s.nome, tipo: s.tipo }));
    const produtos = (prodRows ?? []).map((p: any) => ({ nome: p.nome, preco: p.preco, descricao: p.descricao }));
    const system = buildSystemPrompt(cfg ?? {}, {
      responderEmPartes: cfg?.responder_em_partes ?? true,
      stages,
      produtos,
      agendaTools: !!cfg?.agendamento_ativo,
    });

    // Enforcement: provider precisa estar liberado no plano (Starter = Gemini)
    const { getCompanyPlan } = await import("./plan-limits.server");
    const { allowsProvider, PLAN_LABEL } = await import("./plan-features");
    const plan = await getCompanyPlan(companyId);
    let provider = ((cfg as any)?.ai_provider || "gemini") as string;
    let model = ((cfg as any)?.ai_model || "google/gemini-2.5-flash") as string;
    if (!allowsProvider(plan.slug, provider)) {
      throw new Error(
        `O provedor ${provider.toUpperCase()} não está incluso no plano ${PLAN_LABEL[plan.slug]}. Faça upgrade para Pro para usar GPT/Claude.`,
      );
    }

    const raw = await lovableAiChat(
      [
        { role: "system", content: system },
        { role: "user", content: data.message },
      ],
      {
        provider,
        model,
        ...(provider === "gemini"
          ? {}
          : await (await import("./agents")).fetchAgentProviderKeys(companyId, (cfg as any)?.id ?? null)),
      },
    );
    const { parts, stage } = parseAiOutput(raw, stages);
    return { reply: parts.join("\n\n"), parts, stage, system };
  });

