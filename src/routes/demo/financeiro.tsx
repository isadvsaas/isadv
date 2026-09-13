import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Sparkles, Lock, Pencil, Trash2, Plus, Download } from "lucide-react";
import { HelpTip } from "@/components/help-tip";
import { brand } from "@/config/brand";
import { FinKpiGrid, fmtBRL } from "@/components/financeiro/fin-kpis";
import { toast } from "sonner";

export const Route = createFileRoute("/demo/financeiro")({
  head: () => ({ meta: [{ title: `${brand.name} — Demo Financeiro` }] }),
  component: DemoFinanceiro,
});

const MOCK_SERIES = [
  { mes: "jan", receita: 1820000, despesa: 980000 },
  { mes: "fev", receita: 2140000, despesa: 1120000 },
  { mes: "mar", receita: 2050000, despesa: 1090000 },
  { mes: "abr", receita: 2480000, despesa: 1180000 },
  { mes: "mai", receita: 2710000, despesa: 1320000 },
  { mes: "jun", receita: 2960000, despesa: 1410000 },
];

const MOCK_LANC = [
  { id: "1", tipo: "receita", descricao: "Venda Pacote Vitalis — Maria S.", valor_cents: 189000, status: "pago", vencimento: "2026-06-10", pago_em: "2026-06-10", categoria: { nome: "Vendas", cor: "#22B85F" }, crm_card_id: "x" },
  { id: "2", tipo: "receita", descricao: "Venda Drenagem 10x — João P.", valor_cents: 99000, status: "pendente", vencimento: "2026-06-22", categoria: { nome: "Vendas", cor: "#22B85F" }, crm_card_id: "x" },
  { id: "3", tipo: "receita", descricao: "Pacote anual — Empresa Beta", valor_cents: 1200000, status: "pendente", vencimento: "2026-06-25", categoria: { nome: "Vendas", cor: "#22B85F" } },
  { id: "4", tipo: "despesa", descricao: "Anúncios Meta — Junho", valor_cents: 350000, status: "pago", vencimento: "2026-06-05", pago_em: "2026-06-05", categoria: { nome: "Marketing", cor: "#FFB020" } },
  { id: "5", tipo: "despesa", descricao: "Folha de pagamento", valor_cents: 820000, status: "pendente", vencimento: "2026-06-30", categoria: { nome: "Folha de pagamento", cor: "#FF7A59" } },
  { id: "6", tipo: "despesa", descricao: "Aluguel da clínica", valor_cents: 450000, status: "pago", vencimento: "2026-06-10", pago_em: "2026-06-10", categoria: { nome: "Operacional", cor: "#FF5A5A" } },
  { id: "7", tipo: "despesa", descricao: "Servidor + WhatsApp API", valor_cents: 78000, status: "pago", vencimento: "2026-06-08", pago_em: "2026-06-08", categoria: { nome: "Infraestrutura", cor: "#A36BFF" } },
];

const MOCK_CATS = [
  { id: "c1", nome: "Vendas", tipo: "receita", cor: "#22B85F" },
  { id: "c2", nome: "Serviços", tipo: "receita", cor: "#8AA89A" },
  { id: "c3", nome: "Marketing", tipo: "despesa", cor: "#FFB020" },
  { id: "c4", nome: "Folha de pagamento", tipo: "despesa", cor: "#FF7A59" },
  { id: "c5", nome: "Infraestrutura", tipo: "despesa", cor: "#A36BFF" },
  { id: "c6", nome: "Operacional", tipo: "despesa", cor: "#FF5A5A" },
];

const TOP_CATS = [
  { nome: "Folha de pagamento", cor: "#FF7A59", valor: 820000 },
  { nome: "Aluguel/Operacional", cor: "#FF5A5A", valor: 450000 },
  { nome: "Marketing", cor: "#FFB020", valor: 350000 },
  { nome: "Infraestrutura", cor: "#A36BFF", valor: 78000 },
];

function DemoFinanceiro() {
  const [tab, setTab] = useState("visao");
  const receitas = MOCK_LANC.filter((l) => l.tipo === "receita");
  const despesas = MOCK_LANC.filter((l) => l.tipo === "despesa");
  const receitaMes = receitas.filter((l) => l.status === "pago").reduce((s, l) => s + l.valor_cents, 0);
  const despesaMes = despesas.filter((l) => l.status === "pago").reduce((s, l) => s + l.valor_cents, 0);
  const aReceber = receitas.filter((l) => l.status === "pendente").reduce((s, l) => s + l.valor_cents, 0);
  const aPagar = despesas.filter((l) => l.status === "pendente").reduce((s, l) => s + l.valor_cents, 0);

  const blocked = () => toast("🔒 Disponível nos planos Pro e Business", { description: "Crie sua conta para experimentar de verdade." });

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 border bg-[color:var(--brand-soft)]/40 flex items-start gap-3 flex-wrap">
        <Lock className="size-5 text-[color:var(--brand-text)] mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold flex items-center gap-2">
            Módulo Financeiro
            <Badge style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}>Pro & Business</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Disponível nos planos <b>Pro</b> e <b>Business</b>. Pode ser ativado ou desativado pela empresa quando quiser — para quem já usa outro sistema financeiro, basta deixar desativado.
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Financeiro
            <HelpTip text="Vendas marcadas como Ganho no CRM viram receita pendente automaticamente. Despesas você lança manualmente." />
          </h1>
          <p className="text-sm text-muted-foreground">Demo — dados de exemplo, somente leitura.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={blocked}><Download className="size-4 mr-1.5" /> CSV</Button>
          <Button variant="outline" onClick={blocked}><Plus className="size-4 mr-1.5" /> Despesa</Button>
          <Button onClick={blocked}><Plus className="size-4 mr-1.5" /> Receita</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="receber">A receber ({receitas.length})</TabsTrigger>
          <TabsTrigger value="pagar">A pagar ({despesas.length})</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <FinKpiGrid
            receita={receitaMes} despesa={despesaMes} saldo={receitaMes - despesaMes}
            aReceber={aReceber} aPagar={aPagar} atrasados={0}
          />
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Fluxo de caixa (6 meses)</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={MOCK_SERIES}>
                  <defs>
                    <linearGradient id="rec2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22B85F" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22B85F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="desp2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF5A5A" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#FF5A5A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => fmtBRL(v)} width={80} />
                  <Tooltip formatter={(v: any) => fmtBRL(v)} />
                  <Area type="monotone" dataKey="receita" stroke="#22B85F" fill="url(#rec2)" name="Receita" />
                  <Area type="monotone" dataKey="despesa" stroke="#FF5A5A" fill="url(#desp2)" name="Despesa" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="font-semibold mb-2">Top despesas por categoria</h2>
            <div className="space-y-2">
              {TOP_CATS.map((c) => {
                const max = TOP_CATS[0].valor;
                return (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.nome}</span>
                      <span className="font-medium">{fmtBRL(c.valor)}</span>
                    </div>
                    <div className="h-1.5 rounded bg-muted mt-1 overflow-hidden">
                      <div className="h-full" style={{ width: `${(c.valor / max) * 100}%`, background: c.cor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receber">
          <DemoList items={receitas} />
        </TabsContent>
        <TabsContent value="pagar">
          <DemoList items={despesas} />
        </TabsContent>

        <TabsContent value="categorias">
          <Card className="p-4 mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4" /> Categorias padrão criadas ao ativar o módulo. Edite à vontade.
          </Card>
          <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
            {["receita", "despesa"].map((t) => (
              <Card key={t} className="p-4">
                <h3 className="font-semibold mb-2">{t === "receita" ? "Receitas" : "Despesas"}</h3>
                <div className="divide-y">
                  {MOCK_CATS.filter((c) => c.tipo === t).map((c) => (
                    <div key={c.id} className="py-2 flex items-center gap-2">
                      <div className="size-3 rounded-full" style={{ background: c.cor }} />
                      <span className="flex-1 text-sm">{c.nome}</span>
                      <Button size="sm" variant="ghost" onClick={blocked}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={blocked} className="text-rose-600"><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DemoList({ items }: { items: any[] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Card className="divide-y">
      {items.map((l) => {
        const statusColor = l.status === "pago" ? "bg-emerald-600" : l.vencimento < hoje ? "bg-rose-600" : "bg-amber-500";
        return (
          <div key={l.id} className="p-3 flex items-center gap-3 flex-wrap">
            <div className={`size-2 rounded-full shrink-0 ${statusColor}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{l.descricao}</span>
                {l.categoria && (
                  <Badge variant="secondary" style={{ background: l.categoria.cor + "22", color: l.categoria.cor }}>
                    {l.categoria.nome}
                  </Badge>
                )}
                {l.crm_card_id && <Badge variant="outline">do CRM</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Vence em {new Date(l.vencimento).toLocaleDateString("pt-BR")}
                {l.pago_em && ` · Pago em ${new Date(l.pago_em).toLocaleDateString("pt-BR")}`}
              </div>
            </div>
            <div className={`font-semibold ${l.tipo === "receita" ? "text-emerald-600" : "text-rose-600"}`}>
              {l.tipo === "receita" ? "+" : "−"}{fmtBRL(l.valor_cents)}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
