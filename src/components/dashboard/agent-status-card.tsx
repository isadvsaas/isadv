import { Bot } from "lucide-react";

export function AgentStatusCard({
  status, tempoMedio, taxaQualificacao, numero,
}: {
  status: "connected" | "connecting" | "disconnected";
  tempoMedio?: string;
  taxaQualificacao?: string;
  numero?: string | null;
}) {
  const label = status === "connected" ? "Ativo" : status === "connecting" ? "Conectando" : "Desconectado";
  const sub = status === "connected" ? "respondendo automaticamente" : status === "connecting" ? "preparando conexão" : "configure a conexão";
  const dotColor = status === "connected" ? "#00E676" : status === "connecting" ? "#FFB020" : "#FF5A5A";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-[15px] font-semibold">Status do Agente</h3>
      <p className="text-xs text-muted-foreground mb-4">tempo real</p>
      <div className="flex items-center gap-3.5 pb-4 border-b border-border">
        <div className="size-13 w-[52px] h-[52px] rounded-2xl grid place-items-center text-[#00E676] bg-[rgba(37,211,102,.14)]">
          <Bot className="size-6" />
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-base flex items-center gap-2">
            <span className="relative inline-flex">
              <span className="size-2 rounded-full" style={{ background: dotColor }} />
              {status === "connected" && (
                <span className="absolute inset-0 size-2 rounded-full animate-ping" style={{ background: dotColor, opacity: 0.6 }} />
              )}
            </span>
            {label}
          </div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
      <Row label="Tempo médio" value={tempoMedio ?? "—"} />
      <Row label="Número conectado" value={numero || "—"} mono />
      <Row label="Taxa de qualificação" value={taxaQualificacao ?? "—"} accent />
    </div>
  );
}

function Row({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm border-t border-border first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <b className={`${accent ? "text-[var(--brand-strong)]" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value}</b>
    </div>
  );
}
