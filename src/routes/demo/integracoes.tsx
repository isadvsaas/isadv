import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Webhook, KeyRound, Link2, Lock, Plus, Copy, Check } from "lucide-react";
import { demoWebhooks, demoTokens } from "@/lib/demo-data";
import { useState } from "react";

export const Route = createFileRoute("/demo/integracoes")({
  head: () => ({ meta: [{ title: `${brand.name} — Integrações (demo)` }] }),
  component: IntegracoesDemo,
});

function IntegracoesDemo() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Plug className="size-5 text-[var(--brand-text)]" /> Integrações <HelpTip text="Webhooks de saída para o seu sistema, API pública REST e parâmetros UTM para rastrear origem dos leads (campanhas, anúncios, etc)." />
        </h1>
        <p className="text-xs text-muted-foreground">Webhooks, API pública e tracking de UTM — exemplo.</p>
      </header>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks"><Webhook className="size-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="api"><KeyRound className="size-3.5 mr-1.5" />API</TabsTrigger>
          <TabsTrigger value="utm"><Link2 className="size-3.5 mr-1.5" />UTM</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-end">
            <Button disabled size="sm"><Plus className="size-4 mr-1.5" />Novo webhook</Button>
          </div>
          <div className="space-y-3">
            {demoWebhooks.map((w) => (
              <div key={w.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-[12.5px] font-mono break-all flex-1 min-w-0">{w.url}</code>
                  <Badge className={w.ativo ? "bg-[rgba(37,211,102,.15)] text-[#9af0bd] border-none" : "bg-muted text-muted-foreground border-none"}>
                    {w.ativo ? "Ativo" : "Pausado"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {w.eventos.map((e) => (
                    <span key={e} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{e}</span>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Último disparo: {w.ultimo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground">
            Os disparos são assinados com <code className="font-mono">X-AtendeZap-Signature: sha256={"{hash}"}</code> usando seu segredo.
            Verifique antes de processar.
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="flex justify-end">
            <Button disabled size="sm"><Plus className="size-4 mr-1.5" />Gerar token</Button>
          </div>
          <div className="space-y-3">
            {demoTokens.map((t) => (
              <TokenRow key={t.id} t={t} />
            ))}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-[12.5px] space-y-1.5">
            <div className="font-semibold">Endpoints v1</div>
            <code className="block font-mono text-[11.5px] text-muted-foreground">GET  /api/public/v1/contacts</code>
            <code className="block font-mono text-[11.5px] text-muted-foreground">POST /api/public/v1/contacts</code>
            <code className="block font-mono text-[11.5px] text-muted-foreground">GET  /api/public/v1/messages?numero=...</code>
            <code className="block font-mono text-[11.5px] text-muted-foreground">POST /api/public/v1/messages</code>
            <div className="text-[11px] text-muted-foreground mt-2">Autenticação: <code className="font-mono">Authorization: Bearer azp_live_...</code></div>
          </div>
        </TabsContent>

        <TabsContent value="utm" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-display font-bold text-[14px]">Gerador de link com UTM</h3>
            <p className="text-[12.5px] text-muted-foreground">
              Encurte qualquer link para WhatsApp e o atendente fica taggeado automaticamente no CRM.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Source" value="instagram" />
              <Field label="Medium" value="bio" />
              <Field label="Campaign" value="botox-junho" />
            </div>
            <div className="rounded-xl border border-[var(--brand-soft-strong)] bg-[var(--brand-soft)] p-3 font-mono text-[12px] break-all">
              https://wa.me/5511999990000?text=Oi%21%20Vim%20pelo%20Insta%20[utm:instagram/bio/botox-junho]
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display font-bold text-[14px] mb-2">Últimas atribuições</h3>
            <ul className="text-[13px] divide-y divide-border">
              <li className="py-2 flex justify-between"><span>Mariana Costa</span><span className="text-muted-foreground font-mono text-[11.5px]">instagram · bio · botox-junho</span></li>
              <li className="py-2 flex justify-between"><span>Beatriz Souza</span><span className="text-muted-foreground font-mono text-[11.5px]">google · ads · laser-promo</span></li>
              <li className="py-2 flex justify-between"><span>Letícia Moreira</span><span className="text-muted-foreground font-mono text-[11.5px]">tiktok · bio · harmonizacao</span></li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="size-3" /> Demonstração — somente leitura.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <Input readOnly value={value} className="font-mono text-[13px]" />
    </div>
  );
}

function TokenRow({ t }: { t: { id: string; nome: string; prefixo: string; criado: Date; ultimoUso?: Date } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[13.5px]">{t.nome}</div>
        <code className="font-mono text-[12px] text-muted-foreground">{t.prefixo}</code>
      </div>
      <div className="text-[11px] text-muted-foreground text-right">
        <div>Criado {t.criado.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}</div>
        {t.ultimoUso && <div>Usado {t.ultimoUso.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</div>}
      </div>
      <Button size="icon" variant="outline" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
        {copied ? <Check className="size-4 text-[var(--brand)]" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
