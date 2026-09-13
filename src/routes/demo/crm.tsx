import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useMemo } from "react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { brand } from "@/config/brand";
import { Sparkles } from "lucide-react";
import { demoCards, type DemoCard } from "@/lib/demo-data";

export const Route = createFileRoute("/demo/crm")({
  head: () => ({ meta: [{ title: `${brand.name} — CRM (demo)` }] }),
  component: CrmDemo,
});

type Status = "conversas" | "negociando" | "ganho" | "perda";
const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "conversas", label: "Conversas", color: "#22D3EE" },
  { id: "negociando", label: "Negociando", color: "#FFB020" },
  { id: "ganho", label: "Ganho", color: "#25D366" },
  { id: "perda", label: "Perda", color: "#FF5A5A" },
];

function CrmDemo() {
  const byStatus = useMemo(() => {
    const m: Record<Status, DemoCard[]> = { conversas: [], negociando: [], ganho: [], perda: [] };
    demoCards.forEach((c) => m[c.status].push(c));
    return m;
  }, []);

  return (
    <div className="space-y-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">CRM Kanban <HelpTip text="Pipeline visual: do primeiro contato até o agendamento confirmado. Veja em qual etapa cada lead está parado." /></h1>
          <p className="text-xs text-muted-foreground">A IA também move automaticamente entre as colunas — exemplo.</p>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => (
          <div key={col.id} className="rounded-2xl border border-border bg-card p-3.5 min-h-[420px]">
            <div className="flex items-center gap-2 mb-3.5">
              <span className="size-2.5 rounded-full" style={{ background: col.color, boxShadow: `0 0 8px ${col.color}` }} />
              <b className="font-display text-[13.5px]">{col.label}</b>
              <span className="ml-auto text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{byStatus[col.id].length}</span>
            </div>
            <div className="space-y-2.5">
              {byStatus[col.id].map((c) => <CardBody key={c.id} card={c} />)}
              {byStatus[col.id].length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">vazio</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardBody({ card }: { card: DemoCard }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-3 transition-all hover:border-border">
      <div className="flex items-center gap-2.5">
        <InitialsAvatar name={card.nome || card.numero} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate">{card.nome}</div>
          <div className="text-[10.5px] text-muted-foreground font-mono truncate">{card.numero}</div>
        </div>
      </div>
      {card.ultima_mensagem && (
        <p className="text-muted-foreground text-[12px] mt-2 line-clamp-2">{card.ultima_mensagem}</p>
      )}
      <div className="flex items-center gap-2 mt-2.5">
        {card.valor != null && (
          <span className="font-display font-bold text-[13px] text-[#A3E635]">
            R$ {Number(card.valor).toLocaleString("pt-BR")}
          </span>
        )}
        <span className="text-[9.5px] font-bold text-[#00E676] bg-[rgba(37,211,102,.12)] px-1.5 py-0.5 rounded-md flex items-center gap-1">
          <Sparkles className="size-2.5" /> IA
        </span>
        <span className="ml-auto text-[10.5px] text-muted-foreground">
          {card.ultima_em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })} {card.ultima_em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
        </span>
      </div>
    </div>
  );
}
