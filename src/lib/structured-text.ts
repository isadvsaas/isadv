// Converte valores estruturados (objetos/arrays) vindos da IA ou do banco em
// texto legível, SEM perder informação. Nunca produz "[object Object]".

const LABELS: Record<string, string> = {
  nome: "Nome",
  titulo: "Título",
  item: "Item",
  produto: "Produto",
  servico: "Serviço",
  descricao: "Descrição",
  duracao: "Duração",
  preco: "Valor",
  valor: "Valor",
  precos: "Valores",
  parcelas: "Parcelas",
  max_parcelas: "Máximo de parcelas",
  cartao: "Cartão",
  pix: "Pix",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  link: "Link",
  url: "Link",
  observacao: "Observação",
  observacoes: "Observações",
  pergunta: "Pergunta",
  resposta: "Resposta",
  objecao: "Objeção",
  politica: "Política",
  regra: "Regra",
  prazo: "Prazo",
  garantia: "Garantia",
  horario: "Horário",
  horarios: "Horários",
  condicoes: "Condições",
  forma: "Forma",
  tipo: "Tipo",
  categoria: "Categoria",
};

function labelOf(key: string): string {
  const norm = key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (LABELS[norm]) return LABELS[norm];
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.every(isEmptyValue);
  if (typeof v === "object") return Object.values(v as any).every(isEmptyValue);
  return false;
}

function scalarToText(v: unknown): string {
  if (typeof v === "boolean") return v ? "sim" : "não";
  const text = String(v).trim();
  return text === "[object Object]" ? "" : text;
}

function objectToText(obj: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyValue(v));
  if (!entries.length) return "";

  // Título do bloco: primeira chave "identificadora" disponível.
  const titleKey = ["nome", "titulo", "item", "produto", "servico", "pergunta", "objecao", "forma", "politica"].find(
    (k) => typeof obj[k] === "string" && scalarToText(obj[k]),
  );

  const lines: string[] = [];
  if (titleKey) lines.push(`${indent}${scalarToText(obj[titleKey])}`);

  for (const [k, v] of entries) {
    if (k === titleKey) continue;
    const childIndent = titleKey ? `${indent}  ` : indent;
    if (v !== null && typeof v === "object") {
      const nested = valueToText(v, `${childIndent}  `);
      if (nested) lines.push(`${childIndent}${labelOf(k)}:\n${nested}`);
    } else {
      const scalar = scalarToText(v);
      if (scalar) lines.push(`${childIndent}${labelOf(k)}: ${scalar}`);
    }
  }
  return lines.filter(Boolean).join("\n");
}

function valueToText(value: unknown, indent = ""): string {
  if (isEmptyValue(value)) return "";
  if (typeof value !== "object") return `${indent}${scalarToText(value)}`;
  if (Array.isArray(value)) {
    const parts = value
      .filter((v) => !isEmptyValue(v))
      .map((v) => {
        if (v !== null && typeof v === "object") return objectToText(v as any, indent);
        return `${indent}- ${scalarToText(v)}`;
      })
      .filter(Boolean);
    const multiline = parts.some((p) => p.includes("\n"));
    return parts.join(multiline ? "\n\n" : "\n");
  }
  return objectToText(value as Record<string, unknown>, indent);
}

/** Texto legível de qualquer valor. Retorna "" quando não há conteúdo real. */
export function toReadableText(value: unknown): string {
  const text = valueToText(value, "").replace(/\n{3,}/g, "\n\n").trim();
  return text === "[object Object]" ? "" : text;
}

/** Impede que qualquer prompt seja entregue com coerção implícita de objeto. */
export function assertNoObjectCoercion(text: string, label = "Prompt final"): string {
  if (text.includes("[object Object]")) {
    throw new Error(`${label} contém dados estruturados inválidos. Gere novamente.`);
  }
  return text;
}
