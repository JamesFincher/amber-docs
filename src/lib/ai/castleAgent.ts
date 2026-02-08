export type AgentTranscriptItem = {
  role: "user" | "assistant" | "tool";
  content: string;
};

export type AgentToolCall = {
  tool: string;
  args: unknown;
};

export type AgentFinal = {
  type: "final";
  message: string;
  // Optional: a draft doc the UI can offer to save as a file.
  draft?: {
    docText?: string;
    markdown?: string;
    suggested?: Record<string, unknown>;
  };
};

export type AgentToolCalls = {
  type: "tool_calls";
  calls: AgentToolCall[];
};

export type AgentResponse = AgentFinal | AgentToolCalls;

function stripCodeFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return text;
  const firstNl = t.indexOf("\n");
  if (firstNl < 0) return text;
  const body = t.slice(firstNl + 1);
  const endFence = body.lastIndexOf("```");
  if (endFence < 0) return body;
  return body.slice(0, endFence);
}

// Extract a JSON object from an LLM response that might include prose or code fences.
export function extractJsonObject(text: string): string | null {
  const cleaned = stripCodeFences(text).trim();
  if (!cleaned) return null;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

export function parseAgentResponse(text: string): AgentResponse {
  const raw = extractJsonObject(text);
  if (!raw) throw new Error("Agent response did not contain a JSON object.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Agent response JSON parse failed: ${msg}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Agent response JSON must be an object.");
  }
  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (type !== "tool_calls" && type !== "final") {
    throw new Error('Agent response JSON missing valid "type" (expected "tool_calls" or "final").');
  }

  if (type === "tool_calls") {
    const callsRaw = obj.calls;
    if (!Array.isArray(callsRaw)) throw new Error('Agent tool_calls response missing "calls" array.');
    const calls: AgentToolCall[] = [];
    for (const item of callsRaw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const it = item as Record<string, unknown>;
      if (typeof it.tool !== "string" || !it.tool.trim()) continue;
      calls.push({ tool: it.tool, args: it.args });
    }
    if (calls.length === 0) throw new Error('Agent tool_calls response had no valid tool calls in "calls".');
    return { type: "tool_calls", calls };
  }

  const message = typeof obj.message === "string" ? obj.message : null;
  if (!message || !message.trim()) throw new Error('Agent final response missing non-empty "message".');
  const draftRaw = obj.draft;
  const draft =
    draftRaw && typeof draftRaw === "object" && !Array.isArray(draftRaw)
      ? (draftRaw as Record<string, unknown>)
      : null;
  return {
    type: "final",
    message,
    draft: draft
      ? {
          docText: typeof draft.docText === "string" ? draft.docText : undefined,
          markdown: typeof draft.markdown === "string" ? draft.markdown : undefined,
          suggested:
            draft.suggested && typeof draft.suggested === "object" && !Array.isArray(draft.suggested)
              ? (draft.suggested as Record<string, unknown>)
              : undefined,
        }
      : undefined,
  };
}

export type ToolDescriptor = {
  name: string;
  description: string;
  // Keep this human-readable; it's passed verbatim to the model.
  args: string;
  returns: string;
};

export type RunAgentLoopOptions = {
  system: string;
  tools: ToolDescriptor[];
  transcript: AgentTranscriptItem[];
  llm: (prompt: string) => Promise<string>;
  toolFns: Record<string, (args: unknown) => Promise<unknown>>;
  maxSteps?: number;
};

function formatTools(tools: ToolDescriptor[]): string {
  return tools
    .map((t) => `- ${t.name}\n  - ${t.description}\n  - args: ${t.args}\n  - returns: ${t.returns}`)
    .join("\n");
}

function formatTranscript(transcript: AgentTranscriptItem[]): string {
  return transcript
    .map((m) => {
      const tag = m.role.toUpperCase();
      return `${tag}:\n${m.content.trim()}\n`;
    })
    .join("\n");
}

export function buildAgentPrompt(args: { system: string; tools: ToolDescriptor[]; transcript: AgentTranscriptItem[] }): string {
  return `SYSTEM:\n${args.system.trim()}\n\nTOOLS:\n${formatTools(args.tools)}\n\nTRANSCRIPT:\n${formatTranscript(args.transcript)}\n\nINSTRUCTIONS:\nReturn ONLY a single JSON object (no markdown, no code fences).\n- If you need more information, return: {\"type\":\"tool_calls\",\"calls\":[{\"tool\":\"...\",\"args\":{...}}]}.\n- If you are done, return: {\"type\":\"final\",\"message\":\"...\"}.\n- If you drafted a document, include it in: {\"type\":\"final\",\"message\":\"...\",\"draft\":{\"docText\":\"...\"}}.\n`;
}

export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<{
  transcript: AgentTranscriptItem[];
  final: AgentFinal;
  steps: number;
}> {
  const maxSteps = Math.max(1, Math.min(20, opts.maxSteps ?? 6));
  const transcript: AgentTranscriptItem[] = [...opts.transcript];

  for (let step = 0; step < maxSteps; step++) {
    const prompt = buildAgentPrompt({ system: opts.system, tools: opts.tools, transcript });
    const raw = await opts.llm(prompt);

    let parsed: AgentResponse;
    try {
      parsed = parseAgentResponse(raw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      transcript.push({
        role: "tool",
        content: JSON.stringify({ tool: "__parse_error__", error: msg, raw: raw.slice(0, 4000) }, null, 2),
      });
      continue;
    }

    if (parsed.type === "final") {
      transcript.push({ role: "assistant", content: parsed.message });
      return { transcript, final: parsed, steps: step + 1 };
    }

    // tool_calls
    for (const call of parsed.calls) {
      const fn = opts.toolFns[call.tool];
      if (!fn) {
        transcript.push({
          role: "tool",
          content: JSON.stringify({ tool: call.tool, ok: false, error: "Unknown tool" }, null, 2),
        });
        continue;
      }
      try {
        const result = await fn(call.args);
        transcript.push({
          role: "tool",
          content: JSON.stringify({ tool: call.tool, ok: true, result }, null, 2),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        transcript.push({
          role: "tool",
          content: JSON.stringify({ tool: call.tool, ok: false, error: msg }, null, 2),
        });
      }
    }
  }

  throw new Error(`Agent did not complete within ${maxSteps} steps.`);
}
