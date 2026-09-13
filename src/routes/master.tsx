import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/config/brand";
import { Shield, LogOut, BarChart3, Building2, Plus, Settings, ArrowLeft, Package, CreditCard, Bot } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileBottomNav, type MobileNavItem } from "@/components/mobile-bottom-nav";

export const Route = createFileRoute("/master")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/entrar" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!isSuper) {
      await supabase.auth.signOut();
      throw redirect({ to: "/entrar", search: { modo: "login" } });
    }
    return { user: u.user };
  },
  component: MasterLayout,
});

const sections = [
  {
    label: "Operação",
    items: [
      { to: "/master/painel", label: "Painel", icon: BarChart3 },
      { to: "/master/empresas", label: "Empresas", icon: Building2 },
      { to: "/master/assinaturas", label: "Assinaturas", icon: CreditCard },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { to: "/master/planos", label: "Planos", icon: Package },
      { to: "/master/templates", label: "Templates de agentes", icon: Bot },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/master/nova-empresa", label: "Nova empresa", icon: Plus },
      { to: "/master/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const RED = "var(--brand-master)";
const RED_SOFT = "rgba(220,38,38,.12)";
const RED_SOFT_STRONG = "rgba(220,38,38,.22)";

const mobileItems: MobileNavItem[] = [
  { to: "/master/painel", label: "Painel", icon: BarChart3 },
  { to: "/master/empresas", label: "Empresas", icon: Building2 },
  { to: "/master/assinaturas", label: "Assinat.", icon: CreditCard },
  { to: "/master/planos", label: "Planos", icon: Package },
];

function MasterLayout() {
  const loc = useLocation();
  const ctx = Route.useRouteContext() as any;
  const email: string | null = ctx?.user?.email ?? null;
  const userName = (email || "Master").split("@")[0];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Master ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full blur-3xl opacity-25"
          style={{ background: `radial-gradient(circle, ${RED} 0%, transparent 60%)` }}
        />
        <div
          className="absolute top-[40%] -left-40 h-[480px] w-[480px] rounded-full blur-3xl opacity-15"
          style={{ background: `radial-gradient(circle, ${RED} 0%, transparent 65%)` }}
        />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-[color:var(--panel)]/80 backdrop-blur-xl border-b border-[color:var(--hairline)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="size-8 rounded-lg grid place-items-center text-primary-foreground shrink-0"
            style={{ background: `linear-gradient(135deg, ${RED}, #B91C1C)` }}
          >
            <Shield className="size-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold tracking-tight text-[14.5px] leading-none truncate" style={{ color: RED }}>Master</div>
            <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">{brand.name} · admin</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/entrar"; }}
            title="Sair"
            className="size-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="hidden md:flex w-[260px] min-h-screen border-r border-[color:var(--hairline)] bg-[color:var(--sidebar-bg)] flex-col">
          <div className="px-5 py-5 flex items-center gap-3 border-b border-[color:var(--hairline)]">
            <div
              className="size-10 rounded-xl grid place-items-center text-primary-foreground shadow-md ring-1 ring-[color:var(--hairline)]"
              style={{ background: `linear-gradient(135deg, ${RED}, #B91C1C)` }}
            >
              <Shield className="size-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold tracking-tight truncate text-[16px]" style={{ color: RED }}>
                Master
              </div>
              <div className="text-[11.5px] text-muted-foreground truncate -mt-0.5">{brand.name} · admin</div>
            </div>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto space-y-5">
            {sections.map((sec) => (
              <div key={sec.label}>
                <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  {sec.label}
                </div>
                <div className="flex flex-col gap-1">
                  {sec.items.map((it) => {
                    const active = loc.pathname.startsWith(it.to);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        className={`relative flex items-center gap-3 px-3 py-[11px] rounded-lg text-[14.5px] font-medium whitespace-nowrap transition-all ${
                          active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--panel-2)]"
                        }`}
                        style={
                          active
                            ? {
                                background: RED_SOFT,
                                boxShadow: `inset 0 0 0 1px ${RED_SOFT_STRONG}, 0 0 22px -10px ${RED}`,
                              }
                            : undefined
                        }
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: RED, boxShadow: `0 0 12px ${RED}` }} />
                        )}
                        <Icon className="size-[18px] shrink-0" style={active ? { color: RED } : undefined} />
                        <span className="flex-1 truncate">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <Link to="/app/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-[color:var(--panel-2)]">
              <ArrowLeft className="size-3.5" /> Voltar ao app
            </Link>
          </nav>

          <div className="p-3 border-t border-[color:var(--hairline)]">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[color:var(--panel-2)] border border-[color:var(--hairline)]">
              <div
                className="size-9 rounded-full grid place-items-center text-[13px] font-bold ring-1 shrink-0"
                style={{ background: RED_SOFT, color: RED, boxShadow: `inset 0 0 0 1px ${RED_SOFT_STRONG}` }}
              >
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold truncate">{userName}</div>
                <div className="text-[11px] truncate" style={{ color: RED }}>Super admin</div>
              </div>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/entrar"; }}
                title="Sair"
                className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[color:var(--panel)]"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1 px-4 pt-4 pb-28 md:p-8 md:pb-8 max-w-7xl w-full mx-auto">
          <div className="hidden md:flex items-center justify-between gap-3 mb-6">
            <div
              className="flex items-center gap-2 text-[13.5px] font-medium px-3 py-1.5 rounded-full bg-[color:var(--panel)] border border-[color:var(--hairline)]"
              style={{ color: RED }}
            >
              <span className="size-1.5 rounded-full" style={{ background: RED, boxShadow: `0 0 10px ${RED}` }} />
              Modo super admin
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
              <div
                className="size-9 rounded-full grid place-items-center text-[13px] font-bold ring-1"
                style={{ background: RED_SOFT, color: RED, boxShadow: `inset 0 0 0 1px ${RED_SOFT_STRONG}` }}
                title={email || ""}
              >
                {userName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
          <Outlet />
        </main>
      </div>

      <MobileBottomNav items={mobileItems} accent={RED} />
      </div>
    </div>
  );
}
