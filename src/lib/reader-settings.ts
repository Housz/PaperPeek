export interface ReaderSettings {
  trigger: 'direct' | 'alt' | 'ctrl';
  openMode: 'new-tab' | 'current-tab';
  navOpen: boolean;
  navWidth: number;
}
export const READER_SETTINGS_KEY = 'paperpeek.readerSettings.v1';
export const DEFAULT_READER_SETTINGS: ReaderSettings = { trigger: 'direct', openMode: 'new-tab', navOpen: false, navWidth: 260 };
export function normalizeReaderSettings(value: unknown): ReaderSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ReaderSettings>;
  return { trigger: v.trigger === 'alt' || v.trigger === 'ctrl' ? v.trigger : 'direct',
    openMode: v.openMode === 'current-tab' ? 'current-tab' : 'new-tab', navOpen: v.navOpen === true,
    navWidth: typeof v.navWidth === 'number' && Number.isFinite(v.navWidth) ? Math.min(420, Math.max(200, v.navWidth)) : 260 };
}
export async function loadReaderSettings(): Promise<ReaderSettings> {
  const data = await chrome.storage.local.get(READER_SETTINGS_KEY);
  return normalizeReaderSettings(data[READER_SETTINGS_KEY]);
}
export async function saveReaderSettings(update: Partial<ReaderSettings>): Promise<ReaderSettings> {
  const result = normalizeReaderSettings({ ...await loadReaderSettings(), ...update });
  await chrome.storage.local.set({ [READER_SETTINGS_KEY]: result });
  return result;
}
