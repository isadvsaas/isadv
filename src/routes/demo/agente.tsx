import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { brand } from "@/config/brand";
import { Bot, Loader2, Send, Sparkles, Lock, ChevronDown, Settings2 } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { buildSystemPrompt } from "@/lib/ai-prompt";

export const Route = createFileRoute("/demo/agente")({
  head: () => ({ meta: [{ title: `${brand.name} — Agente IA (demo)` }] }),
  component: AgenteDemo,
});

const DESCRICAO_DEMO = `Clínica de estética e bem-estar em Pinheiros, São Paulo. Atendemos seg a sex 9h-20h e sáb 9h-15h. Oferecemos limpeza de pele, botox, preenchimento, harmonização facial, drenagem linfática, depilação a laser e peeling. Equipe formada por dermatologista (Dra. Helena) e esteticistas. Quero que a Vivi atenda no WhatsApp: cumprimente com elegância, descubra o procedimento desejado, qualifique o lead (avaliação ou agendamento direto), confirme data/horário e mande nossa localização. Pode oferecer o desconto de 5% no Pix à vista quando fizer sentido.`;

const CFG: any = {
  nome_agente: "Vivi",
  nome_empresa: "Clínica Vitalis",
  segmento: "Estética & Bem-estar",
  regiao_horario: "Pinheiros, São Paulo — seg a sex 9h-20h, sáb 9h-15h",
  papel_objetivo: "Atender no WhatsApp, qualificar lead, agendar avaliação ou procedimento e enviar localização.",
  sobre_empresa: "Clínica em Pinheiros (SP). Equipe dermato (Dra. Helena) + esteticistas. Foco em pele, corpo e harmonização — procedimentos não invasivos.",
  produtos_servicos: "Limpeza de pele, botox, preenchimento, harmonização facial, drenagem linfática, depilação a laser, peeling, massagens relaxantes.",
  como_vender: "1) Cumprimenta com elegância. 2) Descobre o procedimento. 3) Explica como funciona e o preço. 4) Sugere avaliação grátis ou agendamento direto. 5) Confirma data/horário e manda localização.",
  pode_fazer: "Mostrar procedimentos, informar preços, agendar avaliação, oferecer 5% off Pix, mandar endereço.",
  nao_pode_fazer: "Não prescreve, não promete resultado, não atende emergência médica, não fala mal de concorrentes, não agenda fora do horário.",
  estilo_comunicacao: "Acolhedor, elegante e profissional. Emojis com moderação (💜 ✨).",
  apresentacao: "Oi! Aqui é a Vivi, da Clínica Vitalis 💜 Como posso te ajudar hoje?",
  tamanho_resposta: "curtas",
  telefone_transferencia: "+55 11 99999-0000",
  palavra_pausar: "/pausar",
  palavra_despausar: "/despausar",
  responder_em_partes: true,
  usar_emojis: true,
  tom: 70,
  formalidade: 55,
  personalidade: "amigavel",
  foco_atendimento: "ambos",
  emoji_intensidade: "moderado",
  proatividade: 65,
  velocidade_resposta: "humana",
  idioma: "pt-BR",
  chamar_por_nome: true,
  perguntar_uma_por_vez: true,
  usar_girias: false,
  pode_brincar: false,
  assinar_mensagens: false,
  evitar_palavras: "barato, milagre, garantido",
  segundos_buffer: 10,
};

const PRESETS_DEMO = [
  { value: "padrao",       label: "Padrão",       emoji: "🤝", desc: "Equilibrado — simpático e profissional." },
  { value: "extrovertido", label: "Extrovertido", emoji: "🎉", desc: "Animado, vibrante, energia." },
  { value: "serio",        label: "Sério",        emoji: "🎩", desc: "Profissional e objetivo." },
  { value: "divertido",    label: "Divertido",    emoji: "😄", desc: "Leve, bem-humorado." },
  { value: "consultivo",   label: "Consultivo",   emoji: "🧠", desc: "Especialista, recomenda com base." },
  { value: "amigavel",     label: "Amigável",     emoji: "🫶", desc: "Acolhedor e próximo." },
];

const FOCOS_DEMO = [
  { v: "vendas",  l: "🎯 Vendas",  d: "Qualifica e fecha." },
  { v: "suporte", l: "🛟 Suporte", d: "Resolve dúvidas." },
  { v: "ambos",   l: "🔀 Híbrido", d: "Atua nos dois." },
];

const BUFFER_DEMO = [
  { s: 3,  l: "Instantâneo" },
  { s: 5,  l: "Rápido" },
  { s: 10, l: "Humano" },
  { s: 20, l: "Pensativo" },
  { s: 30, l: "Calmo" },
];

const DEMO_REPLIES = [
  "Oi! Que bom te ver por aqui 💜",
  "Posso te agendar uma avaliação grátis com a Dra. Helena. Prefere manhã ou tarde?",
];

function AgenteDemo() {
  const [testMsg, setTestMsg] = useState("Oi, queria saber sobre botox.");
  const [reply, setReply] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  function runTest() {
    setTesting(true); setReply([]);
    setTimeout(() => { setReply(DEMO_REPLIES); setTesting(false); }, 700);
  }

  const prompt = buildSystemPrompt(CFG, { responderEmPartes: true, produtos: [
    { nome: "Limpeza de pele profunda", preco: 280, descricao: "Sessão de 60min com Dra. Helena." },
    { nome: "Pacote drenagem (10 sessões)", preco: 1890, descricao: "Esteticista Paula. Resultado a partir da 4ª sessão." },
    { nome: "Depilação laser axilas+virilha (8x)", preco: 2400, descricao: "Diodo de alta potência. Parcela em 12x." },
  ]});

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <HelpTip text="Personalidade e instruções do agente IA: como ele se apresenta, o que vende, horário, tom de voz e regras de negócio." />
            <Bot className="size-5 text-[var(--brand-text)]" /> {CFG.nome_agente}
          </h1>
          <p className="text-sm text-muted-foreground">{CFG.papel_objetivo}</p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-1">
            <Lock className="size-3" /> Configuração de exemplo — somente leitura.
          </p>
        </div>
        <Button disabled title="Indisponível no demo">Salvar</Button>
      </header>

      <Collapsible>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted transition">
            <span className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Descrição enviada para a IA
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 border-t border-border text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {DESCRICAO_DEMO}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="grid lg:grid-cols-[1fr_minmax(340px,400px)] gap-6">
        <div className="space-y-4">
          <Section title="O que a IA aprendeu" icon={<Sparkles className="size-3.5" />}>
            <SummaryRow label="Empresa" value={CFG.nome_empresa} />
            <SummaryRow label="Segmento" value={CFG.segmento} />
            <SummaryRow label="Região / horário" value={CFG.regiao_horario} />
            <SummaryRow label="Sobre" value={CFG.sobre_empresa} multiline />
            <SummaryRow label="Produtos / serviços" value={CFG.produtos_servicos} multiline />
            <SummaryRow label="Como vende" value={CFG.como_vender} multiline />
            <SummaryRow label="Pode fazer" value={CFG.pode_fazer} multiline />
            <SummaryRow label="Não pode fazer" value={CFG.nao_pode_fazer} multiline />
          </Section>

          <Section title="Personalidade do agente" icon={<Sparkles className="size-3.5" />}>
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Preset</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {PRESETS_DEMO.map((p) => (
                  <div
                    key={p.value}
                    className={`text-left rounded-xl border p-3 ${CFG.personalidade === p.value ? "border-[var(--brand)] bg-[var(--brand)]/10" : "border-border bg-muted/40 opacity-70"}`}
                  >
                    <div className="text-lg">{p.emoji}</div>
                    <div className="font-semibold text-sm mt-1">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Foco do atendimento</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {FOCOS_DEMO.map((o) => (
                  <div
                    key={o.v}
                    className={`text-left rounded-xl border p-3 ${CFG.foco_atendimento === o.v ? "border-[var(--brand)] bg-[var(--brand)]/10" : "border-border bg-muted/40 opacity-70"}`}
                  >
                    <div className="font-semibold text-sm">{o.l}</div>
                    <div className="text-[11px] text-muted-foreground">{o.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <SummaryRow label="Tom (0=sério → 100=caloroso)" value={String(CFG.tom)} />
              <SummaryRow label="Formalidade" value={String(CFG.formalidade)} />
              <SummaryRow label="Proatividade" value={String(CFG.proatividade)} />
              <SummaryRow label="Tamanho" value={CFG.tamanho_resposta} />
              <SummaryRow label="Emojis" value={CFG.emoji_intensidade} />
              <SummaryRow label="Velocidade" value={CFG.velocidade_resposta} />
              <SummaryRow label="Idioma" value={CFG.idioma} />
              <SummaryRow label="Palavras proibidas" value={CFG.evitar_palavras} />
            </div>

            <div className="grid sm:grid-cols-2 gap-2 pt-2">
              {[
                ["Responder em partes", CFG.responder_em_partes],
                ["Chamar pelo nome", CFG.chamar_por_nome],
                ["Uma pergunta por vez", CFG.perguntar_uma_por_vez],
                ["Usar gírias", CFG.usar_girias],
                ["Pode brincar", CFG.pode_brincar],
                ["Assinar mensagens", CFG.assinar_mensagens],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
                  <span className="text-xs font-medium">{l}</span>
                  <Switch checked={!!v} disabled />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tempo de espera (entender contexto)" icon={<Sparkles className="size-3.5" />}>
            <p className="text-xs text-muted-foreground">
              A IA aguarda esse tempo antes de responder. Se o cliente mandar várias mensagens em sequência, ela junta tudo e responde de uma vez — entendendo o contexto completo, como uma pessoa real.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {BUFFER_DEMO.map((o) => (
                <div
                  key={o.s}
                  className={`rounded-xl border p-3 text-center ${CFG.segundos_buffer === o.s ? "border-[var(--brand)] bg-[var(--brand)]/10" : "border-border bg-muted/40 opacity-70"}`}
                >
                  <div className="font-display text-lg font-semibold">{o.s}s</div>
                  <div className="text-[11px] text-muted-foreground">{o.l}</div>
                </div>
              ))}
            </div>
          </Section>

          <Collapsible>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted transition">
                <span className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
                  <Settings2 className="size-3.5" /> Ajustes finos
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                <div className="space-y-1.5">
                  <Label>Tom das respostas</Label>
                  <Select value={CFG.tamanho_resposta} disabled>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curtas">Curtas (estilo WhatsApp)</SelectItem>
                      <SelectItem value="medias">Médias</SelectItem>
                      <SelectItem value="longas">Longas (explicativas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone para transferir atendimento</Label>
                  <Input readOnly value={CFG.telefone_transferencia} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Palavra para pausar IA</Label>
                    <Input readOnly value={CFG.palavra_pausar} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Palavra para despausar</Label>
                    <Input readOnly value={CFG.palavra_despausar} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                  <span className="text-sm font-medium">Responder em partes (1-3 bolhas)</span>
                  <Switch checked={CFG.responder_em_partes} disabled />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <Section title="Testar resposta" icon={<Sparkles className="size-3.5" />}>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 min-h-[160px]">
              <div className="flex justify-end">
                <div className="max-w-[78%] bg-muted rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px]">{testMsg}</div>
              </div>
              {reply.map((p, i) => (
                <div key={i} className="flex justify-start gap-2 items-end">
                  <InitialsAvatar name="IA" size={24} forceGradient="linear-gradient(135deg,#A78BFA,#7C3AED)" />
                  <div className="max-w-[78%] bg-gradient-to-br from-[#6D28D9] to-[#7C3AED] text-primary-foreground rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] font-medium">
                    <span className="block text-[9.5px] font-bold opacity-80 mb-1 uppercase tracking-wider">⚡ Vivi · IA</span>
                    {p}
                  </div>
                </div>
              ))}
              {testing && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" />pensando…</div>}
            </div>
            <div className="flex gap-2 mt-3">
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Mensagem do cliente…" />
              <Button onClick={runTest} disabled={testing} size="icon">
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </Section>

          <Collapsible>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted transition">
                <span className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
                  <Bot className="size-3.5" /> Ver prompt gerado
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap max-h-[360px] overflow-auto p-4 border-t border-border">
{prompt}
                </pre>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      {title && (
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
          {icon}{title}
        </h3>
      )}
      {children}
    </div>
  );
}

function SummaryRow({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="space-y-1">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}>{value}</div>
    </div>
  );
}
