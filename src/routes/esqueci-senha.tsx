import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { brand } from "@/config/brand";

export const Route = createFileRoute("/esqueci-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: `${brand.name} — Recuperar senha` }] }),
  component: Page,
});

function Page() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Se este e-mail existir, enviamos um link de recuperação.");
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold mb-1">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground mb-4">Informe seu e-mail e enviaremos um link.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? "Enviando…" : "Enviar link"}</Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link to="/entrar" className="text-muted-foreground hover:underline">Voltar para o login</Link>
        </div>
      </Card>
    </div>
  );
}
