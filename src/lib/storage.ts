import type { Provider, Settings } from "../types";
import { DEFAULT_MODELS, PROVIDERS } from "../types";

export interface Credentials extends Settings { apiKey: string }
interface StoredProfile { model: string; rememberKey: boolean }
interface StoredState {
  selected: Provider;
  profiles: Partial<Record<Provider, StoredProfile>>;
}
const PROFILE_KEY = "paperpeek.profileSettings.v2";
const LOCAL_KEYS = "paperpeek.savedKeys.v2";
const SESSION_KEYS = "paperpeek.sessionKeys.v2";
const LEGACY_SETTINGS = "paperpeek.settings";
const LEGACY_LOCAL = "paperpeek.savedApiKey";
const LEGACY_SESSION = "paperpeek.sessionApiKey";

function validProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.includes(value as Provider);
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function keyMap(value: unknown): Partial<Record<Provider, string>> {
  const data = object(value);
  const result: Partial<Record<Provider, string>> = {};
  for (const provider of PROVIDERS) {
    if (typeof data[provider] === "string") result[provider] = data[provider] as string;
  }
  return result;
}
function readState(value: unknown): StoredState {
  const data = object(value);
  const rawProfiles = object(data.profiles);
  const profiles: StoredState["profiles"] = {};
  for (const provider of PROVIDERS) {
    const profile = object(rawProfiles[provider]);
    profiles[provider] = {
      model: typeof profile.model === "string" && profile.model.trim()
        ? profile.model : DEFAULT_MODELS[provider],
      rememberKey: profile.rememberKey === true
    };
  }
  return { selected: validProvider(data.selected) ? data.selected : "deepseek", profiles };
}

/**
 * One-time transition from old single-key storage to independent provider profiles.
 * Never copy a Gemini/DeepSeek secret to another provider.
 */
async function stateWithMigration(): Promise<StoredState> {
  const local = await chrome.storage.local.get([PROFILE_KEY, LEGACY_SETTINGS, LEGACY_LOCAL]);
  if (local[PROFILE_KEY]) return readState(local[PROFILE_KEY]);

  const legacy = object(local[LEGACY_SETTINGS]);
  const provider = validProvider(legacy.provider) ? legacy.provider : "deepseek";
  const state = readState({ selected: provider, profiles: {
    [provider]: {
      model: typeof legacy.model === "string" ? legacy.model : DEFAULT_MODELS[provider],
      rememberKey: legacy.rememberKey === true
    }
  } });
  const oldSession = await chrome.storage.session.get(LEGACY_SESSION);
  const oldSessionKey = oldSession[LEGACY_SESSION];
  const oldLocalKey = local[LEGACY_LOCAL];
  const key = typeof oldSessionKey === "string" && oldSessionKey
    ? oldSessionKey : (typeof oldLocalKey === "string" ? oldLocalKey : "");
  const keys = key ? { [provider]: key } : {};
  await chrome.storage.local.set({
    [PROFILE_KEY]: state,
    [LOCAL_KEYS]: state.profiles[provider]?.rememberKey ? keys : {}
  });
  await chrome.storage.session.set({ [SESSION_KEYS]: keys });
  await Promise.all([
    chrome.storage.local.remove([LEGACY_SETTINGS, LEGACY_LOCAL]),
    chrome.storage.session.remove(LEGACY_SESSION)
  ]);
  return state;
}

export async function loadCredentials(provider?: Provider): Promise<Credentials> {
  const state = await stateWithMigration();
  const target = provider || state.selected;
  const config = state.profiles[target] || {
    model: DEFAULT_MODELS[target], rememberKey: false
  };
  const [local, session] = await Promise.all([
    chrome.storage.local.get(LOCAL_KEYS),
    chrome.storage.session.get(SESSION_KEYS)
  ]);
  const durable = keyMap(local[LOCAL_KEYS]);
  const temporary = keyMap(session[SESSION_KEYS]);
  return {
    provider: target,
    model: config.model || DEFAULT_MODELS[target],
    rememberKey: config.rememberKey,
    apiKey: temporary[target] || (config.rememberKey ? durable[target] || "" : "")
  };
}

export async function saveCredentials(input: Credentials): Promise<void> {
  const state = await stateWithMigration();
  state.selected = input.provider;
  state.profiles[input.provider] = {
    model: input.model.trim() || DEFAULT_MODELS[input.provider],
    rememberKey: input.rememberKey
  };
  const [local, session] = await Promise.all([
    chrome.storage.local.get(LOCAL_KEYS),
    chrome.storage.session.get(SESSION_KEYS)
  ]);
  const durable = keyMap(local[LOCAL_KEYS]);
  const temporary = keyMap(session[SESSION_KEYS]);
  temporary[input.provider] = input.apiKey.trim();
  if (input.rememberKey) durable[input.provider] = input.apiKey.trim();
  else delete durable[input.provider];
  await chrome.storage.local.set({ [PROFILE_KEY]: state, [LOCAL_KEYS]: durable });
  await chrome.storage.session.set({ [SESSION_KEYS]: temporary });
}

export async function forgetProviderKey(provider: Provider): Promise<void> {
  const state = await stateWithMigration();
  if (state.profiles[provider]) state.profiles[provider]!.rememberKey = false;
  const [local, session] = await Promise.all([
    chrome.storage.local.get(LOCAL_KEYS),
    chrome.storage.session.get(SESSION_KEYS)
  ]);
  const durable = keyMap(local[LOCAL_KEYS]);
  const temporary = keyMap(session[SESSION_KEYS]);
  delete durable[provider]; delete temporary[provider];
  await chrome.storage.local.set({ [PROFILE_KEY]: state, [LOCAL_KEYS]: durable });
  await chrome.storage.session.set({ [SESSION_KEYS]: temporary });
}
