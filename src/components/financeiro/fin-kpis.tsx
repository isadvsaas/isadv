import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Wallet, TrendingUp, TrendingDown } from "lucide-react";

export function fmtBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

export function FinKpiGrid({
  receita, despesa, saldo, aReceber, aPagar, atrasados,
}: {
  receita: number; despesa: number; saldo: number; aReceber: number; aPagar: number; atrasados: number;
}) {
  const items = [
    { label: "Receita do mês", value: fmtBRL(receita), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Despesa do mês", value: fmtBRL(despesa), icon: TrendingDown, color: "text-rose-600" },
    { label: "Saldo do mês", value: fmtBRL(saldo), icon: Wallet, color: saldo >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "A receber", value: fmtBRL(aReceber), icon: ArrowDownRight, color: "text-emerald-600" },
    { label: "A pagar", value: fmtBRL(aPagar), icon: ArrowUpRight, color: "text-amber-600" },
    { label: "Em atraso", value: String(atrasados), icon: AlertTriangle, color: atrasados > 0 ? "text-rose-600" : "text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{it.label}</div>
            <it.icon className={`size-4 ${it.color}`} />
          </div>
          <div className="text-xl font-bold mt-1 truncate">{it.value}</div>
        </Card>
      ))}
    </div>
  );
}
