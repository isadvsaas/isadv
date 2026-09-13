// BLOCO 2 — Loop do agente: modelo → tool call → dispatcher → resultado → modelo.
// Providers passam pela abstração aiTurnWithTools; a regra fica no dispatcher.

import { aiTurnWithTools, type AgentMsg, type AiProviderConfig } from "./lovable-ai.server";
import { buildToolSpecs, executeTool, type ToolContext, type ToolResult } from "./agent-tools.server";

const MAX_TOOL_ROUNDS = 3;

export async function runAgentTurn(
  admin: any,
  params: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    aiConfig: AiProviderConfig;
    ctx: ToolContext;
    stageNames: string[];
  },
): Promise<{ text: string; toolResults: Array<{ name: string; result: ToolResult }>; pausedByTool: boolean }> {
  const tools = buildToolSpecs(params.ctx, params.stageNames);
  const msgs: AgentMsg[] = params.messages.map((m) => ({ role: m.role, content: m.content }));
  const toolResults: Array<{ name: string; result: ToolResult }> = [];
  let pausedByTool = false;
  let text = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const turn = await aiTurnWithTools(msgs, params.aiConfig, round < MAX_TOOL_ROUNDS ? tools : []);
    text = turn.text || text;
    if (!turn.toolCalls.length) break;

    msgs.push({ role: "assistant", content: turn.text || "", tool_calls: turn.toolCalls });

    for (const call of turn.toolCalls) {
      const result = await executeTool(admin, params.ctx, call.name, call.args);
      toolResults.push({ name: call.name, result });
      if (call.name === "transferir_humano" && result.ok) pausedByTool = true;
      console.info("[tool]", params.ctx.companyId, call.name, result.ok ? "ok" : `erro: ${result.error}`);
      msgs.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(result).slice(0, 2000),
      });
    }
    text = ""; // aguarda a resposta final do modelo após o resultado das tools
  }

  return { text: text.trim(), toolResults, pausedByTool };
}
