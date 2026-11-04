import type { Provider } from "../types";

export interface GenerateRequest {
  provider: Provider;
  model: string;
  apiKey: string;
  prompt: string;
  json?: boolean;
}
export interface AvailableModel {
  id: string;
  label: string;
  contextWindow?: number;
}

export function providerRequest(req: GenerateRequest): {
  url: string; init: RequestInit;
} {
  const model = req.model.trim();
  if (!model || !req.apiKey.trim()) throw new Error("请先选择模型并配置 API Key。");
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
  return {
    url: req.provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + req.apiKey },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: req.prompt }]
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
    throw new Error("模型未返回可识别的文本，请检查模型是否支持当前接口。");
  return text.trim();
}

/** The models endpoint is a discoverability aid, NOT a guarantee of Chat Completions support. */
export function modelsEndpoint(provider: Provider): string | null {
  if (provider === "openai") return "https://api.openai.com/v1/models";
  if (provider === "deepseek") return "https://api.deepseek.com/models";
  return null;
}

export function likelyChatModel(id: string): boolean {
  return /^(?:gpt-\d|o[1-9](?:-|$)|chatgpt-)/i.test(id)
    && !/(?:embedding|tts|transcrib|audio|image|realtime|moderation|search-preview|deep-research)/i.test(id);
}

export function parseModelList(provider: Provider, payload: unknown): AvailableModel[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new Error("模型接口返回格式异常。");
  const models = data.flatMap((record: unknown) => {
    if (!record || typeof record !== "object") return [];
    const item = record as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return [];
    if (provider === "openai" && !likelyChatModel(item.id)) return [];
    const contextWindow = typeof item.context_window === "number" &&
      Number.isFinite(item.context_window) ? item.context_window : undefined;
    const label = typeof item.name === "string" && item.name.trim()
      ? item.name.trim().slice(0, 110) : item.id;
    return [{ id: item.id, label, contextWindow }];
  });
  const unique = [...new Map(models.map(value => [value.id, value])).values()];
  return unique.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).slice(0, 200);
}

export async function listModels(
  provider: Provider, apiKey: string, fetcher: typeof fetch = fetch
): Promise<AvailableModel[]> {
  const endpoint = modelsEndpoint(provider);
  if (!endpoint) throw new Error("Gemini 模型列表暂未集成，请手动填写模型 ID。");
  if (!apiKey.trim()) throw new Error("请先输入当前服务商的 API Key。");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetcher(endpoint, {
      method: "GET",
      headers: { Authorization: "Bearer " + apiKey },
      signal: controller.signal
    });
    if (!res.ok) throw providerError(res.status, "model-list");
    return parseModelList(provider, await res.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error("获取模型列表超时，请稍后重试。");
    throw error;
  } finally { clearTimeout(timer); }
}

export function providerError(status: number, operation: "model-list" | "generation"): Error {
  if (status === 401 || status === 403) return new Error("API Key 无效或没有当前操作的权限（" + status + "）。");
  if (status === 429) return new Error("请求过于频繁或 API 配额不足（429）。");
  if (status === 404) return new Error(operation === "model-list"
    ? "模型列表接口未找到（404），请检查当前服务商。"
    : "模型不可用（404）：请刷新官方模型列表并重新选择模型 ID。");
  if (status >= 500) return new Error("模型服务暂时异常（HTTP " + status + "）。");
  return new Error("模型请求失败（HTTP " + status + "）。");
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
    if (!res.ok) throw providerError(res.status, "generation");
    return responseText(req.provider, await res.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error("模型请求超时，请尝试较短的论文或换一个模型。");
    throw error;
  } finally { clearTimeout(timeout); }
}
