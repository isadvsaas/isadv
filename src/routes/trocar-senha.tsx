import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { brand } from "@/config/brand";

export const Route = createFileRoute("/trocar-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: `${brand.name} — Trocar senha` }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/entrar", replace: true });
      else setUserId(data.user.id);
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) return toast.error("Senha precisa ter pelo menos 6 caracteres.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) { setLoading(false); return toast.error(error.message); }
    // limpa flag forcar_troca_senha em todas as memberships do usuário
    if (userId) {
      await supabase.from("company_user").update({ forcar_troca_senha: false }).eq("user_id", userId);
    }
    setLoading(false);
    toast.success("Senha atualizada!");
    navigate({ to: "/app/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold mb-1">Trocar senha</h1>
        <p className="text-sm text-muted-foreground mb-4">Defina uma nova senha para continuar.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Salvando…" : "Atualizar senha"}</Button>
        </form>
      </Card>
    </div>
  );
}
