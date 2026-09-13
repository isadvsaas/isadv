// ETAPA 5 — Configuração do atendente em experiência progressiva (UI apenas).
import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AgentActionsPanel } from "@/components/agent-actions-panel";
import { AgentFieldsPanel } from "@/components/agent-fields-panel";
import { AgentFollowupPanel } from "@/components/agent-followup-panel";
import { AgentMaterialsPanel } from "@/components/agent-materials-panel";
import { toast } from "sonner";
import { Bot, Loader2, Save, ArrowLeft, ChevronDown, Star } from "lucide-react";
import { brand } from "@/config/brand";
import { updateMyAgent } from "@/lib/agent-catalog.functions";

export const Route = createFileRoute("/app/agente/configurar")({
  head: () => ({
    meta: [
      { title: `${brand.name} — Configurar atendente` },
      { name: "description", content: "Configure como seu atendente conversa, o que ele pode fazer e o que precisa descobrir." },
      { property: "og:title", content: `${brand.name} — Configurar atendente` },
      { property: "og:description", content: "Configure seu atendente de WhatsApp em poucos passos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  beforeLoad: ({ context }: any) => {
    const r = context?.membership?.role;
    if (r === "atendente") throw redirect({ to: "/app/dashboard" });
  },
  component: ConfigurarPage,
});

const TABS: Array<[string, string]> = [
  ["perfil", "Perfil"],
  ["negocio", "Negócio"],
  ["acoes", "O que pode fazer"],
  ["lembretes", "Lembretes"],
  ["campos", "Informações para coletar"],
  ["materiais", "Materiais"],
];

const PERSONALIDADES: Array<[string, string]> = [
  ["padrao", "Equilibrado — simpático e profissional"],
  ["extrovertido", "Animado e cheio de energia"],
  ["serio", "Sério e direto ao ponto"],
  ["divertido", "Leve e bem-humorado"],
  ["consultivo", "Consultivo — recomenda com fundamento"],
  ["amigavel", "Acolhedor e próximo"],
];

function ConfigurarPage() {
  const ctx = Route.useRouteContext() as any;
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const companyId = ctx.company?.id;
  const doUpdate = useServerFn(updateMyAgent);

  const [tab, setTab] = useState<string>("perfil");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);

  function up(k: string, v: any) {
    setCfg((p: any) => ({ ...p, [k]: v }));
  }

  async function reload() {
    if (!companyId) return;
    setLoading(true);
    if (id) {
      const { AGENT_SAFE_COLUMNS } = await import("@/lib/agents");
      const { data } = await supabase.from("agent_config").select(AGENT_SAFE_COLUMNS).eq("id", id).eq("company_id", companyId).maybeSingle();
      setCfg(data ?? null);
    } else {
      const { fetchDefaultAgent } = await import("@/lib/agents");
      setCfg(await fetchDefaultAgent(supabase, companyId));
    }
    setLoading(false);
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, id]);

  async function save() {
    if (!cfg?.id) return;
    setSaving(true);
    const {
      id: _i, company_id: _c, user_id: _u, created_at: _ca, updated_at: _ua, source_template_id: _st, ...rest
    } = cfg;
    const { error } = await supabase.from("agent_config").update(rest).eq("id", cfg.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Alterações salvas");
  }

  async function makeDefault() {
    if (!cfg?.id) return;
    try {
      await doUpdate({ data: { id: cfg.id, makeDefault: true } });
      up("is_default", true);
      toast.success("Este é o atendente principal agora");
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  async function setAtivo(v: boolean) {
    if (!cfg?.id) return;
    up("ativo", v);
    try {
      await doUpdate({ data: { id: cfg.id, ativo: v } });
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  if (loading) {
    return <div className="grid place-items-center h-40 text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  if (!cfg) {
    return (
      <div className="max-w-xl mx-auto space-y-4 text-center py-10">
        <p className="text-sm text-muted-foreground">
          Você ainda não tem um atendente configurado.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild><Link to="/app/agentes">Escolher um atendente</Link></Button>
          <Button variant="outline" asChild><Link to="/app/agente">Criar com ajuda da IA</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full min-w-0">
      <header className="space-y-3">
        <button
          onClick={() => navigate({ to: "/app/agentes" })}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3" /> Voltar para meus atendentes
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2">
              <Bot className="size-5 text-primary" /> {cfg.nome_agente || "Seu atendente"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {cfg.descricao || cfg.papel_objetivo || "Atende seus clientes por você."}
            </p>
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
          </Button>
        </div>
      </header>

      {/* Seletor de seção: menu no celular, abas no desktop */}
      <div className="sm:hidden">
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TABS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden sm:flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-[13.5px] font-medium transition ${
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome do atendente" value={cfg.nome_agente} onChange={(v) => up("nome_agente", v)} />
            <Field label="Para que ele serve" value={cfg.descricao} onChange={(v) => up("descricao", v)} />
          </div>
          <Area label="O que ele deve fazer nas conversas" value={cfg.papel_objetivo} onChange={(v) => up("papel_objetivo", v)} rows={3} />
          <div className="space-y-1.5">
            <Label>Jeito de falar</Label>
            <Select value={cfg.personalidade ?? "padrao"} onValueChange={(v) => up("personalidade", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONALIDADES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tamanho das respostas</Label>
            <Select value={cfg.tamanho_resposta ?? "curtas"} onValueChange={(v) => up("tamanho_resposta", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="curtas">Curtas (estilo WhatsApp)</SelectItem>
                <SelectItem value="medias">Médias</SelectItem>
                <SelectItem value="longas">Longas (explicativas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Area label="Como ele se apresenta na 1ª mensagem" value={cfg.apresentacao} onChange={(v) => up("apresentacao", v)} rows={2} />
          <Area label="Instruções principais" value={cfg.estilo_comunicacao} onChange={(v) => up("estilo_comunicacao", v)} rows={3} />

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Atendente ativo</p>
              <p className="text-xs text-muted-foreground">Quando desligado, ele não responde ninguém.</p>
            </div>
            <Switch className="shrink-0" checked={!!cfg.ativo} onCheckedChange={setAtivo} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Atendente principal</p>
              <p className="text-xs text-muted-foreground">É quem atende quando nenhum outro se encaixa.</p>
            </div>
            {cfg.is_default ? (
              <span className="text-xs text-primary font-medium shrink-0 inline-flex items-center gap-1"><Star className="size-3.5" /> Principal</span>
            ) : (
              <Button size="sm" variant="outline" className="shrink-0" onClick={makeDefault}>Definir como principal</Button>
            )}
          </div>
        </Card>
      )}

      {tab === "negocio" && (
        <div className="space-y-3">
          <Card>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nome da empresa" value={cfg.nome_empresa} onChange={(v) => up("nome_empresa", v)} />
              <Field label="Segmento" value={cfg.segmento} onChange={(v) => up("segmento", v)} />
            </div>
            <Field label="Região e horário de atendimento" value={cfg.regiao_horario} onChange={(v) => up("regiao_horario", v)} />
            <Area label="Sobre a empresa" value={cfg.sobre_empresa} onChange={(v) => up("sobre_empresa", v)} rows={3} />
          </Card>

          <Group title="Produtos e serviços">
            <Area label="O que você vende" value={cfg.produtos_servicos} onChange={(v) => up("produtos_servicos", v)} rows={4} />
            <Area label="Descrição do negócio" value={cfg.descricao_negocio} onChange={(v) => up("descricao_negocio", v)} rows={3} />
            <Area label="Diferenciais" value={cfg.diferenciais} onChange={(v) => up("diferenciais", v)} rows={2} />
            <Area label="Público-alvo" value={cfg.publico_alvo} onChange={(v) => up("publico_alvo", v)} rows={2} />
          </Group>

          <Group title="Vendas e pagamento">
            <Area label="Como vender (passo a passo)" value={cfg.como_vender} onChange={(v) => up("como_vender", v)} rows={4} />
            <Area label="Dúvidas e objeções comuns" value={cfg.objecoes} onChange={(v) => up("objecoes", v)} rows={3} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Formas de pagamento" value={cfg.formas_pagamento} onChange={(v) => up("formas_pagamento", v)} />
              <Field label="Ticket médio" value={cfg.ticket_medio} onChange={(v) => up("ticket_medio", v)} />
            </div>
          </Group>

          <Group title="Ofertas e cupons">
            <Area label="Ofertas ativas" value={cfg.ofertas} onChange={(v) => up("ofertas", v)} rows={3} />
            <Field label="Cupom" value={cfg.cupom} onChange={(v) => up("cupom", v)} />
          </Group>

          <Group title="Dúvidas frequentes e políticas">
            <Area label="Perguntas frequentes" value={cfg.faq} onChange={(v) => up("faq", v)} rows={5} />
            <Area label="Políticas (troca, cancelamento, garantia)" value={cfg.politicas} onChange={(v) => up("politicas", v)} rows={4} />
            <Area label="Mensagem de pós-venda" value={cfg.posvenda_msg} onChange={(v) => up("posvenda_msg", v)} rows={2} />
          </Group>

          <Group title="Limites do atendente">
            <Area label="O que ele PODE fazer" value={cfg.pode_fazer} onChange={(v) => up("pode_fazer", v)} rows={3} />
            <Area label="O que ele NÃO pode fazer" value={cfg.nao_pode_fazer} onChange={(v) => up("nao_pode_fazer", v)} rows={3} />
            <Field label="Telefone para transferir atendimento" value={cfg.telefone_transferencia} onChange={(v) => up("telefone_transferencia", v)} />
          </Group>

          <p className="text-xs text-muted-foreground text-center">
            <Link to="/app/agente/avancado" className="underline">Ver todas as configurações detalhadas</Link>
          </p>
        </div>
      )}

      {tab === "acoes" && (
        <Card>
          <AgentActionsPanel
            allowedTools={Array.isArray(cfg.allowed_tools) ? cfg.allowed_tools : []}
            onChangeTools={(v) => up("allowed_tools", v)}
          />
          <p className="text-xs text-muted-foreground">Lembre-se de salvar depois de mudar as permissões.</p>
        </Card>
      )}

      {tab === "lembretes" && (
        <Card>
          <AgentFollowupPanel companyId={companyId} agentId={cfg.id} />
        </Card>
      )}

      {tab === "campos" && (
        <Card>
          <AgentFieldsPanel companyId={companyId} agentId={cfg.id} />
        </Card>
      )}

      {tab === "materiais" && (
        <Card>
          <AgentMaterialsPanel companyId={companyId} agentId={cfg.id} />
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5 space-y-4 min-w-0">{children}</div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 p-4 text-left">
          <span className="text-sm font-semibold">{title}</span>
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-[var(--border)] p-4 space-y-3">{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, rows = 3 }: { label: string; value?: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label>{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </div>
  );
}
