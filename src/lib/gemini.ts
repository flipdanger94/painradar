export const freeTier = () => process.env.GEMINI_TIER !== "paid";
export const analysisModel = () =>
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const embeddingModel = () =>
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
export interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}
export async function geminiRequest<T>(
  model: string,
  method: "generateContent" | "embedContent",
  body: unknown,
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured: add GEMINI_API_KEY");
  if (!/^gemini-[a-z0-9.-]+$/.test(model))
    throw new Error("Invalid Gemini model");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    },
  );
  // Never include provider response bodies or credentials in user-facing errors.
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Gemini quota exceeded. Wait for quota renewal before restarting collection."
        : `Gemini request failed (HTTP ${response.status}). Check API key, model access and project tier.`,
    );
  return response.json() as Promise<T>;
}
export function generatedText(response: GeminiResponse) {
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason !== "STOP")
    throw new Error("Gemini did not return a complete response");
  const text = candidate.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
  if (!text) throw new Error("Gemini returned no text");
  return text;
}
export function normalizeEmbedding(values: number[] | undefined) {
  if (
    !values ||
    values.length !== 1536 ||
    values.some((n) => !Number.isFinite(n))
  )
    throw new Error("Gemini returned an invalid embedding");
  const norm = Math.hypot(...values);
  if (!Number.isFinite(norm) || norm === 0)
    throw new Error("Gemini returned an empty embedding");
  return values.map((n) => n / norm);
}
