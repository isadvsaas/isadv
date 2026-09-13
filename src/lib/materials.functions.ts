// BLOCO MÍDIAS — Biblioteca de materiais da empresa + envio manual pelo Inbox.
// Todo acesso é validado no servidor e isolado por empresa.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaterialTipo = "image" | "audio" | "video" | "document" | "link";

export type Material = {
  id: string;
  company_id: string;
  agent_id: string | null;
  nome: string;
  descricao: string;
  tipo: MaterialTipo;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  ativo: boolean;
  created_at: string;
};

async function resolveCompanyId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_user")
    .select("company_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você ainda não possui uma empresa. Finalize o onboarding.");
  return data.company_id as string;
}

/** Confirma que o arquivo existe de verdade dentro da pasta desta empresa. */
async function assertStoredFile(admin: any, companyId: string, storagePath: string) {
  if (!storagePath.startsWith(`${companyId}/`)) throw new Error("Arquivo inválido para esta empresa.");
  const fileName = storagePath.slice(companyId.length + 1);
  const { data, error } = await admin.storage.from("materiais").list(companyId, { limit: 100, search: fileName });
  if (error) throw new Error(`Não foi possível validar o arquivo: ${error.message}`);
  const hit = (data ?? []).find((f: any) => f.name === fileName);
  if (!hit) throw new Error("Arquivo não encontrado no armazenamento. Envie o arquivo novamente.");
  const size = hit?.metadata?.size;
  if (typeof size === "number" && size > 25 * 1024 * 1024) throw new Error("Arquivo muito grande. O limite é 25 MB.");
  return { mime: hit?.metadata?.mimetype ?? null, size: size ?? null };
}

export const listMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data, error } = await (supabase as any)
      .from("agent_material")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Material[];
  });

export const saveMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string | null;
    nome: string;
    descricao?: string;
    tipo: MaterialTipo;
    agentId?: string | null;
    storagePath?: string | null;
    externalUrl?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    ativo?: boolean;
  }) => {
    const nome = String(d?.nome ?? "").trim();
    if (nome.length < 2) throw new Error("Dê um nome ao material.");
    const tipo = String(d?.tipo ?? "") as MaterialTipo;
    if (!["image", "audio", "video", "document", "link"].includes(tipo)) throw new Error("Escolha o tipo do material.");
    if (tipo === "link") {
      const url = String(d?.externalUrl ?? "").trim();
      if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Informe um link válido começando com https://");
    }
    return { ...d, nome, tipo };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sanitizeFileName, assertValidMedia, kindFromMime } = await import("./outbound-message.server");

    let storagePath = data.storagePath ?? null;
    let mimeType = data.mimeType ?? null;
    const fileName = data.fileName ? sanitizeFileName(data.fileName) : null;

    if (data.tipo !== "link") {
      if (!storagePath && data.id) {
        const { data: prev } = await (supabase as any)
          .from("agent_material")
          .select("storage_path, mime_type, file_name")
          .eq("id", data.id)
          .eq("company_id", companyId)
          .maybeSingle();
        storagePath = (prev as any)?.storage_path ?? null;
        mimeType = mimeType || ((prev as any)?.mime_type ?? null);
      }
      if (!storagePath) throw new Error("Envie o arquivo deste material.");
      const info = await assertStoredFile(supabaseAdmin, companyId, storagePath);
      mimeType = mimeType || info.mime;
      assertValidMedia(data.tipo, mimeType, info.size ?? undefined);
      // o tipo declarado tem que combinar com o arquivo real
      if (kindFromMime(mimeType, fileName) !== data.tipo) {
        throw new Error("O arquivo enviado não corresponde ao tipo escolhido.");
      }
    }

    // Um material só pode ser restrito a um agente DESTA empresa.
    let agentId: string | null = data.agentId ?? null;
    if (agentId) {
      const { data: ag } = await (supabase as any)
        .from("agent_config")
        .select("id")
        .eq("id", agentId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!ag) agentId = null;
    }

    const payload: any = {
      company_id: companyId,
      agent_id: agentId,
      nome: data.nome,
      descricao: String(data.descricao ?? "").trim(),
      tipo: data.tipo,
      storage_path: data.tipo === "link" ? null : storagePath,
      external_url: data.tipo === "link" ? String(data.externalUrl ?? "").trim() : null,
      mime_type: data.tipo === "link" ? null : mimeType,
      file_name: data.tipo === "link" ? null : fileName,
      ativo: data.ativo ?? true,
    };

    if (data.id) {
      const { error } = await (supabase as any)
        .from("agent_material")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await (supabase as any)
      .from("agent_material")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any)?.id ?? null };
  });

export const toggleMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { error } = await (supabase as any)
      .from("agent_material")
      .update({ ativo: !!data.ativo })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: mat } = await (supabase as any)
      .from("agent_material")
      .select("storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    const { error } = await (supabase as any).from("agent_material").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    const path = (mat as any)?.storage_path;
    if (path && String(path).startsWith(`${companyId}/`)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        await supabaseAdmin.storage.from("materiais").remove([path]);
      } catch (e: any) {
        console.warn("[material.remove]", e?.message);
      }
    }
    return { ok: true };
  });

// ---------------------------------------------------------------- envio humano

/** Regras de janela/qualidade iguais às do envio de texto humano. */
async function assertCanReply(supabase: any, companyId: string, numero: string) {
  const { assertWithinLimit } = await import("./plan-limits.server");
  await assertWithinLimit(companyId, "mensagens");
  const { channelOf, replyWindowHours } = await import("./channels");
  const channel = channelOf(numero);
  const { data: recentInbound } = await supabase
    .from("mensagens")
    .select("id")
    .eq("company_id", companyId)
    .eq("numero", numero)
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
  return channel;
}

/** Human takeover: mídia enviada por pessoa vale como atendimento humano. */
async function markHumanTakeover(supabase: any, companyId: string, userId: string, numero: string) {
  await supabase.from("contact_pause").upsert(
    { company_id: companyId, user_id: userId, numero, pausado: true },
    { onConflict: "company_id,numero" },
  );
}

export const sendMaterialToContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { numero: string; materialId: string; caption?: string | null; contatoNome?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    await assertCanReply(supabase, companyId, data.numero);

    const { data: mat } = await (supabase as any)
      .from("agent_material")
      .select("id, nome, tipo, storage_path, external_url, mime_type, file_name, ativo")
      .eq("id", data.materialId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!mat) throw new Error("Material não encontrado.");
    if (!(mat as any).ativo) throw new Error("Este material está desativado.");
    const m = mat as any;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOutbound } = await import("./outbound-message.server");
    const r = await sendOutbound(supabaseAdmin, {
      companyId,
      userId,
      contactId: data.numero,
      contatoNome: data.contatoNome ?? null,
      senderType: "human",
      kind: m.tipo,
      texto: m.tipo === "link" ? m.external_url : null,
      caption: data.caption ? String(data.caption).slice(0, 300) : null,
      media: m.tipo === "link" ? null : { storagePath: m.storage_path, mimeType: m.mime_type, fileName: m.file_name },
      idempotencyKey: `human-mat:${userId}:${data.materialId}:${Math.floor(Date.now() / 5000)}`,
      materialId: m.id,
    });
    await markHumanTakeover(supabase, companyId, userId, data.numero);
    return { ok: true, providerMessageId: r.providerMessageId };
  });

export const sendMediaToContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    numero: string;
    storagePath: string;
    tipo: Exclude<MaterialTipo, "link">;
    mimeType?: string | null;
    fileName?: string | null;
    caption?: string | null;
    contatoNome?: string | null;
    clientKey?: string | null;
  }) => {
    if (!String(d?.storagePath ?? "").trim()) throw new Error("Arquivo inválido.");
    if (!["image", "audio", "video", "document"].includes(String(d?.tipo))) throw new Error("Tipo de arquivo inválido.");
    return d;
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    await assertCanReply(supabase, companyId, data.numero);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendOutbound, assertValidMedia, sanitizeFileName } = await import("./outbound-message.server");
    const info = await assertStoredFile(supabaseAdmin, companyId, data.storagePath);
    const mime = data.mimeType || info.mime;
    assertValidMedia(data.tipo, mime, info.size ?? undefined);

    const r = await sendOutbound(supabaseAdmin, {
      companyId,
      userId,
      contactId: data.numero,
      contatoNome: data.contatoNome ?? null,
      senderType: "human",
      kind: data.tipo,
      caption: data.caption ? String(data.caption).slice(0, 300) : null,
      media: { storagePath: data.storagePath, mimeType: mime, fileName: data.fileName ? sanitizeFileName(data.fileName) : null },
      idempotencyKey: `human-media:${companyId}:${data.clientKey || data.storagePath}`,
    });
    await markHumanTakeover(supabase, companyId, userId, data.numero);
    return { ok: true, providerMessageId: r.providerMessageId };
  });
