import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Lock } from "lucide-react";
import { demoMensagens, type DemoCard } from "@/lib/demo-data";

export function DemoLeadDrawer({ card, onClose }: { card: DemoCard | null; onClose: () => void }) {
  if (!card) return null;
  const thread = demoMensagens.filter((m) => m.numero === card.numero);
  return (
    <Sheet open={!!card} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-card border-l border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={card.nome} size={48} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{card.nome}</SheetTitle>
              <div className="text-xs text-muted-foreground font-mono">{card.numero}</div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5"><Lock className="size-3" /> Modo demonstração — somente leitura</div>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="conversa">Conversa</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="hist">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3 mt-4">
            <RO label="Nome" value={card.nome} />
            <div className="grid grid-cols-2 gap-3">
              <RO label="Valor (R$)" value={card.valor != null ? String(card.valor) : "—"} />
              <RO label="Etapa" value={card.status} />
            </div>
            <RO label="Origem" value="WhatsApp" />
            <RO label="Tags" value="whatsapp, demo" />
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea readOnly value={card.observacao ?? "—"} rows={3} />
            </div>
          </TabsContent>

          <TabsContent value="conversa" className="mt-4">
            <div className="space-y-2 max-h-[60vh] overflow-y-auto p-2">
              {thread.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem mensagens.</div>}
              {thread.map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "saida" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direcao === "saida" ? "bg-[var(--brand)]/15 text-foreground" : "bg-muted"}`}>
                    <div className="text-[10px] uppercase opacity-60 mb-0.5">{m.autor}</div>
                    {m.texto}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notas" className="mt-4">
            <ul className="space-y-2">
              <li className="rounded-xl border border-border bg-muted p-3 text-sm">
                <div className="text-[11px] text-muted-foreground mb-1">há 2 dias</div>
                Cliente recorrente, prefere entrega pela manhã.
              </li>
              <li className="rounded-xl border border-border bg-muted p-3 text-sm">
                <div className="text-[11px] text-muted-foreground mb-1">há 5 dias</div>
                Já comprou cesta de café da manhã — ticket R$ 180.
              </li>
            </ul>
          </TabsContent>

          <TabsContent value="hist" className="mt-4">
            <ul className="space-y-2">
              <li className="rounded-xl border border-border bg-muted p-3 text-sm">
                <div className="text-[11px] text-muted-foreground mb-1">há 10 min</div>
                <b className="text-[var(--brand-text)]">atualizacao</b> — Lead movido para "{card.status}"
              </li>
              <li className="rounded-xl border border-border bg-muted p-3 text-sm">
                <div className="text-[11px] text-muted-foreground mb-1">há 1 dia</div>
                <b className="text-[var(--brand-text)]">criacao</b> — Lead criado via WhatsApp
              </li>
            </ul>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function RO({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input readOnly value={value} /></div>;
}
