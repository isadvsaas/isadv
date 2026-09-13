import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export type LancamentoForm = {
  id?: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor_reais: string;
  categoria_id?: string | null;
  forma_pagamento?: string | null;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  vencimento: string;
  pago_em?: string | null;
  competencia?: string;
  observacao?: string | null;
};

export function LancamentoDrawer({
  open, onOpenChange, initial, categorias, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<LancamentoForm> & { tipo: "receita" | "despesa" };
  categorias: Array<{ id: string; nome: string; tipo: string }>;
  onSave: (f: LancamentoForm) => Promise<void>;
  saving?: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<LancamentoForm>({
    tipo: "receita",
    descricao: "",
    valor_reais: "",
    status: "pendente",
    vencimento: hoje,
    competencia: hoje,
  });

  useEffect(() => {
    if (open) {
      setF({
        tipo: initial?.tipo ?? "receita",
        descricao: initial?.descricao ?? "",
        valor_reais: initial?.valor_reais ?? "",
        categoria_id: initial?.categoria_id ?? null,
        forma_pagamento: initial?.forma_pagamento ?? null,
        status: initial?.status ?? "pendente",
        vencimento: initial?.vencimento ?? hoje,
        pago_em: initial?.pago_em ?? null,
        competencia: initial?.competencia ?? hoje,
        observacao: initial?.observacao ?? "",
        id: initial?.id,
      });
    }
  }, [open]);

  const catsDoTipo = categorias.filter((c) => c.tipo === f.tipo);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{f.id ? "Editar lançamento" : f.tipo === "receita" ? "Nova receita" : "Nova despesa"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          {!f.id && (
            <div>
              <Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v as any, categoria_id: null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita (entrada)</SelectItem>
                  <SelectItem value="despesa">Despesa (saída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Descrição</Label>
            <Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex: Venda do plano anual" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={f.valor_reais} onChange={(e) => setF({ ...f, valor_reais: e.target.value.replace(",", ".") })} placeholder="0,00" />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={f.categoria_id ?? "none"} onValueChange={(v) => setF({ ...f, categoria_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem categoria —</SelectItem>
                  {catsDoTipo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagto</Label>
              <Select value={f.forma_pagamento ?? "none"} onValueChange={(v) => setF({ ...f, forma_pagamento: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as any, pago_em: v === "pago" ? (f.pago_em || hoje) : null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {f.status === "pago" && (
              <div>
                <Label>Pago em</Label>
                <Input type="date" value={f.pago_em ?? hoje} onChange={(e) => setF({ ...f, pago_em: e.target.value })} />
              </div>
            )}
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={3} value={f.observacao ?? ""} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave(f)} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
