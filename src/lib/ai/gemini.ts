export type GeminiGenerateOptions = {
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

type GeminiPart = { text?: unknown };
type GeminiCandidate = {
  finishReason?: unknown;
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiErrorPayload = {
  error?: {
    message?: unknown;
    code?: unknown;
  };
};

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function pickTextFromCandidate(c: GeminiCandidate | null | undefined): string | null {
  const parts = c?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = parts.map((p) => asString((p as GeminiPart).text) ?? "").join("");
  return text.trim() ? text : null;
}

export async function geminiGenerateText(opts: GeminiGenerateOptions): Promise<{ text: string; finishReason: string | null }> {
  const model = opts.model.trim();
  if (!model) throw new Error("Gemini model is required.");
  if (!opts.apiKey.trim()) throw new Error("Gemini API key is required.");
  if (!opts.prompt.trim()) throw new Error("Prompt is required.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
    opts.apiKey,
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      },
    }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await res.json()) as unknown) : await res.text();

  if (!res.ok) {
    if (typeof payload === "string") throw new Error(payload || `Gemini request failed (${res.status})`);
    const err = payload as GeminiErrorPayload;
    const msg = asString(err?.error?.message) ?? `Gemini request failed (${res.status})`;
    throw new Error(msg);
  }

  const obj = payload as { candidates?: unknown[] };
  const candidates = Array.isArray(obj?.candidates) ? (obj.candidates as GeminiCandidate[]) : [];
  const candidate = candidates[0] ?? null;
  const text = pickTextFromCandidate(candidate);
  if (!text) throw new Error("Gemini response contained no text.");

  return {
    text,
    finishReason: asString(candidate?.finishReason) ?? null,
  };
}

