import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MessageTemplate = {
  id: string;
  atalho: string;
  texto: string;
  updated_at: string;
};

async function currentCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("company_user")
    .select("company_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa ativa");
  return data.company_id as string;
}

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("message_template")
      .select("id, atalho, texto, updated_at")
      .eq("company_id", cid)
      .order("atalho", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as MessageTemplate[];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; atalho: string; texto: string }) => {
    const atalho = (d?.atalho || "").trim().replace(/^\/+/, "").slice(0, 40);
    const texto = (d?.texto || "").trim().slice(0, 2000);
    if (!/^[a-z0-9_-]{2,40}$/i.test(atalho)) {
      throw new Error("Atalho: 2-40 caracteres, só letras, números, _ ou -");
    }
    if (texto.length < 1) throw new Error("Texto obrigatório");
    return { id: d?.id, atalho: atalho.toLowerCase(), texto };
  })
  .handler(async ({ data, context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("message_template")
        .update({ atalho: data.atalho, texto: data.texto })
        .eq("id", data.id)
        .eq("company_id", cid);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("message_template")
      .insert({ company_id: cid, user_id: context.userId, atalho: data.atalho, texto: data.texto });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("message_template")
      .delete()
      .eq("id", data.id)
      .eq("company_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveBusinessHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { horarios: any; mensagem: string }) => {
    const m = (d?.mensagem || "").trim().slice(0, 600);
    if (!m) throw new Error("Mensagem fora do horário obrigatória");
    const h = d?.horarios;
    if (!h || typeof h !== "object") throw new Error("Horários inválidos");
    return { horarios: h, mensagem: m };
  })
  .handler(async ({ data, context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("agent_config")
      .update({ horarios_atendimento: data.horarios, mensagem_fora_horario: data.mensagem })
      .eq("company_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBusinessHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await currentCompanyId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("agent_config")
      .select("horarios_atendimento, mensagem_fora_horario")
      .eq("company_id", cid)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      horarios: data?.horarios_atendimento ?? null,
      mensagem: data?.mensagem_fora_horario ?? "",
    };
  });
