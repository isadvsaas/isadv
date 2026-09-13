import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, RefreshCw, Power, QrCode, Instagram, Copy, Check, MessageCircle, Settings2, Webhook } from "lucide-react";
import { brand } from "@/config/brand";
import { connectWhatsapp, checkWhatsappStatus, disconnectWhatsapp } from "@/lib/evolution.functions";
import { connectInstagram, disconnectInstagram, getInstagramStatus } from "@/lib/instagram.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { PlanUsageBadge } from "@/components/plan-usage-badge";

export const Route = createFileRoute("/app/conexao")({
  head: () => ({ meta: [{ title: `${brand.name} — Canais` }] }),
  component: ConexaoPage,
});

type Tone = "ok" | "neutro" | "atencao";

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : tone === "atencao"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : "bg-[color:var(--panel-2)] text-muted-foreground border-[color:var(--hairline)]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${cls}`}>
      <span className={`size-1.5 rounded-full ${tone === "ok" ? "bg-emerald-500" : tone === "atencao" ? "bg-amber-500" : "bg-muted-foreground/50"}`} />
      {children}
    </span>
  );
}

function ConexaoPage() {
  const plan = usePlanFeatures();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Canais <HelpTip text="Conecte o WhatsApp e o Instagram Direct. O mesmo atendente de IA responde os dois canais." />
        </h1>
        <p className="text-sm text-muted-foreground">Conecte os canais onde seus clientes falam com você.</p>
      </header>

      {!plan.loading && (
        <div>
          <PlanUsageBadge label="WhatsApps" used={plan.usage.instancias} limit={plan.limites.instancias} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <WhatsappCard />
        <InstagramCard />
      </div>

      <Accordion type="single" collapsible className="rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--panel)] px-4">
        <AccordionItem value="avancado" className="border-0">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-2"><Settings2 className="size-4" /> Avançado</span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground mb-3">
              Recursos técnicos: webhooks de saída, API pública e links de rastreio (UTM).
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/integracoes"><Webhook className="size-4 mr-1.5" /> Abrir integrações técnicas</Link>
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function WhatsappCard() {
  const connect = useServerFn(connectWhatsapp);
  const check = useServerFn(checkWhatsappStatus);
  const disconnect = useServerFn(disconnectWhatsapp);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [numero, setNumero] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void doCheck(true);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { void doCheck(true); }, 5000);
  }
  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function doCheck(silent = false) {
    setChecking(true);
    try {
      const r: any = await check();
      setErro(null);
      setStatus(r.status);
      setNumero(r.numero ?? null);
      if (r.qrBase64 && r.status !== "connected") {
        setQr(r.qrBase64);
        if (!pollRef.current) startPolling();
      }
      if (r.status === "connected") { setQr(null); stopPolling(); if (!silent) toast.success("WhatsApp conectado!"); }
    } catch (e: any) {
      setErro("Não foi possível carregar esta informação.");
      if (!silent) toast.error(e?.message || "Erro ao consultar status");
    } finally { setChecking(false); }
  }

  async function doConnect() {
    setLoading(true); setQr(null);
    try {
      const r = await connect();
      setQr(r.qrBase64 ?? null);
      setStatus(r.state === "open" ? "connected" : "connecting");
      if (r.state === "open") toast.success("Já está conectado!");
      else if (r.qrBase64) { toast.message("QR Code gerado. Escaneie no WhatsApp."); startPolling(); }
      else { toast.message("Preparando conexão. Buscando QR…"); startPolling(); }
    } catch (e: any) { toast.error(e?.message || "Falha ao conectar"); }
    finally { setLoading(false); }
  }

  async function doDisconnect() {
    setLoading(true);
    try {
      await disconnect();
      setStatus("disconnected"); setNumero(null); setQr(null); stopPolling();
      toast.success("WhatsApp desconectado");
    } catch (e: any) { toast.error(e?.message || "Falha ao desconectar"); }
    finally { setLoading(false); }
  }

  const conectado = status === "connected";
  const conectando = status === "connecting" || !!qr;
  const tone: Tone = conectado ? "ok" : conectando ? "atencao" : "neutro";
  const statusLabel = conectado ? "Conectado" : conectando ? "Conectando" : "Não conectado";

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-xl bg-emerald-500/15 grid place-items-center shrink-0">
          <MessageCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base">WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Receba e responda clientes pelo WhatsApp.</p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={tone}>{statusLabel}</StatusPill>
            {conectado && numero && <span className="text-sm text-muted-foreground font-mono">{numero}</span>}
          </div>
        </div>
      </div>

      {erro ? (
        <div className="rounded-xl border border-[color:var(--hairline)] p-4 text-sm space-y-3">
          <p className="text-muted-foreground">{erro}</p>
          <Button size="sm" variant="outline" onClick={() => void doCheck()}>
            <RefreshCw className="size-4 mr-1.5" /> Tentar novamente
          </Button>
        </div>
      ) : qr ? (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-border w-fit mx-auto">
            <img src={qr} alt="QR Code do WhatsApp" className="size-60 sm:size-64 object-contain" />
          </div>
          <div className="text-sm space-y-2">
            <h3 className="font-semibold">Como conectar</h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Abra o WhatsApp no celular.</li>
              <li>Toque em <b>Aparelhos conectados</b>.</li>
              <li>Toque em <b>Conectar um aparelho</b>.</li>
              <li>Aponte a câmera para esta tela.</li>
            </ol>
          </div>
        </div>
      ) : conectado ? (
        <p className="text-sm text-muted-foreground">Tudo certo! As mensagens já são respondidas automaticamente.</p>
      ) : checking ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Verificando…</p>
      ) : (
        <p className="text-sm text-muted-foreground">Seu WhatsApp ainda não está conectado.</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {conectado ? (
          <>
            <Button variant="outline" onClick={() => void doCheck()} disabled={loading} className="flex-1 sm:flex-none">
              <RefreshCw className="size-4 mr-1.5" /> Gerenciar
            </Button>
            <Button variant="destructive" onClick={() => void doDisconnect()} disabled={loading} className="flex-1 sm:flex-none">
              <Power className="size-4 mr-1.5" /> Desconectar
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => void doConnect()} disabled={loading} className="flex-1 sm:flex-none">
              {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <QrCode className="size-4 mr-1.5" />}
              {qr ? "Gerar novo QR Code" : conectando ? "Reconectar" : "Conectar WhatsApp"}
            </Button>
            <Button variant="outline" onClick={() => void doCheck()} disabled={loading} className="flex-1 sm:flex-none">
              <RefreshCw className="size-4 mr-1.5" /> Atualizar
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function InstagramCard() {
  const statusFn = useServerFn(getInstagramStatus);
  const connectFn = useServerFn(connectInstagram);
  const disconnectFn = useServerFn(disconnectInstagram);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [abrirConfig, setAbrirConfig] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setChecking(true);
    try { setInfo(await statusFn()); setErro(null); }
    catch { setErro("Não foi possível carregar esta informação."); }
    finally { setChecking(false); }
  }

  async function doConnect() {
    setLoading(true);
    try {
      await connectFn({ data: { token: token.trim() } });
      setToken("");
      setAbrirConfig(false);
      toast.success("Instagram conectado!");
      await refresh();
    } catch (e: any) { toast.error(e?.message || "Falha ao conectar o Instagram"); }
    finally { setLoading(false); }
  }

  async function doDisconnect() {
    setLoading(true);
    try { await disconnectFn(); toast.success("Instagram desconectado"); await refresh(); }
    catch (e: any) { toast.error(e?.message || "Falha ao desconectar"); }
    finally { setLoading(false); }
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const conectado = !!info?.conectado;
  const precisaReconectar = !conectado && !!info?.ultimoErro;
  const tone: Tone = conectado ? "ok" : precisaReconectar ? "atencao" : "neutro";
  const statusLabel = conectado ? "Conectado" : precisaReconectar ? "Precisa reconectar" : "Não conectado";

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-xl bg-[#C13584]/15 grid place-items-center shrink-0">
          <Instagram className="size-5 text-[#C13584]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base">Instagram</h2>
          <p className="text-sm text-muted-foreground">Receba mensagens do Instagram Direct no mesmo atendimento.</p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={tone}>{statusLabel}</StatusPill>
            {conectado && info?.username && <span className="text-sm text-muted-foreground">@{info.username}</span>}
          </div>
        </div>
      </div>

      {erro ? (
        <div className="rounded-xl border border-[color:var(--hairline)] p-4 text-sm space-y-3">
          <p className="text-muted-foreground">{erro}</p>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4 mr-1.5" /> Tentar novamente
          </Button>
        </div>
      ) : conectado ? (
        <p className="text-sm text-muted-foreground">
          Tudo certo! Os Directs entram na mesma caixa de entrada e são respondidos pelo atendente.
        </p>
      ) : checking ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Verificando…</p>
      ) : (
        <p className="text-sm text-muted-foreground">Conecte seu Instagram profissional para receber Directs aqui.</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {conectado ? (
          <>
            <Button variant="outline" onClick={() => setAbrirConfig((v) => !v)} disabled={loading} className="flex-1 sm:flex-none">
              <Settings2 className="size-4 mr-1.5" /> Gerenciar
            </Button>
            <Button variant="destructive" onClick={() => void doDisconnect()} disabled={loading} className="flex-1 sm:flex-none">
              <Power className="size-4 mr-1.5" /> Desconectar
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setAbrirConfig(true)} disabled={loading} className="flex-1 sm:flex-none">
              <Instagram className="size-4 mr-1.5" />
              {precisaReconectar ? "Reconectar" : "Conectar Instagram"}
            </Button>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="flex-1 sm:flex-none">
              <RefreshCw className="size-4 mr-1.5" /> Atualizar
            </Button>
          </>
        )}
      </div>

      {abrirConfig && (
        <div className="rounded-xl border border-[color:var(--hairline)] p-4 space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Código de acesso do Instagram profissional</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole aqui o código" type="password" />
              <Button onClick={() => void doConnect()} disabled={loading || token.trim().length < 40} className="sm:w-auto">
                {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Instagram className="size-4 mr-1.5" />}
                Salvar e conectar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use o código gerado na Página do Facebook ligada à sua conta profissional do Instagram, com permissão de mensagens.
            </p>
          </div>

          {(info?.webhookUrl || info?.verifyToken) && (
            <div className="rounded-lg bg-[color:var(--panel-2)] p-3 space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Dados técnicos para o Meta</h3>
              {info?.webhookUrl && (
                <div className="flex items-center gap-2">
                  <code className="text-xs break-all flex-1">{info.webhookUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy("url", info.webhookUrl)}>
                    {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              )}
              {info?.verifyToken && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Código de verificação:</span>
                  <code className="text-xs flex-1">••••••••</code>
                  <Button size="sm" variant="ghost" onClick={() => copy("token", info.verifyToken)}>
                    {copied === "token" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Assine o campo <b>messages</b> do produto Instagram.</p>
            </div>
          )}

          {info?.ultimoErro && <p className="text-xs text-destructive">{info.ultimoErro}</p>}
        </div>
      )}
    </Card>
  );
}
