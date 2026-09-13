import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/tenant";

async function assertSuper(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Acesso negado");
}

export const masterKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: companies }, { count: msgCount }, { count: cardsCount }, { data: subscriptions }] = await Promise.all([
      supabaseAdmin.from("company").select("id, status_cobranca, trial_ate, created_at"),
      supabaseAdmin.from("mensagens").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("crm_cards").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("subscription").select("status, plan:plan(preco_cents)"),
    ]);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const all = companies ?? [];
    const subs = subscriptions ?? [];
    const stats = {
      total: all.length,
      ativas: all.filter((c: any) => c.status_cobranca === "ativo").length,
      trial: all.filter((c: any) => c.status_cobranca === "trial").length,
      suspensas: all.filter((c: any) => c.status_cobranca === "suspenso").length,
      novasMes: all.filter((c: any) => new Date(c.created_at).getTime() >= monthStart).length,
      mensagens: msgCount ?? 0,
      cards: cardsCount ?? 0,
      assinaturasAtivas: subs.filter((s: any) => s.status === "active").length,
      assinaturasTrial: subs.filter((s: any) => s.status === "trialing").length,
      mrr: subs.filter((s: any) => s.status === "active").reduce((sum: number, s: any) => sum + (s.plan?.preco_cents ?? 0), 0),
    };
    // Crescimento (últimos 12 meses)
    const series: { mes: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = all.filter((c: any) => {
        const t = new Date(c.created_at).getTime();
        return t < next.getTime();
      }).length;
      series.push({ mes: d.toLocaleDateString("pt-BR", { month: "short" }), total: count });
    }
    return { stats, series };
  });

export const listMasterSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscription")
      .select("*, plan:plan(nome,preco_cents,moeda,intervalo), company:company(nome,status_cobranca,email_corporativo)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { rows: data ?? [] };
  });

export const listCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; page?: number }) => ({
    search: (d.search ?? "").trim().toLowerCase(),
    page: Math.max(0, d.page ?? 0),
  }))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pageSize = 20;
    let q = supabaseAdmin
      .from("company")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    if (data.search) q = q.ilike("nome", `%${data.search}%`);
    const { data: rows, count, error } = await q;
    if (error) throw error;
    const ids = (rows ?? []).map((c: any) => c.id);
    let ultByCompany: Record<string, string> = {};
    let waByCompany: Record<string, string> = {};
    let igByCompany: Record<string, string> = {};
    if (ids.length) {
      const [{ data: msgs }, { data: waRows }, { data: igRows }] = await Promise.all([
        supabaseAdmin
          .from("mensagens")
          .select("company_id, created_at")
          .in("company_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
        supabaseAdmin.from("whatsapp_instances").select("company_id, status").in("company_id", ids),
        supabaseAdmin.from("instagram_integration").select("company_id, conectado").in("company_id", ids),
      ]);
      for (const m of msgs ?? []) {
        if (!ultByCompany[(m as any).company_id]) ultByCompany[(m as any).company_id] = (m as any).created_at;
      }
      for (const w of waRows ?? []) {
        const cid = (w as any).company_id;
        const st = String((w as any).status ?? "").toLowerCase();
        const connected = st === "connected" || st === "open";
        if (connected || !waByCompany[cid]) waByCompany[cid] = connected ? "connected" : "disconnected";
      }
      for (const i of igRows ?? []) {
        igByCompany[(i as any).company_id] = (i as any).conectado ? "connected" : "disconnected";
      }
    }
    const list = (rows ?? []).map((c: any) => ({
      ...c,
      ultima_atividade: ultByCompany[c.id] ?? null,
      whatsapp_status: waByCompany[c.id] ?? "unset",
      instagram_status: igByCompany[c.id] ?? "unset",
    }));
    return { rows: list, total: count ?? 0, pageSize };
  });


export const suspendCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; suspend: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("company")
      .update({ status_cobranca: data.suspend ? "suspenso" : "ativo" })
      .eq("id", data.companyId);
    if (error) throw error;
    return { ok: true };
  });

export const extendTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; days: number }) => ({
    companyId: d.companyId,
    days: Math.max(1, Math.min(365, Math.floor(d.days))),
  }))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("company").select("trial_ate").eq("id", data.companyId).maybeSingle();
    const base = c?.trial_ate ? new Date(c.trial_ate as string) : new Date();
    const next = new Date(Math.max(base.getTime(), Date.now()) + data.days * 86400000);
    const { error } = await supabaseAdmin
      .from("company")
      .update({ trial_ate: next.toISOString(), status_cobranca: "trial" })
      .eq("id", data.companyId);
    if (error) throw error;
    return { trial_ate: next.toISOString() };
  });

export const createCompanyWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    nome: string; ownerEmail: string;
    planId?: string | null; trialDays?: number; password?: string | null;
  }) => {
    const nome = String(d.nome || "").trim();
    const ownerEmail = String(d.ownerEmail || "").trim().toLowerCase();
    if (nome.length < 2) throw new Error("Nome inválido");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error("Email inválido");
    const password = d.password ? String(d.password) : null;
    if (password && password.length < 8) throw new Error("Senha mínima de 8 caracteres");
    return {
      nome, ownerEmail,
      planId: d.planId || null,
      trialDays: Math.max(0, Math.min(90, Math.floor(d.trialDays ?? 3))),
      password,
    };
  })
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // owner
    let ownerId: string | null = null;
    const { data: prof } = await supabaseAdmin.from("profiles").select("user_id").eq("email", data.ownerEmail).maybeSingle();
    if (prof) ownerId = prof.user_id;
    let tempPassword: string | null = null;
    if (!ownerId) {
      tempPassword = data.password ?? (Math.random().toString(36).slice(2, 10) + "A1!");
      const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.ownerEmail, password: tempPassword, email_confirm: true,
      });
      if (error || !c.user) throw new Error(error?.message || "Falha ao criar usuário");
      ownerId = c.user.id;
      await supabaseAdmin.from("profiles").upsert({ user_id: ownerId, email: data.ownerEmail });
    } else if (data.password) {
      // Reset de senha do owner já existente
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(ownerId, {
        password: data.password, email_confirm: true,
      });
      if (upErr) throw upErr;
      tempPassword = data.password;
    }

    // company com slug único
    let baseSlug = slugify(data.nome);
    let slug = baseSlug;
    for (let i = 1; i < 20; i++) {
      const { data: ex } = await supabaseAdmin.from("company").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      slug = `${baseSlug}-${i}`;
    }
    const trialMs = data.trialDays * 86400000;
    const trialEnd = new Date(Date.now() + trialMs).toISOString();

    // Plano escolhido pelo master fica registrado na empresa (o checkout só entra em cena no fim do trial).
    let planSlug: string | null = null;
    if (data.planId) {
      const { data: pl } = await supabaseAdmin.from("plan").select("slug").eq("id", data.planId).maybeSingle();
      planSlug = pl?.slug ?? null;
    }

    const { data: comp, error: cErr } = await supabaseAdmin
      .from("company")
      .insert({
        nome: data.nome,
        slug,
        created_by: ownerId,
        status_cobranca: data.trialDays > 0 ? "trial" : "ativo",
        trial_ate: trialEnd,
        selected_plan_slug: planSlug,
        onboarding_completed: false,
        onboarding_step: 0,
      })
      .select("id")
      .single();
    if (cErr || !comp) throw new Error(cErr?.message || "Falha ao criar empresa");

    await supabaseAdmin.from("company_user").insert({
      company_id: comp.id, user_id: ownerId, role: "owner", ativo: true, forcar_troca_senha: !data.password && !!tempPassword,
    });

    // Cria subscription em trialing já com o plano selecionado
    if (data.planId) {
      await supabaseAdmin.from("subscription").insert({
        company_id: comp.id,
        plan_id: data.planId,
        status: data.trialDays > 0 ? "trialing" : "active",
        trial_ends_at: trialEnd,
        current_period_end: trialEnd,
      });
    }

    return { ok: true, companyId: comp.id, tempPassword };
  });

export const listPlansBasic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("plan")
      .select("id, nome, preco_cents, moeda, intervalo, trial_days")
      .eq("ativo", true)
      .order("preco_cents", { ascending: true });
    return { plans: data ?? [] };
  });

export const getSuperAdminEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_config").select("super_admin_emails").eq("id", true).maybeSingle();
    return { emails: (data?.super_admin_emails ?? []) as string[] };
  });

export const setSuperAdminEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { emails: string[] }) => {
    const clean = Array.from(new Set((d.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)));
    for (const e of clean) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error(`Email inválido: ${e}`);
    }
    return { emails: clean };
  })
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: true, super_admin_emails: data.emails });
    if (error) throw error;
    // promove novos super_admin existentes
    if (data.emails.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, email").in("email", data.emails);
      for (const p of profs ?? []) {
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: p.user_id, role: "super_admin" as any },
          { onConflict: "user_id,role" } as any,
        );
      }
    }
    return { ok: true };
  });

export const resetCompanyOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; newPassword?: string }) => ({
    companyId: String(d.companyId),
    newPassword: d.newPassword ? String(d.newPassword) : undefined,
  }))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Descobre o owner ativo
    const { data: cu } = await supabaseAdmin
      .from("company_user")
      .select("user_id, role")
      .eq("company_id", data.companyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true });
    const owner = (cu ?? []).find((r: any) => r.role === "owner") ?? (cu ?? [])[0];
    if (!owner) throw new Error("Empresa sem usuário responsável");

    const password =
      data.newPassword && data.newPassword.length >= 8
        ? data.newPassword
        : Math.random().toString(36).slice(2, 10) + "A1!";

    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(owner.user_id, {
      password,
      email_confirm: true,
    });
    if (uErr) throw uErr;

    // Força troca no próximo login (se foi senha auto-gerada)
    if (!data.newPassword) {
      await supabaseAdmin
        .from("company_user")
        .update({ forcar_troca_senha: true })
        .eq("company_id", data.companyId)
        .eq("user_id", owner.user_id);
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", owner.user_id)
      .maybeSingle();

    return { ok: true, tempPassword: data.newPassword ? null : password, ownerEmail: prof?.email ?? null };
  });

export const getCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => ({ companyId: String(d.companyId) }))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error } = await supabaseAdmin
      .from("company")
      .select("*")
      .eq("id", data.companyId)
      .maybeSingle();
    if (error) throw error;
    if (!company) throw new Error("Empresa não encontrada");

    const { data: members } = await supabaseAdmin
      .from("company_user")
      .select("user_id, role, ativo, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: true });

    const userIds = (members ?? []).map((m: any) => m.user_id);
    let profilesById: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, nome, telefone")
        .in("user_id", userIds);
      for (const p of profs ?? []) profilesById[(p as any).user_id] = p;
    }
    const membersFull = (members ?? []).map((m: any) => ({
      ...m,
      profile: profilesById[m.user_id] ?? null,
    }));

    const { data: subscription } = await supabaseAdmin
      .from("subscription")
      .select("*, plan:plan(nome, preco_cents, moeda, intervalo)")
      .eq("company_id", data.companyId)
      .maybeSingle();

    const [{ count: msgCount }, { count: contactsCount }, { count: cardsCount }] = await Promise.all([
      supabaseAdmin.from("mensagens").select("id", { count: "exact", head: true }).eq("company_id", data.companyId),
      supabaseAdmin.from("crm_cards").select("id", { count: "exact", head: true }).eq("company_id", data.companyId),
      supabaseAdmin.from("crm_cards").select("id", { count: "exact", head: true }).eq("company_id", data.companyId),
    ]);

    // Créditos: saldo atual + últimas movimentações (sem criar outro sistema)
    const { data: ledger } = await supabaseAdmin
      .from("credit_ledger")
      .select("delta, saldo_apos, motivo, ref, created_at")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(10);
    const consumo = (ledger ?? [])
      .filter((l: any) => Number(l.delta) < 0)
      .reduce((s: number, l: any) => s + Math.abs(Number(l.delta)), 0);

    // Conexões — somente estado persistido, sem chamadas externas. Nunca retorna tokens.
    const { data: waRows } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("instance_name, numero, status, updated_at")
      .eq("company_id", data.companyId);
    const { data: igRow } = await supabaseAdmin
      .from("instagram_integration")
      .select("username, page_name, ig_user_id, conectado, updated_at")
      .eq("company_id", data.companyId)
      .maybeSingle();

    return {
      company,
      members: membersFull,
      subscription,
      credits: {
        saldo: (company as any).creditos_saldo ?? 0,
        origem: (company as any).creditos_origem ?? null,
        resetam_em: (company as any).creditos_resetam_em ?? null,
        consumo_recente: consumo,
        ledger: ledger ?? [],
      },
      whatsapp: waRows ?? [],
      instagram: igRow
        ? {
            status: igRow.conectado ? "connected" : "disconnected",
            username: igRow.username ?? igRow.page_name ?? igRow.ig_user_id ?? null,
            updated_at: igRow.updated_at,
          }
        : null,
      stats: {
        mensagens: msgCount ?? 0,
        contatos: contactsCount ?? 0,
        cards: cardsCount ?? 0,
      },
    };
  });

// Alteração administrativa de plano — reutiliza plan/subscription, registra no audit_log.
export const changeCompanyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; planId: string }) => ({
    companyId: String(d.companyId),
    planId: String(d.planId),
  }))
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/audit.server");

    const { data: plan } = await supabaseAdmin
      .from("plan")
      .select("id, nome, slug, ativo")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !plan.ativo) throw new Error("Plano inválido ou inativo");

    const { data: sub } = await supabaseAdmin
      .from("subscription")
      .select("id, plan_id, status, provider, metadata")
      .eq("company_id", data.companyId)
      .maybeSingle();

    let previousPlanId: string | null = null;
    if (sub) {
      previousPlanId = sub.plan_id ?? null;
      const metadata = {
        ...(((sub as any).metadata ?? {}) as Record<string, unknown>),
        plan_change_origin: "admin_manual",
        plan_change_at: new Date().toISOString(),
        plan_change_by: context.userId,
        previous_plan_id: previousPlanId,
      };
      const { error } = await supabaseAdmin
        .from("subscription")
        .update({ plan_id: plan.id, metadata })
        .eq("id", sub.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("subscription").insert({
        company_id: data.companyId,
        plan_id: plan.id,
        status: "active",
        provider: "manual",
        metadata: {
          plan_change_origin: "admin_manual",
          plan_change_at: new Date().toISOString(),
          plan_change_by: context.userId,
        },
      } as any);
      if (error) throw error;
    }

    await supabaseAdmin.from("company").update({ selected_plan_slug: plan.slug }).eq("id", data.companyId);

    await writeAudit({
      companyId: data.companyId,
      userId: context.userId,
      actorEmail: (context.claims as any)?.email ?? null,
      acao: "master.plan_change",
      recurso: `subscription:${data.companyId}`,
      detalhes: { previous_plan_id: previousPlanId, new_plan_id: plan.id, plano: plan.nome, origem: "admin_manual" },
    });

    return { ok: true, planId: plan.id, planNome: plan.nome };
  });

