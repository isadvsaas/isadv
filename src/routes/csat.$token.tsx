import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCsatByToken, submitCsat } from "@/lib/csat.functions";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/csat/$token")({
  head: () => ({ meta: [{ title: "Avalie nosso atendimento" }] }),
  component: CsatPage,
});

function CsatPage() {
  const { token } = Route.useParams();
  const get = useServerFn(getCsatByToken);
  const submit = useServerFn(submitCsat);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<{ found: boolean; respondido?: boolean; empresa?: string; primaryColor?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [comentario, setComentario] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try { setState(await get({ data: { token } }) as any); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function handleSubmit() {
    if (score < 1) { setError("Selecione uma nota."); return; }
    setSending(true); setError(null);
    try {
      await submit({ data: { token, score, comentario: comentario.trim() || undefined } });
      setSubmitted(true);
    } catch (e: any) { setError(e?.message ?? "Erro ao enviar."); }
    finally { setSending(false); }
  }

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin" /></div>;

  if (!state?.found) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <p className="text-muted-foreground">Pesquisa não encontrada ou expirada.</p>
    </div>
  );

  if (state.respondido || submitted) return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center max-w-md">
        <CheckCircle2 className="size-16 mx-auto mb-4" style={{ color: state.primaryColor }} />
        <h1 className="text-2xl font-bold mb-2">Obrigado!</h1>
        <p className="text-muted-foreground">Sua avaliação foi registrada com sucesso.</p>
      </div>
    </div>
  );

  const accent = state.primaryColor || "#22C55E";

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold text-center">Como foi seu atendimento{state.empresa ? ` na ${state.empresa}` : ""}?</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Sua opinião nos ajuda a melhorar.</p>

        <div className="flex items-center justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setScore(n)} className="p-1 transition-transform hover:scale-110">
              <Star className="size-10" fill={n <= score ? accent : "transparent"} stroke={n <= score ? accent : "currentColor"} />
            </button>
          ))}
        </div>
        {score > 0 && (
          <p className="text-center text-sm font-medium mb-4">
            {["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"][score]}
          </p>
        )}

        <Textarea placeholder="Conte mais (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4} />

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <Button className="w-full mt-4" onClick={handleSubmit} disabled={sending} style={{ background: accent, color: "white" }}>
          {sending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          Enviar avaliação
        </Button>
      </div>
    </div>
  );
}
