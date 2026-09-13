import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Palette, CreditCard, Smartphone, CheckCircle2, Lock, MessageSquareQuote, Clock, Shield, Download, Bell } from "lucide-react";
import { demoTemplates, demoHorarios, demoMsgForaHorario, demoAuditLog } from "@/lib/demo-data";

export const Route = createFileRoute("/demo/configuracoes")({
  head: () => ({ meta: [{ title: `${brand.name} — Configurações (demo)` }] }),
  component: ConfigDemo,
});

function ConfigDemo() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">Configurações <HelpTip text="Templates de mensagem, horário de atendimento, segurança da conta, log de auditoria e exportação de dados (LGPD)." /></h1>
        <p className="text-xs text-muted-foreground">Empresa, identidade, templates, horários e segurança — exemplo.</p>
      </header>

      <Tabs defaultValue="empresa">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="identidade">Identidade</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card title="Empresa" icon={<Building2 className="size-4" />}>
            <RO label="Nome da empresa" value="Clínica Vitalis" />
            <RO label="CNPJ" value="12.345.678/0001-00" />
            <div className="space-y-1.5"><Label>Endereço</Label><Textarea readOnly rows={2} value="Rua dos Pinheiros, 1500 — Pinheiros — São Paulo/SP" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <RO label="Telefone" value="+55 11 99999-0000" />
              <RO label="E-mail" value="contato@clinicavitalis.com.br" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="identidade">
          <Card title="Identidade visual" icon={<Palette className="size-4" />}>
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl grid place-items-center text-primary-foreground font-display font-extrabold text-2xl" style={{ background: "linear-gradient(135deg,#A78BFA,#7C3AED)" }}>V</div>
              <div className="text-sm">
                <div className="font-semibold">Logo da empresa</div>
                <div className="text-xs text-muted-foreground">PNG ou JPG até 2MB</div>
              </div>
              <Button variant="outline" size="sm" disabled className="ml-auto">Trocar</Button>
            </div>
            <div className="space-y-1.5">
              <Label>Cor primária</Label>
              <div className="flex gap-2 items-center">
                <span className="size-10 rounded-xl ring-1 ring-border" style={{ background: "#7C3AED" }} />
                <Input readOnly value="#7C3AED" className="font-mono" />
              </div>
            </div>
            <RO label="Slug público" value="clinica-vitalis" />
          </Card>
        </TabsContent>

        <TabsContent value="plano">
          <Card title="Plano e cobrança" icon={<CreditCard className="size-4" />}>
            <div className="rounded-xl border border-[var(--brand-soft-strong)] bg-[var(--brand-soft)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--brand-text)] font-bold">Plano atual</div>
                  <div className="font-display font-extrabold text-xl mt-0.5">Business · R$ 397/mês</div>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-[var(--brand)]/20 text-[var(--brand-text)] inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3" />Ativo
                </span>
              </div>
              <ul className="mt-3 text-[12.5px] text-muted-foreground space-y-1">
                <li>• Conversas ilimitadas</li>
                <li>• Até 10 atendentes</li>
                <li>• Google Agenda + Calendar sync</li>
                <li>• API pública + Webhooks de saída</li>
                <li>• Suporte prioritário</li>
              </ul>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <RO label="Próxima cobrança" value="15/07/2026" />
              <RO label="Método" value="Cartão final 4242" />
            </div>
            <Button variant="outline" disabled className="w-full">Gerenciar assinatura</Button>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
              <MessageSquareQuote className="size-4" /> Templates rápidos
            </h3>
            <p className="text-xs text-muted-foreground">
              Digite o atalho na tela de Conversas para inserir o texto automaticamente.
            </p>
            <div className="divide-y divide-border">
              {demoTemplates.map((t) => (
                <div key={t.id} className="py-3 flex gap-3">
                  <code className="font-mono text-[12px] px-2 py-1 rounded-md bg-muted text-[var(--brand-text)] font-bold h-fit shrink-0">{t.atalho}</code>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[13.5px]">{t.titulo}</div>
                    <p className="text-[12.5px] text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.conteudo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="horarios">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
              <h3 className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
                <Clock className="size-4" /> Horário de atendimento
              </h3>
              <p className="text-xs text-muted-foreground">Fora desses horários, a IA envia a mensagem automática abaixo.</p>
              <div className="divide-y divide-border">
                {demoHorarios.map((h) => (
                  <div key={h.dia} className="py-2.5 flex items-center gap-3">
                    <Switch checked={h.ativo} disabled />
                    <div className="font-medium text-sm w-24">{h.dia}</div>
                    {h.ativo ? (
                      <div className="text-[13px] text-muted-foreground">{h.abre} — {h.fecha}</div>
                    ) : (
                      <div className="text-[12.5px] text-muted-foreground italic">Fechado</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <Label>Mensagem fora do horário</Label>
              <Textarea readOnly rows={3} value={demoMsgForaHorario} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="conexao">
          <Card title="Conexão WhatsApp" icon={<Smartphone className="size-4" />}>
            <div className="rounded-xl border border-border bg-muted p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-[var(--brand)]/20 text-[var(--brand-text)] grid place-items-center">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Conectado</div>
                <div className="text-[11px] text-muted-foreground font-mono">+55 11 99999-0000</div>
              </div>
              <Button variant="outline" size="sm" disabled>Desconectar</Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
              <div>
                <div className="text-sm font-semibold">Receber notificações</div>
                <div className="text-[11px] text-muted-foreground">E-mail quando a IA escalar para humano</div>
              </div>
              <Switch checked disabled />
            </div>
            <RO label="Webhook URL" value="https://atendezap.live/api/public/whatsapp-webhook" />
          </Card>
        </TabsContent>

        <TabsContent value="seguranca">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold flex items-center gap-2"><Bell className="size-4" /> Notificações do navegador</div>
                <p className="text-xs text-muted-foreground">Avisos de novas mensagens enquanto você está em outra aba.</p>
              </div>
              <Badge className="bg-[rgba(37,211,102,.15)] text-[#9af0bd] border-none">Ativadas</Badge>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold flex items-center gap-2"><Download className="size-4" /> Exportação LGPD</div>
                <p className="text-xs text-muted-foreground">Baixe um JSON com todos os dados da clínica armazenados aqui.</p>
              </div>
              <Button disabled><Download className="size-4 mr-1.5" />Exportar</Button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div>
                <div className="font-semibold flex items-center gap-2"><Shield className="size-4" /> Log de auditoria</div>
                <p className="text-xs text-muted-foreground">Últimas ações registradas.</p>
              </div>
              <div className="border border-border rounded-xl divide-y divide-border max-h-80 overflow-auto">
                {demoAuditLog.map((r) => (
                  <div key={r.id} className="p-3 text-sm flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.acao}{r.recurso ? ` · ${r.recurso}` : ""}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.actor}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {r.quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="size-3" /> Demonstração — somente leitura.
      </p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 max-w-2xl">
      <h3 className="font-display text-[12px] font-semibold uppercase tracking-wider text-[var(--brand-text)] flex items-center gap-1.5">
        {icon}{title}
      </h3>
      {children}
    </div>
  );
}

function RO({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input readOnly value={value} /></div>;
}
