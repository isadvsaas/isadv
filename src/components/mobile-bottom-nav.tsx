import { Link, useLocation } from "@tanstack/react-router";

export type MobileNavItem = {
  to?: string;
  label: string;
  icon: any;
  onClick?: () => void;
};

export function MobileBottomNav({
  items,
  accent = "var(--brand)",
}: {
  items: MobileNavItem[];
  accent?: string;
}) {
  const loc = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
      aria-label="Navegação principal"
    >
      <div
        className="mx-auto max-w-md rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)]/75 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,.35)] flex items-center justify-around px-1.5 py-1.5"
        style={{ WebkitBackdropFilter: "blur(20px)" }}
      >
        {items.map((it) => {
          const active = !!it.to && (it.to === loc.pathname || loc.pathname.startsWith(it.to));
          const Icon = it.icon;
          const Cmp: any = it.to ? Link : "button";
          return (
            <Cmp
              key={it.to ?? it.label}
              {...(it.to ? { to: it.to } : { type: "button", onClick: it.onClick })}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10.5px] font-medium transition-all"
              style={
                active
                  ? { color: accent }
                  : { color: "var(--muted-foreground)" }
              }
            >
              <Icon
                className="size-[22px]"
                strokeWidth={active ? 2.4 : 1.9}
              />
              <span className="truncate max-w-[64px]">{it.label}</span>
              {active && (
                <span
                  className="absolute -top-0.5 h-[3px] w-7 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
                />
              )}
            </Cmp>
          );
        })}
      </div>
    </nav>
  );
}
