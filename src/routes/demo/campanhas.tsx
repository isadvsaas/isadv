import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Lock, Send, Eye, MessageSquare, AlertCircle, Calendar } from "lucide-react";
import { demoCampanhas } from "@/lib/demo-data";

export const Route = createFileRoute("/demo/campanhas")({
  head: () => ({ meta: [{ title: `${brand.name} — Campanhas (demo)` }] }),
  component: CampanhasDemo,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  agendada: { label: "Agendada", cls: "bg-[rgba(124,58,237,.15)] text-[var(--brand-text)]" },
  enviando: { label: "Enviando", cls: "bg-[rgba(255,176,32,.15)] text-[#ffd591]" },
  concluida: { label: "Concluída", cls: "bg-[rgba(37,211,102,.15)] text-[#9af0bd]" },
};

function CampanhasDemo() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Megaphone className="size-5 text-[var(--brand-text)]" /> Campanhas <HelpTip text="Envios em massa com regras anti-ban: limite por hora, intervalo aleatório e respeito ao horário comercial. Segmente por tag, etapa do CRM ou lista importada." />
          </h1>
          <p className="text-xs text-muted-foreground">Disparo em massa segmentado por tag, com agendamento e anti-ban.</p>
        </div>
        <Button disabled><Plus className="size-4 mr-1.5" />Nova campanha</Button>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 grid sm:grid-cols-4 gap-4">
        <Kpi icon={<Send className="size-3.5" />} label="Enviadas (30d)" value="236" />
        <Kpi icon={<Eye className="size-3.5" />} label="Taxa de leitura" value="80%" />
        <Kpi icon={<MessageSquare className="size-3.5" />} label="Respostas" value="46" />
        <Kpi icon={<AlertCircle className="size-3.5" />} label="Falhas" value="4" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Campanha</th>
              <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Segmento</th>
              <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Quando</th>
              <th className="text-right px-4 py-3 font-semibold">Entrega</th>
            </tr>
          </thead>
          <tbody>
            {demoCampanhas.map((c) => {
              const st = STATUS[c.status];
              const taxa = c.enviados ? Math.round((c.respondidos / c.enviados) * 100) : 0;
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[13.5px]">{c.nome}</div>
                    <div className="text-[11px] text-muted-foreground sm:hidden">{st.label}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge className={`${st.cls} border-none font-semibold`}>{st.label}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-[12.5px]">{c.segmento}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-[12.5px]">
                    <Calendar className="size-3 inline mr-1" />
                    {c.quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "concluida" ? (
                      <div className="text-[12px]">
                        <div><b>{c.enviados}</b><span className="text-muted-foreground">/{c.total}</span> enviados</div>
                        <div className="text-muted-foreground">{c.lidos} lidos · <span className="text-[var(--brand-text)] font-bold">{taxa}%</span> resp</div>
                      </div>
                    ) : (
                      <div className="text-[12px] text-muted-foreground">{c.total} contatos</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[var(--brand-soft-strong)] bg-[var(--brand-soft)]/40 p-5">
        <h3 className="font-display font-bold text-[14px] mb-2 flex items-center gap-2">
          <Sparkle /> Anti-ban inteligente
        </h3>
        <p className="text-[13px] text-muted-foreground">
          Intervalo aleatório entre 5–20s entre disparos, pausa automática a cada 50 mensagens e detecção de respostas
          para pausar a campanha — tudo pra proteger seu número do WhatsApp.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="size-3" /> Demonstração — somente leitura.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="font-display font-extrabold text-2xl mt-1">{value}</div>
    </div>
  );
}

function Sparkle() {
  return <span className="size-2 rounded-full bg-[var(--brand)] shadow-[0_0_10px_var(--brand)]" />;
}
