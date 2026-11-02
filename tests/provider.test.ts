import { describe, expect, it, vi } from "vitest";
import { generateText, providerRequest, responseText } from "../src/lib/provider";

const key = "dummy-test-only-key";
describe("provider adapters", () => {
  it("constructs Gemini REST request", () => {
    const { url, init } = providerRequest({ provider: "gemini", model: "gemini-2.5-flash", apiKey: key, prompt: "hello", json: true });
    expect(url).toContain("generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(key);
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe("application/json");
  });
  it("constructs OpenAI and DeepSeek requests", () => {
    for (const provider of ["openai", "deepseek"] as const) {
      const { url, init } = providerRequest({ provider, model: "test-model", apiKey: key, prompt: "text" });
      expect(url).toMatch(/chat\/completions/);
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer " + key);
    }
  });
  it("parses both provider response shapes", () => {
    expect(responseText("gemini", { candidates: [{ content: { parts: [{ text: "OK" }] } }] })).toBe("OK");
    expect(responseText("openai", { choices: [{ message: { content: "  fine  " } }] })).toBe("fine");
  });
  it("hides the key in API errors", async () => {
    const fake = vi.fn(async () => new Response("SECRET " + key, { status: 401 })) as unknown as typeof fetch;
    await expect(generateText({ provider: "gemini", model: "m", apiKey: key, prompt: "x" }, fake))
      .rejects.toThrow("API authentication failed");
    expect(fake).toHaveBeenCalledOnce();
  });
});
