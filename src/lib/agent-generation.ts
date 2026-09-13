// Helpers puros (client-safe) da geração/onboarding do agente de IA.
// Regra central: o dono é o dono da informação. A IA só estrutura.
// Nada pode ser inventado, resumido, substituído ou apagado sem confirmação.

export const PENDING_MARKER = "[PENDENTE]";

export const MANUAL_PROMPT_CONFIRM_MESSAGE =
  "Esta ação pode substituir alterações feitas manualmente. Deseja continuar?";

export function isBlankValue(v: unknown): boolean {
  return typeof v !== "string" ? v === null || v === undefined : v.trim() === "";
}

export function isPendingValue(v: unknown): boolean {
  return typeof v === "string" && v.trim().toUpperCase() === PENDING_MARKER;
}

/** Existe prompt manual? Então a tela está em MODO MANUAL. */
export function isManualPromptMode(promptCustom: unknown): boolean {
  return typeof promptCustom === "string" && promptCustom.trim().length > 0;
}

/** Qualquer regeneração/limpeza precisa de confirmação quando há prompt manual. */
export function requiresManualPromptConfirmation(promptCustom: unknown): boolean {
  return isManualPromptMode(promptCustom);
}

export type GenerationConflict = { campo: string; atual: string; novo: string };

export type MergeResult<T extends Record<string, any>> = {
  config: T;
  conflitos: GenerationConflict[];
};

/**
 * Mescla o resultado da geração sobre a configuração atual SEM destruir nada:
 * - campo vazio ou [PENDENTE] na geração nunca apaga um valor já confirmado;
 * - campo novo entra normalmente;
 * - valor novo divergente de um valor já confirmado NÃO é aplicado sozinho:
 *   vira conflito pendente de confirmação do usuário.
 * - prompt_custom nunca é tocado pela geração.
 */
export function mergeGeneratedConfig<T extends Record<string, any>>(
  current: Record<string, any> | null | undefined,
  generated: Record<string, any>,
): MergeResult<T> {
  const base: Record<string, any> = { ...(current ?? {}) };
  const conflitos: GenerationConflict[] = [];

  for (const [key, rawNovo] of Object.entries(generated ?? {})) {
    if (key === "prompt_custom") continue;

    const novo = typeof rawNovo === "string" ? rawNovo : rawNovo == null ? "" : String(rawNovo);
    const atualRaw = base[key];
    const atual = typeof atualRaw === "string" ? atualRaw : atualRaw == null ? "" : String(atualRaw);

    const atualVazio = isBlankValue(atual) || isPendingValue(atual);
    const novoVazio = isBlankValue(novo) || isPendingValue(novo);

    if (novoVazio) {
      // nunca substituir informação confirmada por vazio/genérico
      if (atualVazio) base[key] = isBlankValue(atual) && isPendingValue(novo) ? PENDING_MARKER : atual || novo;
      continue;
    }

    if (atualVazio) {
      base[key] = novo;
      continue;
    }

    if (atual.trim() === novo.trim()) continue;

    // conflito: não decidir sozinho
    conflitos.push({ campo: key, atual, novo });
  }

  // prompt_custom permanece exatamente como estava
  if (current && typeof current.prompt_custom === "string") base.prompt_custom = current.prompt_custom;

  return { config: base as T, conflitos };
}

export type AnswerableQuestion = {
  id: string;
  campo?: string;
  [k: string]: any;
};

/**
 * Onboarding: nunca perguntar de novo algo que já está preenchido
 * (nem na config salva, nem nas respostas já dadas).
 */
export function filterAnsweredQuestions<T extends AnswerableQuestion>(
  perguntas: T[],
  ctx: { config?: Record<string, any> | null; respostas?: Record<string, unknown> | null },
): T[] {
  const config = ctx.config ?? {};
  const respostas = ctx.respostas ?? {};
  return (perguntas ?? []).filter((q) => {
    const jaRespondida = !isBlankValue(respostas[q.id]);
    if (jaRespondida) return false;
    const campo = q.campo;
    if (!campo || campo === "extra") return true;
    const valor = config[campo];
    if (isPendingValue(valor)) return true;
    return isBlankValue(valor);
  });
}
