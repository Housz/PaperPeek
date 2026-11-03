import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetProviderKey, loadCredentials, saveCredentials } from "../src/lib/storage";

function mockArea(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn(async (keys: string | string[]) => {
      const requested = typeof keys === "string" ? [keys] : keys;
      const result: Record<string, unknown> = {};
      for (const key of requested) if (key in data) result[key] = data[key];
      return result;
    }),
    set: vi.fn(async (input: Record<string, unknown>) => Object.assign(data, input)),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of typeof keys === "string" ? [keys] : keys) delete data[key];
    })
  };
}

let local: ReturnType<typeof mockArea>;
let session: ReturnType<typeof mockArea>;

beforeEach(() => {
  local = mockArea(); session = mockArea();
  vi.stubGlobal("chrome", { storage: { local, session } });
});

describe("provider-isolated BYOK storage", () => {
  it("preserves separate provider keys without mixing", async () => {
    await saveCredentials({
      provider: "openai", model: "gpt-4.1-mini", apiKey: "openai-test-only",
      rememberKey: true
    });
    await saveCredentials({
      provider: "deepseek", model: "deepseek-flash", apiKey: "deepseek-test-only",
      rememberKey: false
    });
    expect((await loadCredentials("openai")).apiKey).toBe("openai-test-only");
    expect((await loadCredentials("deepseek")).apiKey).toBe("deepseek-test-only");
    expect((await loadCredentials("gemini")).apiKey).toBe("");
    expect((await loadCredentials()).provider).toBe("deepseek");
  });
  it("persists only explicit opted-in keys after session is cleared", async () => {
    await saveCredentials({
      provider: "openai", model: "gpt-4.1-mini", apiKey: "openai-durable",
      rememberKey: true
    });
    await saveCredentials({
      provider: "deepseek", model: "deepseek-flash", apiKey: "deepseek-session",
      rememberKey: false
    });
    session.data["paperpeek.sessionKeys.v2"] = {};
    expect((await loadCredentials("openai")).apiKey).toBe("openai-durable");
    expect((await loadCredentials("deepseek")).apiKey).toBe("");
  });
  it("can revoke only the chosen provider's saved credential", async () => {
    await saveCredentials({
      provider: "openai", model: "gpt-4.1-mini", apiKey: "remove-me",
      rememberKey: true
    });
    await saveCredentials({
      provider: "deepseek", model: "deepseek-flash", apiKey: "keep-me",
      rememberKey: true
    });
    await forgetProviderKey("openai");
    expect((await loadCredentials("openai")).apiKey).toBe("");
    expect((await loadCredentials("deepseek")).apiKey).toBe("keep-me");
  });
  it("migrates legacy single-provider settings safely", async () => {
    local.data["paperpeek.settings"] = {
      provider: "deepseek", model: "deepseek-chat", rememberKey: true
    };
    local.data["paperpeek.savedApiKey"] = "legacy-test-key";
    expect((await loadCredentials()).apiKey).toBe("legacy-test-key");
    expect((await loadCredentials("openai")).apiKey).toBe("");
    expect(local.data["paperpeek.savedApiKey"]).toBeUndefined();
  });
});
