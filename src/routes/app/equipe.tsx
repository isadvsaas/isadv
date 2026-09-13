import { createFileRoute, redirect } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { EquipePanel } from "@/components/config/equipe-panel";

export const Route = createFileRoute("/app/equipe")({
  head: () => ({ meta: [{ title: `${brand.name} — Equipe` }] }),
  beforeLoad: ({ context }: any) => {
    const r = context?.membership?.role;
    if (r !== "owner" && r !== "admin") throw redirect({ to: "/app/dashboard" });
  },
  component: EquipePage,
});

function EquipePage() {
  const ctx = Route.useRouteContext();
  const isOwner = ctx.membership?.role === "owner";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Equipe <HelpTip text="Adicione pessoas, defina a função (Administrador ou Atendente) e ative/desative acessos." />
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie quem tem acesso a esta empresa.</p>
      </div>
      <EquipePanel isOwner={isOwner} />
    </div>
  );
}
