import type { Provider, Settings } from "../types";
import { DEFAULT_MODELS } from "../types";

const SETTINGS = "paperpeek.settings";
const LOCAL_KEY = "paperpeek.savedApiKey";
const SESSION_KEY = "paperpeek.sessionApiKey";
export interface Credentials extends Settings { apiKey: string }

export async function loadCredentials(): Promise<Credentials> {
  const stored = await chrome.storage.local.get([SETTINGS, LOCAL_KEY]);
  const settings = (stored[SETTINGS] || {}) as Partial<Settings>;
  const provider: Provider = ["gemini", "openai", "deepseek"].includes(settings.provider || "")
    ? settings.provider as Provider : "gemini";
  const current = await chrome.storage.session.get(SESSION_KEY);
  const key = current[SESSION_KEY] as string | undefined;
  return {
    provider,
    model: settings.model || DEFAULT_MODELS[provider],
    rememberKey: !!settings.rememberKey,
    apiKey: key || (settings.rememberKey ? (stored[LOCAL_KEY] as string || "") : "")
  };
}

export async function saveCredentials(input: Credentials): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS]: { provider: input.provider, model: input.model, rememberKey: input.rememberKey }
  });
  await chrome.storage.session.set({ [SESSION_KEY]: input.apiKey });
  if (input.rememberKey) await chrome.storage.local.set({ [LOCAL_KEY]: input.apiKey });
  else await chrome.storage.local.remove(LOCAL_KEY);
}
