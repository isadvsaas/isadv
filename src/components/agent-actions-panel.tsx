// ETAPA 5 — UI amigável para as tools existentes (identifiers internos preservados).
import { Switch } from "@/components/ui/switch";

const ACTIONS: Array<{ key: string; label: string; desc: string }> = [
  {
    key: "atualizar_lead",
    label: "Atualizar informações do cliente",
    desc: "Salva o que o cliente contar durante a conversa na ficha dele.",
  },
  {
    key: "qualificar_lead",
    label: "Qualificar oportunidade",
    desc: "Identifica se o cliente tem interesse real e registra isso pra você.",
  },
  {
    key: "mover_pipeline",
    label: "Mover cliente no funil",
    desc: "Avança o cliente para a próxima etapa conforme a conversa evolui.",
  },
  {
    key: "transferir_humano",
    label: "Chamar atendimento humano",
    desc: "Permite que o atendente passe a conversa para uma pessoa da sua equipe.",
  },
  {
    key: "finalizar_lead",
    label: "Finalizar atendimento",
    desc: "Encerra o atendimento quando o assunto do cliente já foi resolvido.",
  },
];

export function AgentActionsPanel({
  allowedTools,
  onChangeTools,
}: {
  allowedTools: string[];
  onChangeTools: (v: string[]) => void;
}) {
  function toggle(key: string, on: boolean) {
    const set = new Set(allowedTools ?? []);
    if (on) set.add(key);
    else set.delete(key);
    onChangeTools(Array.from(set));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Escolha o que o atendente tem permissão para fazer sozinho. O que estiver desligado ele nunca faz.
      </p>
      <div className="space-y-2">
        {ACTIONS.map((a) => (
          <div
            key={a.key}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
            </div>
            <Switch
              className="shrink-0 mt-0.5"
              checked={(allowedTools ?? []).includes(a.key)}
              onCheckedChange={(v) => toggle(a.key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
