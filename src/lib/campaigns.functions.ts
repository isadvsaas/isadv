import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  if (!data) throw new Error("Sem empresa.");
  return data.company_id as string;
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data, error } = await supabase
      .from("campaign")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: c } = await supabase.from("campaign").select("*").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!c) throw new Error("Campanha não encontrada.");
    const { data: targets } = await supabase
      .from("campaign_target")
      .select("*")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return { campaign: c, targets: targets ?? [] };
  });

export const listAvailableTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data } = await supabase.from("crm_cards").select("tags").eq("company_id", companyId);
    const set = new Set<string>();
    for (const row of (data ?? []) as any[]) {
      for (const t of (row.tags ?? []) as string[]) if (t) set.add(t);
    }
    return Array.from(set).sort();
  });

export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tags: string[] }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    let q = supabase.from("crm_cards").select("numero, contato_nome, tags").eq("company_id", companyId);
    if (data.tags && data.tags.length) q = q.overlaps("tags", data.tags);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const map = new Map<string, { numero: string; nome: string | null }>();
    for (const r of (rows ?? []) as any[]) {
      const num = String(r.numero || "").replace(/\D/g, "");
      if (!num) continue;
      if (!map.has(num)) map.set(num, { numero: num, nome: r.contato_nome ?? null });
    }
    return { total: map.size, sample: Array.from(map.values()).slice(0, 10) };
  });

type CampaignInput = {
  id?: string;
  nome: string;
  mensagem: string;
  agendado_para?: string | null;
  filtro_tags?: string[];
  intervalo_min_seg?: number;
  intervalo_max_seg?: number;
  pausa_apos_envios?: number;
  pausa_duracao_min?: number;
};

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CampaignInput) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const payload = {
      company_id: companyId,
      created_by: userId,
      nome: data.nome,
      mensagem: data.mensagem,
      agendado_para: data.agendado_para || null,
      filtro_tags: data.filtro_tags ?? [],
      intervalo_min_seg: Math.max(2, data.intervalo_min_seg ?? 5),
      intervalo_max_seg: Math.max(data.intervalo_min_seg ?? 5, data.intervalo_max_seg ?? 20),
      pausa_apos_envios: Math.max(10, data.pausa_apos_envios ?? 50),
      pausa_duracao_min: Math.max(1, data.pausa_duracao_min ?? 10),
    };
    if (data.id) {
      const { data: row, error } = await supabase.from("campaign").update(payload).eq("id", data.id).eq("company_id", companyId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase.from("campaign").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { error } = await supabase.from("campaign").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: c } = await supabase.from("campaign").select("*").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!c) throw new Error("Campanha não encontrada.");
    if (c.status === "enviando" || c.status === "agendada") throw new Error("Campanha já está em execução.");

    // Populate targets from CRM cards filtered by tags
    let q = supabase.from("crm_cards").select("numero, contato_nome, tags").eq("company_id", companyId);
    if ((c.filtro_tags ?? []).length) q = q.overlaps("tags", c.filtro_tags as string[]);
    const { data: rows } = await q;
    const map = new Map<string, string | null>();
    for (const r of (rows ?? []) as any[]) {
      const num = String(r.numero || "").replace(/\D/g, "");
      if (!num) continue;
      if (!map.has(num)) map.set(num, r.contato_nome ?? null);
    }
    if (map.size === 0) throw new Error("Nenhum contato bate com os filtros.");

    // Reset existing targets
    await supabase.from("campaign_target").delete().eq("campaign_id", c.id);
    const inserts = Array.from(map.entries()).map(([numero, nome]) => ({
      campaign_id: c.id,
      company_id: companyId,
      contato_numero: numero,
      contato_nome: nome,
      status: "pendente" as const,
    }));
    // chunk insert
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await supabase.from("campaign_target").insert(inserts.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }

    const proximo = c.agendado_para && new Date(c.agendado_para) > new Date() ? c.agendado_para : new Date().toISOString();
    const status = c.agendado_para && new Date(c.agendado_para) > new Date() ? "agendada" : "enviando";
    const { error } = await supabase.from("campaign").update({
      status,
      total_destinatarios: inserts.length,
      total_enviados: 0,
      total_falhas: 0,
      iniciado_em: new Date().toISOString(),
      proximo_envio_em: proximo,
      concluido_em: null,
    }).eq("id", c.id);
    if (error) throw new Error(error.message);
    return { ok: true, total: inserts.length };
  });

export const pauseCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; pause: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const status = data.pause ? "pausada" : "enviando";
    const update: any = { status };
    if (!data.pause) update.proximo_envio_em = new Date().toISOString();
    const { error } = await supabase.from("campaign").update(update).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);
    const { error } = await supabase.from("campaign").update({ status: "cancelada", concluido_em: new Date().toISOString() }).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
