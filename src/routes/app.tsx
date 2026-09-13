import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import type { CompanyRow, Membership } from "@/lib/tenant";

type Ctx = {
  user: { id: string; email?: string | null };
  company: CompanyRow | null;
  membership: Membership | null;
  isSuperAdmin: boolean;
  impersonating: boolean;
};

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async ({ location }): Promise<Ctx> => {
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) throw redirect({ to: "/entrar" });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");

    // Impersonação (super admin entrando como empresa via /master/empresas)
    let impersonateId: string | null = null;
    if (isSuperAdmin) {
      try { impersonateId = sessionStorage.getItem("master_impersonate_company"); } catch {}
    }

    if (impersonateId) {
      const { data: comp } = await supabase.from("company").select("*").eq("id", impersonateId).maybeSingle();
      if (comp) {
        return {
          user: { id: u.user.id, email: u.user.email },
          company: comp as any as CompanyRow,
          membership: { company_id: comp.id, role: "owner", forcar_troca_senha: false },
          isSuperAdmin,
          impersonating: true,
        };
      }
    }

    const { data: cu } = await supabase
      .from("company_user")
      .select("company_id, role, forcar_troca_senha, ativo, created_at, company:company(*)")
      .eq("user_id", u.user.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!cu) {
      if (isSuperAdmin) throw redirect({ to: "/master/painel" });
      if (location.pathname !== "/app/checkout") throw redirect({ to: "/app/checkout" });
      return { user: { id: u.user.id, email: u.user.email }, company: null, membership: null, isSuperAdmin, impersonating: false };
    }

    if (cu.forcar_troca_senha && location.pathname !== "/trocar-senha") {
      throw redirect({ to: "/trocar-senha" });
    }

    const company = (cu.company as any) as CompanyRow;

    // Trial expirado ou status que exige pagamento → trava no checkout
    const trialExpired =
      company.status_cobranca === "trial" &&
      new Date(company.trial_ate).getTime() <= Date.now();
    const needsPayment =
      company.status_cobranca === "checkout_pending" ||
      company.status_cobranca === "suspenso" ||
      company.status_cobranca === "pendente" ||
      trialExpired;

    if (needsPayment && location.pathname !== "/app/checkout") {
      throw redirect({ to: "/app/checkout" });
    }

    // Empresa criada mas onboarding não finalizado → força wizard (apenas se já tem acesso).
    // /app/conexao fica liberado porque o próprio wizard manda o cliente conectar o WhatsApp lá.
    const onboardingAllowed = ["/app/onboarding", "/app/checkout", "/app/conexao"];
    if (
      !needsPayment &&
      !company.onboarding_completed &&
      !onboardingAllowed.includes(location.pathname)
    ) {
      throw redirect({ to: "/app/onboarding" });
    }

    return {
      user: { id: u.user.id, email: u.user.email },
      company,
      membership: { company_id: cu.company_id, role: cu.role as any, forcar_troca_senha: cu.forcar_troca_senha },
      isSuperAdmin,
      impersonating: false,
    };
  },
  component: AppLayout,
});

function AppLayout() {
  const ctx = Route.useRouteContext();
  if (ctx.company?.status_cobranca === "suspenso" && !ctx.impersonating) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <div className="text-3xl">⛔</div>
          <h1 className="text-2xl font-bold">Conta suspensa</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta foi suspensa por inadimplência. Regularize o pagamento para voltar a usar o {ctx.company.nome}.
          </p>
          <Button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/entrar"; }} variant="outline">
            Sair
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      {ctx.impersonating && (
        <div className="bg-destructive text-destructive-foreground text-sm px-4 py-2 flex items-center justify-between">
          <span>🛡️ Você está visualizando como <b>{ctx.company?.nome}</b> (impersonação).</span>
          <Button size="sm" variant="outline" className="h-7 bg-transparent border-white/30 text-white hover:bg-white/10"
            onClick={() => { sessionStorage.removeItem("master_impersonate_company"); window.location.href = "/master/empresas"; }}>
            Sair da impersonação
          </Button>
        </div>
      )}
      <AppShell company={ctx.company} membership={ctx.membership} email={ctx.user.email} isSuperAdmin={ctx.isSuperAdmin}>
        <Outlet />
      </AppShell>
    </>
  );
}
