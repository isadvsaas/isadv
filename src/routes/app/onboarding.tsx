import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { brand } from "@/config/brand";
import {
  Loader2, Check, Building2, MapPin, Palette, Bot, PartyPopper,
  MessageCircle, ShieldCheck, KanbanSquare, Paperclip, Send, Plus, ExternalLink, Settings2,
} from "lucide-react";
import { maskCpf, maskCnpj, maskPhone, maskCep } from "@/lib/masks";
import { AgentActionsPanel } from "@/components/agent-actions-panel";
import { AgentMaterialsPanel } from "@/components/agent-materials-panel";
import { useWhatsappStatus } from "@/hooks/use-whatsapp-status";
import { testAiReply } from "@/lib/evolution.functions";

type Search = { checkout?: string };

export const Route = createFileRoute("/app/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  head: () => ({ meta: [{ title: `${brand.name} — Bem-vindo` }] }),
  component: Onboarding,
});

const STEPS = [
  { key: "empresa", label: "Empresa", icon: Building2 },
  { key: "endereco", label: "Endereço", icon: MapPin },
  { key: "identidade", label: "Identidade", icon: Palette },
  { key: "agente", label: "Atendente", icon: Bot },
  { key: "acoes", label: "Permissões", icon: ShieldCheck },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "funil", label: "Etapas", icon: KanbanSquare },
  { key: "materiais", label: "Materiais", icon: Paperclip },
  { key: "teste", label: "Teste", icon: Send },
  { key: "concluir", label: "Concluir", icon: PartyPopper },
] as const;

const SEGMENTOS = [
  "Varejo / E-commerce", "Alimentação", "Beleza e Estética", "Saúde", "Educação",
  "Serviços Profissionais", "Imobiliária", "Agência / Marketing", "Software / SaaS",
  "Indústria", "Construção", "Logística", "Outro",
];

const PORTES = ["Autônomo / MEI", "Pequena (até 9)", "Média (10-49)", "Grande (50+)"];

const ACOES_PADRAO = ["atualizar_lead", "qualificar_lead", "mover_pipeline", "transferir_humano"];

type StageRow = { id: string; nome: string; ordem: number; cor: string; tipo: string };

function Onboarding() {
  const ctx = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/onboarding" }) as Search;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Empresa
  const [tipoPessoa, setTipoPessoa] = useState<"pf" | "pj">("pj");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState(ctx.company?.nome ?? "");
  const [emailCorp, setEmailCorp] = useState(ctx.user.email ?? "");
  const [telefone, setTelefone] = useState("");
  const [segmento, setSegmento] = useState("");
  const [porte, setPorte] = useState("");
  const [site, setSite] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Identidade
  const [primaryColor, setPrimaryColor] = useState(ctx.company?.primary_color ?? brand.primary);
  const [logoUrl, setLogoUrl] = useState(ctx.company?.logo_url ?? "");

  // Agente
  const [agente, setAgente] = useState({
    nome_agente: "Atendente Virtual",
    papel_objetivo: "Atender clientes, tirar dúvidas e ajudar a fechar vendas.",
    estilo_comunicacao: "Cordial, profissional e objetivo.",
    sobre_empresa: "",
    produtos_servicos: "",
  });
  const [agentId, setAgentId] = useState<string | undefined>(undefined);

  // Permissões da IA
  const [allowedTools, setAllowedTools] = useState<string[]>(ACOES_PADRAO);
  const [telefoneTransferencia, setTelefoneTransferencia] = useState("");
  const [quandoTransferir, setQuandoTransferir] = useState(
    "Quando o cliente pedir para falar com uma pessoa, reclamar de algo sério ou pedir algo que a IA não sabe responder.",
  );

  // Etapas do funil
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // Teste
  const runTest = useServerFn(testAiReply);
  const [testMsg, setTestMsg] = useState("Oi, vocês atendem hoje?");
  const [testReply, setTestReply] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const waStatus = useWhatsappStatus(15000);

  // Sem empresa? Vai para checkout primeiro
  useEffect(() => {
    if (!ctx.company) navigate({ to: "/app/checkout", replace: true });
  }, [ctx.company, navigate]);

  // Pré-preenche com dados existentes da empresa
  useEffect(() => {
    if (!ctx.company) return;
    const c = ctx.company;
    if (c.tipo_pessoa) setTipoPessoa(c.tipo_pessoa as any);
    if (c.cnpj_cpf) setCnpjCpf(c.cnpj_cpf);
    if (c.razao_social) setRazaoSocial(c.razao_social);
    if (c.nome_fantasia) setNomeFantasia(c.nome_fantasia);
    if (c.email_corporativo) setEmailCorp(c.email_corporativo);
    if (c.telefone) setTelefone(c.telefone);
    if (c.segmento) setSegmento(c.segmento);
    if (c.porte) setPorte(c.porte);
    if (c.site) setSite(c.site);
    if (c.cep) setCep(c.cep);
    if (c.rua) setRua(c.rua);
    if (c.numero) setNumero(c.numero);
    if (c.complemento) setComplemento(c.complemento);
    if (c.bairro) setBairro(c.bairro);
    if (c.cidade) setCidade(c.cidade);
    if (c.estado) setEstado(c.estado);
    if (typeof c.onboarding_step === "number" && c.onboarding_step > 0) {
      setStep(Math.min(c.onboarding_step, STEPS.length - 1));
    }
  }, [ctx.company]);

  // Retoma o que já foi configurado do atendente (progresso salvo)
  useEffect(() => {
    if (!ctx.company) return;
    void (async () => {
      const { fetchDefaultAgent } = await import("@/lib/agents");
      const a: any = await fetchDefaultAgent(supabase, ctx.company!.id);
      if (!a) return;
      setAgentId(a.id);
      setAgente((prev) => ({
        nome_agente: a.nome_agente || prev.nome_agente,
        papel_objetivo: a.papel_objetivo || prev.papel_objetivo,
        estilo_comunicacao: a.estilo_comunicacao || prev.estilo_comunicacao,
        sobre_empresa: a.sobre_empresa || prev.sobre_empresa,
        produtos_servicos: a.produtos_servicos || prev.produtos_servicos,
      }));
      if (Array.isArray(a.allowed_tools) && a.allowed_tools.length) setAllowedTools(a.allowed_tools as string[]);
      if (a.telefone_transferencia) setTelefoneTransferencia(a.telefone_transferencia);
    })();
  }, [ctx.company]);

  // Etapas reais do CRM (criadas automaticamente com a empresa)
  useEffect(() => {
    if (!ctx.company || STEPS[step]?.key !== "funil") return;
    void reloadStages();
  }, [ctx.company, step]);

  // Toast pagamento aprovado
  useEffect(() => {
    if (search.checkout === "success") {
      toast.success("Pagamento validado! Acesso liberado.");
    }
  }, [search.checkout]);

  if (!ctx.company) return null;
  const companyId = ctx.company.id;

  async function reloadStages() {
    setLoadingStages(true);
    const { data } = await supabase
      .from("crm_stage")
      .select("id, nome, ordem, cor, tipo")
      .eq("company_id", companyId)
      .order("ordem", { ascending: true });
    setStages((data ?? []) as StageRow[]);
    setLoadingStages(false);
  }

  async function addStage() {
    const ordem = stages.length ? Math.max(...stages.map((s) => s.ordem)) + 1 : 0;
    const { error } = await supabase
      .from("crm_stage")
      .insert({ company_id: companyId, nome: "Nova etapa", ordem, cor: "#8AA89A", tipo: "normal" });
    if (error) return toast.error(error.message);
    await reloadStages();
  }

  async function renameStage(id: string, nome: string) {
    setStages((ss) => ss.map((s) => (s.id === id ? { ...s, nome } : s)));
    await supabase.from("crm_stage").update({ nome }).eq("id", id).eq("company_id", companyId);
  }

  async function persistPartial(nextStep: number) {
    const patch: any = {
      tipo_pessoa: tipoPessoa,
      cnpj_cpf: cnpjCpf || null,
      razao_social: razaoSocial || null,
      nome_fantasia: nomeFantasia || null,
      email_corporativo: emailCorp || null,
      telefone: telefone || null,
      segmento: segmento || null,
      porte: porte || null,
      site: site || null,
      cep: cep || null,
      rua: rua || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      pais: "BR",
      primary_color: primaryColor,
      logo_url: logoUrl || null,
      onboarding_step: nextStep,
    };
    await supabase.from("company").update(patch).eq("id", companyId);
  }

  /** Salva o atendente (sem apagar nada que já exista) e devolve o id. */
  async function persistAgent() {
    const { saveDefaultAgentConfig, fetchDefaultAgent } = await import("@/lib/agents");
    const { error } = await saveDefaultAgentConfig(supabase, companyId, ctx.user.id, {
      nome_empresa: nomeFantasia.trim(),
      segmento: segmento || "",
      ...agente,
      allowed_tools: allowedTools,
      telefone_transferencia: telefoneTransferencia,
      nao_pode_fazer: quandoTransferir
        ? `Transferir para uma pessoa do time nas seguintes situações: ${quandoTransferir}`
        : "",
    } as any);
    if (error) throw new Error(error.message);
    const a: any = await fetchDefaultAgent(supabase, companyId);
    if (a?.id) setAgentId(a.id);
  }

  function validateStep(): string | null {
    const key = STEPS[step]?.key;
    if (key === "empresa") {
      if (!nomeFantasia.trim()) return "Informe o nome da empresa.";
      if (!cnpjCpf.trim()) return tipoPessoa === "pj" ? "Informe o CNPJ." : "Informe o CPF.";
      if (!telefone.trim()) return "Informe o telefone.";
      if (!segmento) return "Selecione o segmento.";
      if (!porte) return "Selecione o porte.";
    }
    if (key === "endereco") {
      if (!cep.trim() || !cidade.trim() || !estado.trim()) return "Preencha CEP, cidade e estado.";
    }
    if (key === "agente") {
      if (!agente.nome_agente.trim()) return "Dê um nome ao seu atendente.";
      if (agente.sobre_empresa.trim().length < 10) return "Escreva um pouco sobre a sua empresa.";
    }
    return null;
  }

  async function next() {
    const err = validateStep();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const key = STEPS[step]?.key;
      if (key === "agente" || key === "acoes") await persistAgent();
      await persistPartial(step + 1);
      setStep(Math.min(step + 1, STEPS.length - 1));
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }
  function back() { if (step > 0) setStep(step - 1); }

  async function testar() {
    setTesting(true); setTestReply([]);
    try {
      await persistAgent();
      const r = await runTest({ data: { message: testMsg } });
      setTestReply(r.parts);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível testar agora.");
    } finally {
      setTesting(false);
    }
  }

  async function finalizar() {
    setSaving(true);
    try {
      await persistPartial(STEPS.length - 1);
      await persistAgent();
      await supabase.from("company").update({
        onboarding_completed: true,
        nome: nomeFantasia.trim(),
      }).eq("id", companyId);

      toast.success("Tudo pronto! Bem-vindo ao " + brand.name);
      window.location.href = "/app/dashboard";
    } catch (e: any) {
      toast.error(e.message || "Falha ao concluir");
    } finally {
      setSaving(false);
    }
  }

  const stepKey = STEPS[step]?.key;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-display">Vamos configurar seu {brand.name}</h1>
        <p className="text-sm text-muted-foreground">
          Passo a passo, em linguagem simples. Cada passo é salvo — você pode sair e continuar depois.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 md:gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.key} className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <div className={`size-8 rounded-full grid place-items-center text-xs font-bold transition ${
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className={`text-xs md:text-sm hidden sm:block ${active ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</div>
              {i < STEPS.length - 1 && <div className="w-4 md:w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <Card className="p-6 space-y-4">
        {stepKey === "empresa" && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoPessoa("pj")}
                className={`flex-1 rounded-lg border-2 p-3 text-sm font-semibold transition ${tipoPessoa === "pj" ? "border-primary bg-primary/5" : "border-border"}`}
              >Pessoa Jurídica (CNPJ)</button>
              <button
                type="button"
                onClick={() => setTipoPessoa("pf")}
                className={`flex-1 rounded-lg border-2 p-3 text-sm font-semibold transition ${tipoPessoa === "pf" ? "border-primary bg-primary/5" : "border-border"}`}
              >Pessoa Física (CPF)</button>
            </div>

            <Row label={tipoPessoa === "pj" ? "CNPJ" : "CPF"}>
              <Input
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(tipoPessoa === "pj" ? maskCnpj(e.target.value) : maskCpf(e.target.value))}
                placeholder={tipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                inputMode="numeric"
              />
            </Row>

            {tipoPessoa === "pj" && (
              <Row label="Razão social">
                <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex: Padaria do João LTDA" />
              </Row>
            )}

            <Row label={tipoPessoa === "pj" ? "Nome fantasia" : "Nome do negócio"}>
              <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} placeholder="Ex: Padaria do João" />
            </Row>

            <div className="grid sm:grid-cols-2 gap-3">
              <Row label="E-mail corporativo">
                <Input type="email" value={emailCorp} onChange={(e) => setEmailCorp(e.target.value)} />
              </Row>
              <Row label="Telefone">
                <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
              </Row>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Row label="Segmento">
                <Select value={segmento} onValueChange={setSegmento}>
                  <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Porte">
                <Select value={porte} onValueChange={setPorte}>
                  <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                  <SelectContent>
                    {PORTES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </div>

            <Row label="Site (opcional)">
              <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
            </Row>
          </>
        )}

        {stepKey === "endereco" && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Row label="CEP"><Input value={cep} onChange={(e) => setCep(maskCep(e.target.value))} placeholder="00000-000" inputMode="numeric" /></Row>
              <div className="sm:col-span-2"><Row label="Rua"><Input value={rua} onChange={(e) => setRua(e.target.value)} /></Row></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Row label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Row>
              <Row label="Complemento"><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Sala, andar…" /></Row>
              <Row label="Bairro"><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></Row>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><Row label="Cidade"><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></Row></div>
              <Row label="Estado (UF)"><Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" /></Row>
            </div>
          </>
        )}

        {stepKey === "identidade" && (
          <>
            <Row label="Cor primária da marca">
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </Row>
            <p className="text-xs text-muted-foreground">Você pode trocar isso depois em Configurações.</p>
          </>
        )}

        {stepKey === "agente" && (
          <>
            <p className="text-sm text-muted-foreground">
              Responda com suas palavras. É com isso que seu atendente vai conversar com os clientes.
            </p>
            <Row label="Como o atendente vai se chamar?">
              <Input value={agente.nome_agente} onChange={(e) => setAgente({ ...agente, nome_agente: e.target.value })} />
            </Row>
            <Row label="O que ele precisa fazer no atendimento?">
              <Textarea value={agente.papel_objetivo} onChange={(e) => setAgente({ ...agente, papel_objetivo: e.target.value })} rows={2} />
            </Row>
            <Row label="Como ele deve falar com o cliente?">
              <Textarea value={agente.estilo_comunicacao} onChange={(e) => setAgente({ ...agente, estilo_comunicacao: e.target.value })} rows={2} />
            </Row>
            <Row label="Conte sobre a sua empresa">
              <Textarea value={agente.sobre_empresa} onChange={(e) => setAgente({ ...agente, sobre_empresa: e.target.value })} rows={3} placeholder="O que faz, há quanto tempo, o que te diferencia…" />
            </Row>
            <Row label="O que você vende (com preços, se quiser)">
              <Textarea value={agente.produtos_servicos} onChange={(e) => setAgente({ ...agente, produtos_servicos: e.target.value })} rows={3} placeholder="Liste os principais produtos e serviços." />
            </Row>
            <p className="text-xs text-muted-foreground">
              Depois você pode ajustar tudo isso, ou escrever você mesmo as instruções, em{" "}
              <span className="font-medium">Atendente → Editar manualmente</span>.
            </p>
          </>
        )}

        {stepKey === "acoes" && (
          <>
            <AgentActionsPanel allowedTools={allowedTools} onChangeTools={setAllowedTools} />
            <Row label="Quando ele deve chamar uma pessoa do time?">
              <Textarea value={quandoTransferir} onChange={(e) => setQuandoTransferir(e.target.value)} rows={3} />
            </Row>
            <Row label="Telefone de quem assume o atendimento (opcional)">
              <Input value={telefoneTransferencia} onChange={(e) => setTelefoneTransferencia(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
            </Row>
          </>
        )}

        {stepKey === "whatsapp" && (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte o WhatsApp que seus clientes já usam. A conexão é feita lendo um QR Code, como no WhatsApp Web.
            </p>
            <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold">Status da conexão</div>
                <div className="text-xs text-muted-foreground">
                  {waStatus === "connected" ? "Conectado — seu número já está pronto." :
                   waStatus === "connecting" ? "Aguardando a leitura do QR Code…" :
                   waStatus === "unknown" ? "Verificando…" : "Ainda não conectado."}
                </div>
              </div>
              <Button asChild variant={waStatus === "connected" ? "outline" : "default"}>
                <Link to="/app/conexao" target="_blank">
                  <ExternalLink className="size-4 mr-1.5" />
                  {waStatus === "connected" ? "Ver conexão" : "Conectar WhatsApp"}
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Abre em outra aba. Depois de ler o QR Code, volte aqui e clique em Avançar. Se preferir, pode conectar mais tarde.
            </p>
          </>
        )}

        {stepKey === "funil" && (
          <>
            <p className="text-sm text-muted-foreground">
              Estas são as etapas pelas quais cada cliente passa. Já deixamos um caminho pronto — renomeie ou adicione o que fizer sentido pro seu negócio.
            </p>
            {loadingStages ? (
              <div className="py-6 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="size-3 rounded-full shrink-0" style={{ background: s.cor }} />
                    <Input value={s.nome} onChange={(e) => renameStage(s.id, e.target.value)} />
                    <span className="text-[11px] text-muted-foreground w-16 shrink-0">
                      {s.tipo === "ganho" ? "fechou" : s.tipo === "perda" ? "não fechou" : ""}
                    </span>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addStage}>
                  <Plus className="size-4 mr-1.5" /> Adicionar etapa
                </Button>
              </div>
            )}
          </>
        )}

        {stepKey === "materiais" && (
          <>
            <p className="text-sm text-muted-foreground">
              Opcional. Guarde fotos, catálogos em PDF, tabelas de preço ou links que o atendente pode enviar aos clientes.
            </p>
            <AgentMaterialsPanel companyId={companyId} agentId={agentId} />
          </>
        )}

        {stepKey === "teste" && (
          <>
            <p className="text-sm text-muted-foreground">
              Escreva como um cliente escreveria e veja a resposta antes de liberar o atendimento.
            </p>
            <div className="flex gap-2">
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Mensagem do cliente…" />
              <Button onClick={testar} disabled={testing}>
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="rounded-xl border border-border p-4 space-y-2 min-h-[120px]">
              {testReply.length === 0 && !testing && (
                <p className="text-xs text-muted-foreground">A resposta aparece aqui.</p>
              )}
              {testing && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" />pensando…</div>}
              {testReply.map((p, i) => (
                <div key={i} className="max-w-[80%] rounded-2xl rounded-bl-md bg-primary/10 px-3.5 py-2.5 text-[13px]">{p}</div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Não gostou da resposta? Volte um passo, ajuste as informações, ou depois use{" "}
              <span className="font-medium">Atendente → Editar manualmente</span> para escrever as instruções do seu jeito.
            </p>
          </>
        )}

        {stepKey === "concluir" && (
          <div className="text-center py-6 space-y-4">
            <div className="size-16 mx-auto rounded-full bg-primary/10 grid place-items-center">
              <PartyPopper className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-display">Tudo certo, {nomeFantasia}!</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Seu atendente está configurado. Se quiser refinar depois, tudo fica em Atendente — inclusive a
              opção de escrever as instruções manualmente.
            </p>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Settings2 className="size-3.5" /> Atendente → Editar manualmente
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-border mt-2">
          <Button variant="ghost" onClick={back} disabled={step === 0 || saving}>Voltar</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Avançar
            </Button>
          ) : (
            <Button onClick={finalizar} disabled={saving} className="bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold">
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Ir pro dashboard
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
