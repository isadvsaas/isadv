import { InitialsAvatar } from "@/components/ui/initials-avatar";

export interface TimelineItem {
  id: string;
  nome: string;
  autor: "ia" | "humano" | "contato";
  texto: string;
  quando: Date;
}

export function MessageTimeline({ items, empty }: { items: TimelineItem[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{empty || "Nenhuma atividade ainda."}</p>;
  }
  return (
    <ul>
      {items.map((m) => (
        <li key={m.id} className="flex gap-3 py-4 border-b border-border last:border-b-0">
          <InitialsAvatar name={m.nome} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[15px]">
              <b className="truncate font-semibold">{m.nome}</b>
              <AuthorBadge autor={m.autor} />
              <span className="ml-auto text-[12px] text-muted-foreground whitespace-nowrap">
                {m.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </span>
            </div>
            <p className="text-foreground/70 text-[14px] mt-1 truncate">{m.texto}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AuthorBadge({ autor }: { autor: "ia" | "humano" | "contato" }) {
  const cls =
    autor === "ia"
      ? "bg-[rgba(37,211,102,.15)] text-[#9af0bd] ring-1 ring-[rgba(37,211,102,.25)]"
      : "bg-muted text-foreground/70 ring-1 ring-white/10";
  const txt = autor === "ia" ? "IA" : autor === "humano" ? "Atendente" : "Contato";
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${cls}`}>{txt}</span>;
}
