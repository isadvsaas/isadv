// Server functions da Agenda (painel). Toda escrita passa pelo MESMO motor
// usado pela IA (scheduling.server.ts) — nunca há divergência entre painel e IA.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveCompany(context: any, requireAdmin = false) {
  const { supabase, userId } = context;
  const { data: cu } = await supabase
    .from("company_user")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!cu) throw new Error("Sem empresa.");
  if (requireAdmin && !["owner", "admin"].includes(cu.role)) throw new Error("Sem permissão.");
  return { companyId: cu.company_id as string, role: cu.role as string, userId: userId as string };
}

export const getAgendaOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAgendaContext, listAgendamentos } = await import("@/lib/scheduling.server");
    const { isGoogleConnected } = await import("@/lib/google.server");

    const ctx = await getAgendaContext(supabaseAdmin, companyId);
    const from = data.from || new Date(Date.now() - 86_400_000).toISOString();
    const to = data.to || new Date(Date.now() + 30 * 86_400_000).toISOString();

    const [agendamentos, { data: bloqueios }, { data: servicosRaw }, { data: agentes }] = await Promise.all([
      listAgendamentos(supabaseAdmin, companyId, { from, to }),
      supabaseAdmin
        .from("agenda_bloqueio")
        .select("*")
        .eq("company_id", companyId)
        .gte("fim", new Date(Date.now() - 86_400_000).toISOString())
        .order("inicio", { ascending: true }),
      supabaseAdmin.from("agenda_servico").select("*").eq("company_id", companyId).order("nome", { ascending: true }),
      supabaseAdmin.from("agent_config").select("id, nome_agente, agendamento_ativo").eq("company_id", companyId),
    ]);

    const { data: janelas } = await supabaseAdmin
      .from("agenda_janela")
      .select("*")
      .eq("company_id", companyId)
      .order("dia_semana", { ascending: true });

    return {
      timezone: ctx.timezone,
      googleConectado: await isGoogleConnected(supabaseAdmin, companyId),
      agendamentoAtivo: (agentes ?? []).some((a: any) => a.agendamento_ativo),
      servicos: servicosRaw ?? [],
      janelas: janelas ?? [],
      janelasEfetivas: ctx.janelas,
      bloqueios: bloqueios ?? [],
      agendamentos,
    };
  });

export const getAgendaDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { data?: string | null; dias?: number; serviceId?: string | null; ignoreId?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeAvailability } = await import("@/lib/scheduling.server");
    return computeAvailability(supabaseAdmin, companyId, {
      dateFrom: data.data ?? null,
      days: data.dias ?? 1,
      serviceId: data.serviceId ?? null,
      limit: 60,
      ignoreAgendamentoId: data.ignoreId ?? null,
    });
  });

export const criarAgendamentoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      inicio: string;
      fim?: string | null;
      titulo?: string | null;
      serviceId?: string | null;
      numero?: string | null;
      observacoes?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createAgendamento } = await import("@/lib/scheduling.server");

    let cardId: string | null = null;
    if (data.numero) {
      const { data: card } = await supabaseAdmin
        .from("crm_cards")
        .select("id")
        .eq("company_id", companyId)
        .eq("numero", data.numero)
        .maybeSingle();
      cardId = card?.id ?? null;
    }

    const r = await createAgendamento(supabaseAdmin, {
      companyId,
      inicio: data.inicio,
      fim: data.fim ?? null,
      titulo: data.titulo ?? null,
      serviceId: data.serviceId ?? null,
      numero: data.numero ?? null,
      observacoes: data.observacoes ?? null,
      cardId,
      criadoPor: "painel",
    });
    if (r.status === "created" && cardId) {
      const { formatSlotLabel } = await import("@/lib/scheduling.server");
      await supabaseAdmin.from("lead_evento").insert({
        company_id: companyId,
        card_id: cardId,
        tipo: "agendamento_criado",
        descricao: `Agendamento criado no painel — ${formatSlotLabel(new Date(r.agendamento.inicio), r.timezone)}`,
        metadata: { agendamento_id: r.agendamento.id, inicio: r.agendamento.inicio, origem: "painel" },
      });
    }
    return r;
  });

export const reagendarManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; inicio: string; fim?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reagendarAgendamento } = await import("@/lib/scheduling.server");
    const r = await reagendarAgendamento(supabaseAdmin, { companyId, id: data.id, inicio: data.inicio, fim: data.fim ?? null });
    if (r.status === "created" && r.agendamento.card_id) {
      await supabaseAdmin.from("lead_evento").insert({
        company_id: companyId,
        card_id: r.agendamento.card_id,
        tipo: "agendamento_remarcado",
        descricao: "Agendamento remarcado no painel",
        metadata: { agendamento_id: r.agendamento.id, inicio: r.agendamento.inicio, origem: "painel" },
      });
    }
    return r;
  });

export const cancelarManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; motivo?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cancelarAgendamento } = await import("@/lib/scheduling.server");
    const r = await cancelarAgendamento(supabaseAdmin, { companyId, id: data.id, motivo: data.motivo ?? null });
    if (r.ok && r.agendamento?.card_id) {
      await supabaseAdmin.from("lead_evento").insert({
        company_id: companyId,
        card_id: r.agendamento.card_id,
        tipo: "agendamento_cancelado",
        descricao: "Agendamento cancelado no painel",
        metadata: { agendamento_id: r.agendamento.id, origem: "painel", motivo: data.motivo ?? null },
      });
    }
    return r;
  });

export const concluirAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("agendamento")
      .update({ status: "concluido" })
      .eq("company_id", companyId)
      .eq("id", data.id)
      .eq("status", "agendado");
    return { ok: true };
  });

// ---------------------------------------------------------------- serviços

export const salvarServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      nome: string;
      duracao_min: number;
      buffer_min: number;
      antecedencia_min: number;
      ativo?: boolean;
      lembretes_ativos?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      company_id: companyId,
      nome: String(data.nome || "").trim().slice(0, 120) || "Atendimento",
      duracao_min: Math.min(1440, Math.max(5, Math.floor(Number(data.duracao_min) || 60))),
      buffer_min: Math.min(480, Math.max(0, Math.floor(Number(data.buffer_min) || 0))),
      antecedencia_min: Math.max(0, Math.floor(Number(data.antecedencia_min) || 0)),
      ativo: data.ativo ?? true,
      lembretes_ativos: data.lembretes_ativos ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("agenda_servico").update(payload).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await supabaseAdmin.from("agenda_servico").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: created?.id };
  });

export const excluirServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agenda_servico").delete().eq("id", data.id).eq("company_id", companyId);
    return { ok: true };
  });

// ---------------------------------------------------------------- janelas

export const salvarJanelas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { janelas: Array<{ dia_semana: number; hora_inicio: string; hora_fim: string }> }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = (data.janelas ?? [])
      .filter((j) => /^\d{2}:\d{2}/.test(j.hora_inicio) && /^\d{2}:\d{2}/.test(j.hora_fim) && j.hora_fim > j.hora_inicio)
      .map((j) => ({
        company_id: companyId,
        dia_semana: Math.min(6, Math.max(0, Math.floor(Number(j.dia_semana)))),
        hora_inicio: j.hora_inicio.slice(0, 5),
        hora_fim: j.hora_fim.slice(0, 5),
        ativo: true,
      }));
    await supabaseAdmin.from("agenda_janela").delete().eq("company_id", companyId);
    if (rows.length) {
      const { error } = await supabaseAdmin.from("agenda_janela").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, total: rows.length };
  });

// ---------------------------------------------------------------- bloqueios

export const salvarBloqueio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inicio: string; fim: string; motivo?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inicio = new Date(data.inicio);
    const fim = new Date(data.fim);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) {
      throw new Error("Período inválido.");
    }
    const { error } = await supabaseAdmin.from("agenda_bloqueio").insert({
      company_id: companyId,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      motivo: String(data.motivo || "").slice(0, 200),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirBloqueio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agenda_bloqueio").delete().eq("id", data.id).eq("company_id", companyId);
    return { ok: true };
  });

// ---------------------------------------------------------------- ativar agenda na IA

export const setAgendamentoAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ativo: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { companyId } = await resolveCompany(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agent_config")
      .update({ agendamento_ativo: !!data.ativo })
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true, ativo: !!data.ativo };
  });
