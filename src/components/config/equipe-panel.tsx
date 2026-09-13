import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, RefreshCw } from "lucide-react";
import { listTeam, inviteMember, setMemberActive, setMemberRole } from "@/lib/team.functions";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { PlanUsageBadge } from "@/components/plan-usage-badge";

export const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  atendente: "Atendente",
};

export function EquipePanel({ isOwner }: { isOwner: boolean }) {
  const list = useServerFn(listTeam);
  const invite = useServerFn(inviteMember);
  const toggleActive = useServerFn(setMemberActive);
  const changeRole = useServerFn(setMemberRole);
  const plan = usePlanFeatures();

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "atendente">("atendente");
  const [busy, setBusy] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setErro(null);
    try { const r = await list(); setMembers(r.members); }
    catch { setErro("Não foi possível carregar esta informação."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  async function doInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setTempPwd(null);
    try {
      const r = await invite({ data: { email, role } });
      setEmail("");
      toast.success("Pessoa adicionada");
      if (r.tempPassword) setTempPwd(r.tempPassword);
      await Promise.all([reload(), plan.refresh()]);
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Quem pode acessar e responder os clientes.</p>
        {!plan.loading && (
          <PlanUsageBadge label="usuários" used={plan.usage.usuarios} limit={plan.limites.usuarios} />
        )}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><UserPlus className="size-4" /> Adicionar pessoa</h2>
        <form onSubmit={doInvite} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>E-mail</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
          </div>
          <div className="w-full sm:w-48">
            <Label>Função</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atendente">Atendente</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <UserPlus className="size-4 mr-1.5" />}
            Adicionar
          </Button>
        </form>
        {tempPwd && (
          <div className="mt-4 rounded-md border bg-amber-500/10 p-3 text-sm">
            <div className="font-medium mb-1">Senha temporária gerada</div>
            <div className="text-xs text-muted-foreground mb-2">Envie para a pessoa. No primeiro acesso ela troca a senha.</div>
            <div className="flex items-center gap-2">
              <code className="bg-background px-2 py-1 rounded text-xs flex-1 break-all">{tempPwd}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPwd); toast.success("Copiado"); }}>
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : erro ? (
          <div className="p-6 text-center text-sm space-y-3">
            <p className="text-muted-foreground">{erro}</p>
            <Button size="sm" variant="outline" onClick={() => void reload()}>
              <RefreshCw className="size-4 mr-1.5" /> Tentar novamente
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Ninguém na equipe ainda.</div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.nome || m.email || m.user_id}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isOwner && m.role !== "owner" ? (
                    <Select value={m.role} onValueChange={(v) =>
                      changeRole({ data: { memberId: m.id, role: v as any } }).then(reload).catch((e) => toast.error(e?.message))
                    }>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="atendente">Atendente</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  )}
                  <Badge variant={m.ativo ? "default" : "secondary"} className={m.ativo ? "bg-primary" : ""}>
                    {m.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  {m.role !== "owner" && (
                    <Button size="sm" variant="outline" onClick={() =>
                      toggleActive({ data: { memberId: m.id, ativo: !m.ativo } }).then(reload).catch((e) => toast.error(e?.message))
                    }>
                      {m.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
