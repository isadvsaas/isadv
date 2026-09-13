import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/config/brand";
import {
  Bot, Instagram, MessageCircle, Smartphone, Users, Target, ArrowRight,
  AlertTriangle, CheckCircle2, Settings,
} from "lucide-react";
import { useWhatsappStatus } from "@/hooks/use-whatsapp-status";
import { CreditsBadge } from "@/components/credits-badge";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: `Início — ${brand.name}` },
      { name: "description", content: "Veja num relance se o seu atendimento no WhatsApp está funcionando hoje." },
      { property: "og:title", content: `Início — ${brand.name}` },
      { property: "og:description", content: "Veja num relance se o seu atendimento no WhatsApp está funcionando hoje." },
    ],
  }),
  component: Home,
});

type Alerta = { id: string; texto: string; to: string; acao: string };

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Home() {
  const ctx = Route.useRouteContext();
  const companyId = ctx.company?.id;
  const whatsapp = useWhatsappStatus();

  const [igConectado, setIgConectado] = useState<boolean | null>(null);
  const [iaAtiva, setIaAtiva] = useState<boolean | null>(null);
  const [temAgente, setTemAgente] = useState<boolean | null>(null);
  const [conversasHoje, setConversasHoje] = useState(0);
  const [clientesHoje, setClientesHoje] = useState(0);
  const [oportunidades, setOportunidades] = useState(0);
  const [aguardando, setAguardando] = useState(0);

  useEffect(() => { if (companyId) void load(companyId); }, [companyId]);

  async function load(cid: string) {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const inicioISO = inicioDia.toISOString();

    const [{ data: ig }, { data: agentes }, { data: msgs }, { data: cards }, { data: stages }] = await Promise.all([
      supabase.from("instagram_integration").select("conectado").eq("company_id", cid).maybeSingle(),
      supabase.from("agent_config").select("ativo").eq("company_id", cid),
      supabase.from("mensagens").select("numero,direcao,created_at").eq("company_id", cid).gte("created_at", inicioISO),
      supabase.from("crm_cards").select("stage_id,ultima_em").eq("company_id", cid),
      supabase.from("crm_stage").select("id,tipo").eq("company_id", cid),
    ]);

    setIgConectado(!!ig?.conectado);
    setTemAgente((agentes ?? []).length > 0);
    setIaAtiva((agentes ?? []).some((a: any) => a.ativo));

    const ultimaPorNumero = new Map<string, { quando: number; direcao: string }>();
    (msgs ?? []).forEach((m: any) => {
      const t = +new Date(m.created_at);
      const cur = ultimaPorNumero.get(m.numero);
      if (!cur || t > cur.quando) ultimaPorNumero.set(m.numero, { quando: t, direcao: m.direcao });
    });
    setConversasHoje(ultimaPorNumero.size);

    const meiaHoraAtras = Date.now() - 30 * 60_000;
    let esperando = 0;
    ultimaPorNumero.forEach((v) => { if (v.direcao === "entrada" && v.quando < meiaHoraAtras) esperando += 1; });
    setAguardando(esperando);

    const tipoPorStage = new Map((stages ?? []).map((s: any) => [s.id, s.tipo as string]));
    let hoje = 0, abertas = 0;
    (cards ?? []).forEach((c: any) => {
      if (c.ultima_em && +new Date(c.ultima_em) >= +inicioDia) hoje += 1;
      const tipo = c.stage_id ? tipoPorStage.get(c.stage_id) : null;
      if (tipo !== "ganho" && tipo !== "perda") abertas += 1;
    });
    setClientesHoje(hoje);
    setOportunidades(abertas);
  }

  const wppOk = whatsapp === "connected";
  const funcionando = wppOk && iaAtiva === true;

  const alertas = useMemo<Alerta[]>(() => {
    const list: Alerta[] = [];
    if (aguardando > 0)
      list.push({
        id: "aguardando",
        texto: `${aguardando} ${aguardando === 1 ? "pessoa está" : "pessoas estão"} esperando resposta há mais de 30 minutos`,
        to: "/app/conversas", acao: "Ver conversas",
      });
    if (whatsapp === "disconnected")
      list.push({ id: "wpp", texto: "Seu WhatsApp está desconectado — ninguém está sendo atendido", to: "/app/conexao", acao: "Reconectar" });
    if (temAgente === false)
      list.push({ id: "sem-agente", texto: "Você ainda não configurou o seu Atendente IA", to: "/app/agente", acao: "Configurar" });
    else if (iaAtiva === false)
      list.push({ id: "ia-off", texto: "Seu Atendente IA está desligado", to: "/app/agente", acao: "Ligar" });
    return list;
  }, [aguardando, whatsapp, temAgente, iaAtiva]);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* 1. Saudação + situação geral */}
      <header className="rounded-3xl border border-[color:var(--hairline)] bg-[color:var(--panel)] p-5 md:p-7">
        <p className="text-sm text-muted-foreground">{saudacao()} 👋</p>
        <h1 className="font-display text-[24px] md:text-[30px] font-extrabold tracking-tight mt-1 leading-tight">
          {funcionando ? "Seu atendimento está funcionando." : "Seu atendimento precisa de um ajuste."}
        </h1>
        <p className="text-[13.5px] md:text-sm text-muted-foreground mt-1.5">
          {funcionando
            ? "A IA responde suas mensagens e organiza seus clientes automaticamente."
            : "Resolva os pontos abaixo para a IA voltar a responder por você."}
        </p>
      </header>

      {/* 2. Status simples dos canais */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatusCard
          icon={<Smartphone className="size-[18px]" />}
          nome="WhatsApp"
          ok={wppOk}
          estado={whatsapp === "connected" ? "Conectado" : whatsapp === "connecting" ? "Conectando…" : whatsapp === "unknown" ? "Verificando…" : "Desconectado"}
          to="/app/conexao"
        />
        <StatusCard
          icon={<Instagram className="size-[18px]" />}
          nome="Instagram"
          ok={!!igConectado}
          estado={igConectado === null ? "Verificando…" : igConectado ? "Conectado" : "Desconectado"}
          to="/app/conexao"
        />
        <StatusCard
          icon={<Bot className="size-[18px]" />}
          nome="Atendente IA"
          ok={iaAtiva === true}
          estado={iaAtiva === null ? "Verificando…" : iaAtiva ? "Ativo" : "Inativo"}
          to="/app/agente"
        />
      </section>

      {/* 3. Resumo de hoje */}
      <section className="rounded-3xl border border-[color:var(--hairline)] bg-[color:var(--panel)] p-5 md:p-6">
        <h2 className="font-display text-[17px] font-semibold">Hoje</h2>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Numero icon={<MessageCircle className="size-4" />} valor={conversasHoje} label="Conversas" />
          <Numero icon={<Users className="size-4" />} valor={clientesHoje} label="Clientes atendidos" />
          <Numero icon={<Target className="size-4" />} valor={oportunidades} label="Oportunidades abertas" />
        </div>
      </section>

      {/* 4. Precisa de você */}
      {alertas.length > 0 && (
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/[0.07] p-5 md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-[18px] text-amber-500" />
            <h2 className="font-display text-[17px] font-semibold">Precisa de você</h2>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {alertas.map((a) => (
              <Link
                key={a.id}
                to={a.to}
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--panel)] border border-[color:var(--hairline)] px-4 py-3 text-[13.5px] hover:border-[color:var(--hairline-strong)]"
              >
                <span className="flex-1">{a.texto}</span>
                <span className="hidden sm:inline text-[12.5px] font-semibold text-[color:var(--brand-text)]">{a.acao}</span>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {alertas.length === 0 && (
        <div className="flex items-center gap-2 text-[13.5px] text-muted-foreground px-1">
          <CheckCircle2 className="size-4 text-[color:var(--brand)]" />
          Nada precisa da sua atenção agora.
        </div>
      )}

      {/* 5. Ações rápidas */}
      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Acao to="/app/conversas" icon={<MessageCircle className="size-[18px]" />} titulo="Ver conversas" desc="Acompanhe e responda quando quiser" />
        <Acao to="/app/crm" icon={<Users className="size-[18px]" />} titulo="Ver clientes" desc="Seus contatos e oportunidades" />
        <Acao to="/app/agente" icon={<Settings className="size-[18px]" />} titulo="Configurar Atendente IA" desc="Ajuste como a IA fala com você" />
      </section>

      {/* 6. Créditos/plano discretos */}
      <div className="flex items-center justify-center pt-1">
        <CreditsBadge />
      </div>
    </div>
  );
}

function StatusCard({ icon, nome, ok, estado, to }: { icon: any; nome: string; ok: boolean; estado: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4 py-3.5 hover:border-[color:var(--hairline-strong)] transition-colors"
    >
      <span className="size-9 rounded-xl grid place-items-center bg-[color:var(--panel-2)] text-muted-foreground shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold truncate">{nome}</span>
        <span className={`block text-[12px] ${ok ? "text-[color:var(--brand-text)]" : "text-muted-foreground"}`}>{estado}</span>
      </span>
      <span className="size-2 rounded-full shrink-0" style={{ background: ok ? "var(--brand)" : "rgb(148 163 184 / .8)" }} />
    </Link>
  );
}

function Numero({ icon, valor, label }: { icon: any; valor: number; label: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--panel-2)] border border-[color:var(--hairline)] px-3 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-[24px] md:text-[28px] font-extrabold tracking-tight tabular-nums mt-1 leading-none">{valor}</div>
      <div className="text-[11.5px] text-muted-foreground mt-1 leading-tight">{label}</div>
    </div>
  );
}

function Acao({ to, icon, titulo, desc }: { to: string; icon: any; titulo: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4 py-3.5 hover:border-[color:var(--hairline-strong)] transition-colors"
    >
      <span className="size-9 rounded-xl grid place-items-center text-[color:var(--brand-text)] shrink-0" style={{ background: "var(--brand-soft)" }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold truncate">{titulo}</span>
        <span className="block text-[11.5px] text-muted-foreground truncate">{desc}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
