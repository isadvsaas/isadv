import { createFileRoute } from "@tanstack/react-router";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Smartphone, RefreshCw, Lock, QrCode } from "lucide-react";

export const Route = createFileRoute("/demo/conexao")({
  head: () => ({ meta: [{ title: `${brand.name} — Conexão (demo)` }] }),
  component: ConexaoDemo,
});

function ConexaoDemo() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">Conexão WhatsApp <HelpTip text="Pareamento via QR Code, igual WhatsApp Web. Sem precisar mudar de número nem usar API oficial." /></h1>
        <p className="text-xs text-muted-foreground">Status da linha conectada — exemplo.</p>
      </header>

      <div className="grid md:grid-cols-[1fr_auto] gap-5">
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-[var(--brand)]/20 text-[var(--brand-text)] grid place-items-center">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Conectado</div>
              <div className="text-xs text-muted-foreground">A IA está respondendo automaticamente.</div>
            </div>
            <span className="ml-auto text-[11px] font-bold px-2 py-1 rounded-full bg-[var(--brand)]/20 text-[var(--brand-text)]">ONLINE</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Info label="Número" value="+55 11 99999-0000" />
            <Info label="Instância" value="clinica-vitalis" />
            <Info label="Última atividade" value="agora mesmo" />
            <Info label="Sessão iniciada em" value="15/06/2026 às 09:12" />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" disabled><RefreshCw className="size-4 mr-1.5" />Reiniciar</Button>
            <Button variant="outline" disabled>Desconectar</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-3">
          <div className="size-44 rounded-2xl bg-muted grid place-items-center border-2 border-dashed border-border">
            <QrCode className="size-20 text-muted-foreground/50" />
          </div>
          <div className="text-[12px] text-muted-foreground text-center max-w-[200px]">
            QR Code aparece aqui ao conectar uma nova linha.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-[13px] font-semibold mb-3 flex items-center gap-2"><Smartphone className="size-4 text-[var(--brand-text)]" />Como funciona</h3>
        <ol className="text-[13px] text-muted-foreground space-y-2 list-decimal pl-5">
          <li>Você escaneia o QR Code com o WhatsApp do celular.</li>
          <li>Mensagens recebidas viram conversas no inbox automaticamente.</li>
          <li>O agente IA responde com o tom e regras configurados.</li>
          <li>Você pode "Assumir" qualquer conversa quando quiser.</li>
        </ol>
      </div>

      <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Lock className="size-3" /> Demonstração — somente leitura.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[13.5px] font-semibold mt-0.5">{value}</div>
    </div>
  );
}
