import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCompanyAndPlan(supabase: any, userId: string) {
  const { data: cu } = await supabase
    .from("company_user")
    .select("company_id, role, company:company(*)")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!cu) throw new Error("Sem empresa vinculada");
  const { data: sub } = await supabase
    .from("subscription")
    .select("plan:plan(nome)")
    .eq("company_id", cu.company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const planSlug = String(sub?.plan?.nome || "starter").toLowerCase();
  return { companyId: cu.company_id, role: cu.role, company: cu.company, planSlug };
}

function planAllowsFin(planSlug: string) {
  const s = planSlug.toLowerCase();
  return s === "pro" || s === "business";
}

async function assertCanWrite(supabase: any, userId: string) {
  const ctx = await getCompanyAndPlan(supabase, userId);
  if (!planAllowsFin(ctx.planSlug)) throw new Error("Plano não permite módulo financeiro");
  if (!ctx.company?.financeiro_ativo) throw new Error("Módulo financeiro desativado");
  return ctx;
}

// ============ Toggle ============

export const enableFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enable: boolean; diasVencimentoPadrao?: number }) => ({
    enable: !!d.enable,
    diasVencimentoPadrao: Math.max(0, Math.min(60, Math.floor(d.diasVencimentoPadrao ?? 7))),
  }))
  .handler(async ({ context, data }) => {
    const ctx = await getCompanyAndPlan(context.supabase, context.userId);
    if (data.enable && !planAllowsFin(ctx.planSlug)) {
      throw new Error("Disponível nos planos Pro e Business");
    }
    if (!["owner", "admin"].includes(ctx.role)) throw new Error("Apenas dono ou admin");
    const { error } = await context.supabase.rpc("fin_enable_for_company", {
      _company_id: ctx.companyId,
      _enable: data.enable,
    });
    if (error) throw new Error(error.message);
    if (data.enable) {
      await context.supabase
        .from("company")
        .update({ financeiro_dias_vencimento_padrao: data.diasVencimentoPadrao })
        .eq("id", ctx.companyId);
    }
    return { ok: true };
  });

// ============ KPIs ============

export const finKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    const sb = context.supabase;
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const hoje = now.toISOString().slice(0, 10);

    const baseSel = "tipo, valor_cents, status, vencimento, competencia, categoria:categoria_id(nome,cor)";
    const { data: all } = await sb
      .from("fin_lancamento")
      .select(baseSel)
      .eq("company_id", ctx.companyId)
      .gte("competencia", new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10));

    const rows = (all ?? []) as any[];
    const receitaMes = rows.filter((r) => r.tipo === "receita" && r.status === "pago" && r.competencia >= inicioMes && r.competencia <= fimMes).reduce((s, r) => s + Number(r.valor_cents), 0);
    const despesaMes = rows.filter((r) => r.tipo === "despesa" && r.status === "pago" && r.competencia >= inicioMes && r.competencia <= fimMes).reduce((s, r) => s + Number(r.valor_cents), 0);
    const aReceber = rows.filter((r) => r.tipo === "receita" && (r.status === "pendente" || r.status === "atrasado")).reduce((s, r) => s + Number(r.valor_cents), 0);
    const aPagar = rows.filter((r) => r.tipo === "despesa" && (r.status === "pendente" || r.status === "atrasado")).reduce((s, r) => s + Number(r.valor_cents), 0);
    const atrasados = rows.filter((r) => (r.status === "pendente" || r.status === "atrasado") && r.vencimento < hoje).length;

    // Série 6 meses
    const series: { mes: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ini = d.toISOString().slice(0, 10);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const r = rows.filter((x) => x.tipo === "receita" && x.status === "pago" && x.competencia >= ini && x.competencia <= fim).reduce((s, x) => s + Number(x.valor_cents), 0);
      const p = rows.filter((x) => x.tipo === "despesa" && x.status === "pago" && x.competencia >= ini && x.competencia <= fim).reduce((s, x) => s + Number(x.valor_cents), 0);
      series.push({ mes: d.toLocaleDateString("pt-BR", { month: "short" }), receita: r, despesa: p });
    }

    // Top 5 categorias despesa
    const catMap: Record<string, { nome: string; cor: string; valor: number }> = {};
    for (const r of rows) {
      if (r.tipo !== "despesa") continue;
      const k = r.categoria?.nome ?? "Sem categoria";
      catMap[k] ??= { nome: k, cor: r.categoria?.cor ?? "#999", valor: 0 };
      catMap[k].valor += Number(r.valor_cents);
    }
    const topCategorias = Object.values(catMap).sort((a, b) => b.valor - a.valor).slice(0, 5);

    // Próximos vencimentos (7 dias)
    const d7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const { data: prox } = await sb
      .from("fin_lancamento")
      .select("id, tipo, descricao, valor_cents, vencimento, status")
      .eq("company_id", ctx.companyId)
      .in("status", ["pendente", "atrasado"])
      .lte("vencimento", d7)
      .order("vencimento", { ascending: true })
      .limit(10);

    return {
      receitaMes, despesaMes,
      saldoMes: receitaMes - despesaMes,
      aReceber, aPagar, atrasados,
      series, topCategorias,
      proximos: prox ?? [],
    };
  });

// ============ Listas / CRUD ============

export const listLancamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tipo?: "receita" | "despesa"; status?: string; q?: string; from?: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    let q = context.supabase
      .from("fin_lancamento")
      .select("*, categoria:categoria_id(id,nome,cor,tipo)")
      .eq("company_id", ctx.companyId)
      .order("vencimento", { ascending: false })
      .limit(500);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.status && data.status !== "todos") q = q.eq("status", data.status as any);
    if (data.from) q = q.gte("vencimento", data.from);
    if (data.to) q = q.lte("vencimento", data.to);
    if (data.q) q = q.ilike("descricao", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("fin_categoria")
      .select("*")
      .eq("company_id", ctx.companyId)
      .order("tipo")
      .order("nome");
    return data ?? [];
  });

export const upsertLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    const valor = Math.round(Number(d.valor_reais ?? 0) * 100);
    if (!d.descricao || String(d.descricao).trim().length < 2) throw new Error("Descrição obrigatória");
    if (!d.vencimento) throw new Error("Vencimento obrigatório");
    if (!["receita", "despesa"].includes(d.tipo)) throw new Error("Tipo inválido");
    if (valor < 0) throw new Error("Valor inválido");
    return {
      id: d.id ?? null,
      tipo: d.tipo as "receita" | "despesa",
      descricao: String(d.descricao).trim(),
      valor_cents: valor,
      categoria_id: d.categoria_id || null,
      forma_pagamento: d.forma_pagamento || null,
      status: d.status || "pendente",
      vencimento: d.vencimento,
      pago_em: d.pago_em || null,
      competencia: d.competencia || d.vencimento,
      observacao: d.observacao || null,
    };
  })
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("fin_lancamento").update(rest).eq("id", id).eq("company_id", ctx.companyId);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { id: _i, ...rest } = data;
    const { data: ins, error } = await context.supabase
      .from("fin_lancamento")
      .insert({ ...rest, company_id: ctx.companyId, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id };
  });

export const marcarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; pago: boolean; pagoEm?: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    const patch: any = data.pago
      ? { status: "pago", pago_em: data.pagoEm || new Date().toISOString().slice(0, 10) }
      : { status: "pendente", pago_em: null };
    const { error } = await context.supabase
      .from("fin_lancamento")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", ctx.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("fin_lancamento")
      .delete()
      .eq("id", data.id)
      .eq("company_id", ctx.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; nome: string; tipo: "receita" | "despesa"; cor?: string; ativo?: boolean }) => {
    if (!d.nome || d.nome.trim().length < 2) throw new Error("Nome inválido");
    if (!["receita", "despesa"].includes(d.tipo)) throw new Error("Tipo inválido");
    return d;
  })
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("fin_categoria")
        .update({ nome: data.nome.trim(), tipo: data.tipo, cor: data.cor ?? "#8AA89A", ativo: data.ativo ?? true })
        .eq("id", data.id)
        .eq("company_id", ctx.companyId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("fin_categoria")
      .insert({ company_id: ctx.companyId, nome: data.nome.trim(), tipo: data.tipo, cor: data.cor ?? "#8AA89A" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = await assertCanWrite(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("fin_categoria")
      .delete()
      .eq("id", data.id)
      .eq("company_id", ctx.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const finStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await getCompanyAndPlan(context.supabase, context.userId);
    return {
      ativo: !!ctx.company?.financeiro_ativo,
      diasVencimento: Number(ctx.company?.financeiro_dias_vencimento_padrao ?? 7),
      planoPermite: planAllowsFin(ctx.planSlug),
      planSlug: ctx.planSlug,
      role: ctx.role,
    };
  });
