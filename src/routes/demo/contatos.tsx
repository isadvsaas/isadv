import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { demoCards, type DemoCard } from "@/lib/demo-data";
import { Search, UserPlus, Upload, Lock } from "lucide-react";
import { DemoLeadDrawer } from "@/components/demo/demo-lead-drawer";

export const Route = createFileRoute("/demo/contatos")({
  head: () => ({ meta: [{ title: `${brand.name} — Contatos (demo)` }] }),
  component: ContatosDemo,
});

const STAGE_LABEL: Record<string, string> = {
  conversas: "Conversas", negociando: "Negociando", ganho: "Ganho", perda: "Perda",
};
const STAGE_COLOR: Record<string, string> = {
  conversas: "#22D3EE", negociando: "#FFB020", ganho: "#25D366", perda: "#FF5A5A",
};

function ContatosDemo() {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("");
  const [active, setActive] = useState<DemoCard | null>(null);

  const list = useMemo(() => {
    let l = demoCards;
    if (stage) l = l.filter((c) => c.status === stage);
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((c) => c.nome.toLowerCase().includes(s) || c.numero.includes(s));
    }
    return l;
  }, [q, stage]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">Contatos <HelpTip text="Base completa de clientes da clínica, com histórico, etapa no CRM e tags (procedimento de interesse, origem, etc)." /></h1>
          <p className="text-xs text-muted-foreground">Todos os leads que passaram pelo WhatsApp — exemplo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled><Upload className="size-4 mr-1.5" />Importar CSV</Button>
          <Button disabled><UserPlus className="size-4 mr-1.5" />Novo contato</Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou número…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Chip label="Todas" active={stage === ""} on={() => setStage("")} />
          {Object.entries(STAGE_LABEL).map(([k, v]) => (
            <Chip key={k} label={v} active={stage === k} color={STAGE_COLOR[k]} on={() => setStage(k)} />
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <Lock className="size-3" /> Demonstração — somente leitura
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Contato</th>
              <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Etapa</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Última msg</th>
              <th className="text-right px-4 py-3 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} onClick={() => setActive(c)} className="border-t border-border hover:bg-muted/40 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={c.nome} size={34} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{c.nome}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{c.numero}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
                    <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[c.status] }} />
                    {STAGE_LABEL[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-[12.5px] truncate max-w-[280px]">
                  {c.ultima_mensagem}
                </td>
                <td className="px-4 py-3 text-right font-display font-bold text-[13px]">
                  {c.valor != null ? `R$ ${c.valor.toLocaleString("pt-BR")}` : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="text-center text-sm text-muted-foreground py-8">Nenhum contato encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <DemoLeadDrawer card={active} onClose={() => setActive(null)} />
    </div>
  );
}

function Chip({ label, active, color, on }: { label: string; active: boolean; color?: string; on: () => void }) {
  return (
    <button
      onClick={on}
      className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition ${
        active ? "bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-soft-strong)]" : "border-border text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {color && <span className="inline-block size-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />}
      {label}
    </button>
  );
}
