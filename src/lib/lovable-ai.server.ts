// Multi-provider AI chat. Gemini default via Lovable Gateway (free for users).
// OpenAI e Anthropic usam a chave da própria empresa.

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderConfig {
  provider?: "gemini" | "openai" | "anthropic" | string;
  model?: string;
  openaiKey?: string;
  anthropicKey?: string;
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function lovableAiChat(
  messages: ChatMsg[],
  modelOrConfig: string | AiProviderConfig = "google/gemini-2.5-flash",
): Promise<string> {
  const cfg: AiProviderConfig =
    typeof modelOrConfig === "string"
      ? { provider: "gemini", model: modelOrConfig }
      : modelOrConfig;
  const provider = (cfg.provider || "gemini").toLowerCase();

  if (provider === "openai") {
    // Chave própria da empresa (BYOK) quando existir; senão, chave global da plataforma.
    const key = cfg.openaiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("Nenhuma chave OpenAI disponível (empresa ou plataforma).");
    const model = cfg.model || "gpt-4o-mini";
    return openAiChat(key, model, messages);
  }
  if (provider === "anthropic") {
    const key = cfg.anthropicKey?.trim();
    if (!key) throw new Error("Chave Anthropic (Claude) não configurada na sua empresa.");
    const model = cfg.model || "claude-3-5-sonnet-latest";
    return anthropicChat(key, model, messages);
  }
  // default: Gemini via Lovable Gateway
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  const model = cfg.model || "google/gemini-2.5-flash";
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Lovable AI: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

async function openAiChat(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() || "";
}

async function anthropicChat(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conv = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages: conv }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const txt = (data?.content || [])
    .filter((p: any) => p?.type === "text")
    .map((p: any) => p.text)
    .join("\n")
    .trim();
  return txt;
}

// ============================================================================
// BLOCO 2 — Tool calling com abstração única por provider.
// O formato interno é sempre { text, toolCalls[] }; cada provider tem seu adapter.
// A regra de negócio fica no dispatcher (agent-tools.server.ts), nunca aqui.
// ============================================================================

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: any;
}

/** Mensagem estendida: suporta turnos de tool no formato interno. */
export interface AgentMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolTurn {
  text: string;
  toolCalls: ToolCall[];
}

function toOpenAiMessages(messages: AgentMsg[]): any[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.tool_calls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function parseOpenAiTurn(data: any): ToolTurn {
  const msg = data?.choices?.[0]?.message ?? {};
  const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  return {
    text: (msg.content ?? "").toString().trim(),
    toolCalls: calls.map((c: any, i: number) => {
      let args: any = {};
      try {
        args = c?.function?.arguments ? JSON.parse(c.function.arguments) : {};
      } catch {
        args = {};
      }
      return { id: c?.id || `call_${i}`, name: c?.function?.name || "", args };
    }),
  };
}

async function openAiCompatibleTurn(
  url: string,
  key: string,
  model: string,
  messages: AgentMsg[],
  tools: ToolSpec[],
  authHeader: Record<string, string>,
): Promise<ToolTurn> {
  const body: any = { model, messages: toOpenAiMessages(messages) };
  if (tools.length) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  return parseOpenAiTurn(await res.json());
}

async function anthropicTurn(
  key: string,
  model: string,
  messages: AgentMsg[],
  tools: ToolSpec[],
): Promise<ToolTurn> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conv: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      conv.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }],
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.tool_calls) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.args ?? {} });
      conv.push({ role: "assistant", content: blocks });
      continue;
    }
    conv.push({ role: m.role, content: m.content });
  }
  const body: any = { model, max_tokens: 1024, system, messages: conv };
  if (tools.length) {
    body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts: any[] = data?.content ?? [];
  return {
    text: parts.filter((p) => p?.type === "text").map((p) => p.text).join("\n").trim(),
    toolCalls: parts
      .filter((p) => p?.type === "tool_use")
      .map((p: any, i: number) => ({ id: p.id || `call_${i}`, name: p.name, args: p.input ?? {} })),
  };
}

/** Um turno do modelo, com tools. Mesma assinatura para Gemini/OpenAI/Anthropic. */
export async function aiTurnWithTools(
  messages: AgentMsg[],
  modelOrConfig: string | AiProviderConfig,
  tools: ToolSpec[] = [],
): Promise<ToolTurn> {
  const cfg: AiProviderConfig =
    typeof modelOrConfig === "string" ? { provider: "gemini", model: modelOrConfig } : modelOrConfig;
  const provider = (cfg.provider || "gemini").toLowerCase();

  if (provider === "openai") {
    const key = cfg.openaiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("Nenhuma chave OpenAI disponível (empresa ou plataforma).");
    return openAiCompatibleTurn(
      "https://api.openai.com/v1/chat/completions",
      key,
      cfg.model || "gpt-4o-mini",
      messages,
      tools,
      { Authorization: `Bearer ${key}` },
    );
  }
  if (provider === "anthropic") {
    const key = cfg.anthropicKey?.trim();
    if (!key) throw new Error("Chave Anthropic (Claude) não configurada na sua empresa.");
    return anthropicTurn(key, cfg.model || "claude-3-5-sonnet-latest", messages, tools);
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  // Gateway Lovable é compatível com o formato OpenAI (inclusive tools).
  return openAiCompatibleTurn(GATEWAY, key, cfg.model || "google/gemini-2.5-flash", messages, tools, {
    Authorization: `Bearer ${key}`,
  });
}
