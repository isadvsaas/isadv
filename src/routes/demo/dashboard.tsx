import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Bot, MessageCircle, Target, Trophy, Calendar, Star } from "lucide-react";
import { demoStats, demoMensagens, demoAgendamentos, demoCsat } from "@/lib/demo-data";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MiniAreaChart, type AreaPoint } from "@/components/dashboard/mini-area-chart";
import { AgentStatusCard } from "@/components/dashboard/agent-status-card";
import { MessageTimeline } from "@/components/dashboard/message-timeline";

export const Route = createFileRoute("/demo/dashboard")({
  head: () => ({ meta: [{ title: `${brand.name} — Demonstração` }] }),
  component: DemoDashboard,
});

function DemoDashboard() {
  const series: AreaPoint[] = Array.from({ length: 14 }, (_, i) => ({
    label: String(i),
    a: 12 + Math.round(Math.sin(i * 0.6) * 6 + i * 0.8),
    b: 8 + Math.round(Math.sin(i * 0.7) * 5 + i * 0.6),
  }));
  const last = [...demoMensagens].sort((a, b) => +b.quando - +a.quando).slice(0, 8);
  const csatMedia = (demoCsat.reduce((a, b) => a + b.score, 0) / demoCsat.length).toFixed(1);
  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">Dashboard <HelpTip text="Visão geral do dia: agendamentos, conversas, conversão e mensagens recentes. Tudo o que importa para o gestor em uma tela." /></h1>
          <p className="text-xs text-muted-foreground">Clínica Vitalis · visão geral do dia</p>
        </div>
        <div className="flex items-center gap-2 bg-[rgba(124,58,237,.12)] border border-[rgba(124,58,237,.30)] text-[var(--brand-text)] text-[12.5px] font-semibold px-3 py-1.5 rounded-full">
          <span className="size-2 rounded-full bg-[var(--brand)] shadow-[0_0_8px_var(--brand)]" /> Vivi conectada
        </div>
      </header>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard accent icon={<MessageCircle className="size-4" />} label="Conversas hoje" value={42} trend="+24% vs ontem" />
        <KpiCard icon={<Bot className="size-4" />} label="IA respondeu" value={38} trend="89% no automático" />
        <KpiCard icon={<Calendar className="size-4" />} label="Agendamentos" value={demoAgendamentos.length} trend="próximos 7 dias" />
        <KpiCard icon={<Star className="size-4" />} label="CSAT médio" value={`${csatMedia}/5`} trend={`${demoCsat.length} avaliações`} />
      </div>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-[15px] font-semibold">Atendimentos · 14 dias</h3>
          <p className="text-xs text-muted-foreground mb-3">recebidas vs respondidas pela IA</p>
          <MiniAreaChart data={series} />
        </div>
        <AgentStatusCard status="connected" numero="+55 11 99999-0000" tempoMedio="2,8s" taxaQualificacao="71%" />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-[15px] font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-[var(--brand-text)]" /> Próximos agendamentos
          </h3>
          <p className="text-xs text-muted-foreground mb-3">a IA confirma 1 dia antes</p>
          <div className="divide-y divide-border">
            {demoAgendamentos.map((a) => (
              <div key={a.id} className="py-3 flex items-center gap-3">
                <div className="size-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] grid place-items-center text-center font-display font-bold leading-none">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider">{a.quando.toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" })}</div>
                    <div className="text-[14px] mt-0.5">{a.quando.getDate()}</div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[13.5px] truncate">{a.cliente}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">{a.procedimento} · {a.profissional}</div>
                </div>
                <div className="text-[12.5px] font-bold tabular-nums text-[var(--brand-text)] whitespace-nowrap">
                  {a.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-[15px] font-semibold">Últimas mensagens</h3>
          <p className="text-xs text-muted-foreground mb-2">atividade recente</p>
          <MessageTimeline items={last.slice(0, 6).map((m) => ({ id: m.id, nome: m.nome, autor: m.autor, texto: m.texto, quando: m.quando }))} />
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Funil resumido: <b>{demoStats.conversas}</b> em conversa · <b>{demoStats.negociando}</b> negociando · <b>{demoStats.ganho}</b> agendados.
      </div>
    </div>
  );
}
