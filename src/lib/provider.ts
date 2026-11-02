import type { Provider } from "../types";

export interface GenerateRequest {
  provider: Provider;
  model: string;
  apiKey: string;
  prompt: string;
  json?: boolean;
}
export function providerRequest(req: GenerateRequest): {
  url: string; init: RequestInit;
} {
  const model = req.model.trim();
  if (!model || !req.apiKey.trim()) throw new Error("Configure a model and API key first.");
  if (req.provider === "gemini") {
    const clean = model.replace(/^models\//, "");
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(clean) + ":generateContent",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": req.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          generationConfig: req.json ? { responseMimeType: "application/json" } : undefined
        })
      }
    };
  }
  const url = req.provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.deepseek.com/chat/completions";
  return {
    url,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + req.apiKey },
      body: JSON.stringify({
        model, messages: [{ role: "user", content: req.prompt }]
      })
    }
  };
}

export function responseText(provider: Provider, payload: unknown): string {
  const data = payload as Record<string, any> | null;
  const text = provider === "gemini"
    ? data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("")
    : data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim())
    throw new Error("The model returned an empty or unsupported response.");
  return text.trim();
}

export async function generateText(
  req: GenerateRequest,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const { url, init } = providerRequest(req);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetcher(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      // Never reflect raw response bodies: providers may echo request details.
      if (res.status === 401 || res.status === 403) throw new Error("API authentication failed.");
      if (res.status === 429) throw new Error("Rate limit or quota exceeded.");
      throw new Error("Model API request failed (HTTP " + res.status + ").");
    }
    const body = await res.json();
    return responseText(req.provider, body);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Model request timed out.");
    throw error;
  } finally { clearTimeout(timeout); }
}
