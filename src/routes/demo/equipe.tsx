import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { UserPlus, Lock, Check, X } from "lucide-react";

export const Route = createFileRoute("/demo/equipe")({
  head: () => ({ meta: [{ title: `${brand.name} — Equipe (demo)` }] }),
  component: EquipeDemo,
});

const MEMBROS = [
  { nome: "Ana Vitalis", email: "ana@clinicavitalis.com.br", papel: "Dono", ativo: true },
  { nome: "Dra. Helena Marques", email: "helena@clinicavitalis.com.br", papel: "Admin", ativo: true },
  { nome: "Patrícia Lima (Recepção)", email: "recepcao@clinicavitalis.com.br", papel: "Atendente", ativo: true },
  { nome: "Paula Santos (Esteticista)", email: "paula@clinicavitalis.com.br", papel: "Atendente", ativo: true },
  { nome: "Carlos Mendes", email: "carlos@clinicavitalis.com.br", papel: "Atendente", ativo: false },
];

const PAPEIS = ["Dono", "Admin", "Atendente"] as const;
const PERMISSIONS: { label: string; roles: Record<(typeof PAPEIS)[number], boolean> }[] = [
  { label: "Ver Dashboard", roles: { Dono: true, Admin: true, Atendente: true } },
  { label: "Responder Conversas", roles: { Dono: true, Admin: true, Atendente: true } },
  { label: "Mover cards no CRM", roles: { Dono: true, Admin: true, Atendente: true } },
  { label: "Editar Agente IA", roles: { Dono: true, Admin: true, Atendente: false } },
  { label: "Ver Relatórios", roles: { Dono: true, Admin: true, Atendente: false } },
  { label: "Gerenciar Equipe", roles: { Dono: true, Admin: true, Atendente: false } },
  { label: "Configurações da Empresa", roles: { Dono: true, Admin: true, Atendente: false } },
  { label: "Cancelar plano", roles: { Dono: true, Admin: false, Atendente: false } },
];

function PapelChip({ p }: { p: string }) {
  const cls =
    p === "Dono" ? "bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-soft-strong)]"
    : p === "Admin" ? "bg-muted text-foreground border-border"
    : "bg-muted/50 text-muted-foreground border-border";
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{p}</span>;
}

function EquipeDemo() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">Equipe <HelpTip text="Recepcionistas, esteticistas e gestores com permissões diferentes. Cada um vê apenas o que precisa." /></h1>
          <p className="text-xs text-muted-foreground">Membros, papéis e permissões — exemplo.</p>
        </div>
        <Button disabled><UserPlus className="size-4 mr-1.5" />Convidar membro</Button>
      </header>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Membro</th>
              <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Papel</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {MEMBROS.map((m) => (
              <tr key={m.email} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={m.nome} size={34} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{m.nome}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell"><PapelChip p={m.papel} /></td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-[11.5px] font-semibold inline-flex items-center gap-1.5 ${m.ativo ? "text-[var(--brand-text)]" : "text-muted-foreground"}`}>
                    <span className={`size-1.5 rounded-full ${m.ativo ? "bg-[var(--brand)]" : "bg-muted-foreground"}`} />
                    {m.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" disabled>Editar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-[15px] font-semibold">Matriz de permissões</h3>
          <p className="text-xs text-muted-foreground">O que cada papel pode fazer no sistema.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Permissão</th>
              {PAPEIS.map((p) => <th key={p} className="text-center px-4 py-3 font-semibold">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                {PAPEIS.map((p) => (
                  <td key={p} className="px-4 py-3 text-center">
                    {row.roles[p]
                      ? <Check className="size-4 mx-auto text-[var(--brand)]" />
                      : <X className="size-4 mx-auto text-muted-foreground/50" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="size-3" /> Demonstração — somente leitura.
      </p>
    </div>
  );
}
