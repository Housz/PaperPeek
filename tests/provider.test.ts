import { describe, expect, it, vi } from "vitest";
import {
  generateText, providerRequest, responseText, listModels,
  parseModelList, modelsEndpoint, likelyChatModel
} from "../src/lib/provider";

const key = "dummy-test-only-key";
describe("provider adapters", () => {
  it("keeps existing Gemini API request shape", () => {
    const { url, init } = providerRequest({
      provider: "gemini", model: "gemini-2.5-flash", apiKey: key, prompt: "hello", json: true
    });
    expect(url).toContain("generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(key);
  });
  it("uses chosen IDs in OpenAI and DeepSeek requests", () => {
    for (const provider of ["openai", "deepseek"] as const) {
      const { url, init } = providerRequest({
        provider, model: "chosen-model", apiKey: key, prompt: "text"
      });
      expect(url).toContain("chat/completions");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer " + key);
      expect(JSON.parse(init.body as string).model).toBe("chosen-model");
    }
  });
  it("reads official models and hides non-chat OpenAI offerings", () => {
    expect(modelsEndpoint("openai")).toBe("https://api.openai.com/v1/models");
    expect(modelsEndpoint("deepseek")).toBe("https://api.deepseek.com/models");
    expect(likelyChatModel("gpt-4.1-mini")).toBe(true);
    const openai = parseModelList("openai", { data: [
      { id: "gpt-4.1-mini" }, { id: "text-embedding-3-small" },
      { id: "gpt-image-1" }, { id: "o4-mini" }
    ] });
    expect(openai.map(m => m.id)).toEqual(["gpt-4.1-mini", "o4-mini"]);
    const deepseek = parseModelList("deepseek", { data: [
      { id: "deepseek-flash", name: "Flash", context_window: 1000000 },
      { id: "deepseek-v4-pro", name: "Pro" }
    ] });
    expect(deepseek[0]).toMatchObject({ id: "deepseek-flash", label: "Flash", contextWindow: 1000000 });
  });
  it("fetches official catalog with provider key only", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "deepseek-flash" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const models = await listModels("deepseek", key, fetcher);
    expect(models[0].id).toBe("deepseek-flash");
    expect(fetcher).toHaveBeenCalledOnce();
    const [endpoint, config] = (fetcher as any).mock.calls[0];
    expect(endpoint).toBe("https://api.deepseek.com/models");
    expect(config.headers.Authorization).toBe("Bearer " + key);
  });
  it("parses textual answers and suppresses secret-bearing HTTP response bodies", async () => {
    expect(responseText("openai", { choices: [{ message: { content: "  fine  " } }] })).toBe("fine");
    const fetcher = vi.fn(async () => new Response("SECRET " + key, { status: 404 })) as unknown as typeof fetch;
    await expect(generateText({
      provider: "openai", model: "old-model", apiKey: key, prompt: "x"
    }, fetcher)).rejects.toThrow(/模型不可用/);
    await expect(listModels("openai", key, fetcher)).rejects.toThrow(/模型列表/);
  });
});
