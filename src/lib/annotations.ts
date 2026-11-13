import type { ChatMessage } from '../types';
import type { ReadingSelection } from './reading-loop';

/** Explicitly saved local reading discussions. Never stores keys, full PDFs or source URLs. */
export interface Annotation {
  id: string;
  documentId: string;
  selection: ReadingSelection;
  messages: ChatMessage[];
  kind: 'ask' | 'translate';
  createdAt: number;
  updatedAt: number;
}
const PREFIX = 'paperpeek.annotation.v1.';
const revisions = new WeakMap<object, string>();
let fallbackLock: Promise<unknown> = Promise.resolve();
async function locked<T>(documentId: string, fn: () => Promise<T>): Promise<T> {
  // Web Locks serialize Chrome extension pages sharing this origin, including different Readers.
  if (typeof navigator !== 'undefined' && navigator.locks?.request)
    return await navigator.locks.request('paperpeek.annotations.' + documentId, fn);
  const next = fallbackLock.catch(() => undefined).then(fn); fallbackLock = next; return next;
}
export const MAX_ANNOTATION_MESSAGES = 80;
export const MAX_ANNOTATION_TEXT = 120_000;
export function annotationKey(documentId: string, id: string): string {
  return PREFIX + encodeURIComponent(documentId) + '.' + encodeURIComponent(id);
}
function clean(value: unknown): Annotation | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Annotation;
  const s = a.selection;
  if (typeof a.id !== 'string' || !a.id || a.id.length > 150 || typeof a.documentId !== 'string' || !a.documentId || a.documentId.length > 150 ||
      !s || s.documentId !== a.documentId || !s.anchor || s.anchor.documentId !== a.documentId ||
      typeof s.text !== 'string' || !s.text.trim() || s.text.length > 6000 ||
      !Number.isSafeInteger(s.pageStart) || s.pageStart < 1 || !Number.isSafeInteger(s.pageEnd) || s.pageEnd < s.pageStart ||
      !Number.isSafeInteger(s.anchor.pageNumber) || s.anchor.pageNumber < 1 ||
      !Array.isArray(a.messages) || a.messages.length > MAX_ANNOTATION_MESSAGES ||
      !['ask', 'translate'].includes(a.kind) || !Number.isFinite(a.createdAt) || !Number.isFinite(a.updatedAt)) return null;
  const messages: ChatMessage[] = [];
  let length = 0;
  for (const m of a.messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string') return null;
    length += m.text.length;
    if (length > MAX_ANNOTATION_TEXT) return null;
    messages.push({ role: m.role, text: m.text });
  }
  // Whitelist the persisted shape so unrelated metadata (especially credentials) cannot leak.
  return { id: a.id, documentId: a.documentId, kind: a.kind, createdAt: a.createdAt, updatedAt: a.updatedAt, messages,
    selection: { sessionId: String(s.sessionId || ''), documentId: a.documentId, text: s.text,
      pageStart: s.pageStart, pageEnd: s.pageEnd, at: Number.isFinite(s.at) ? s.at : a.createdAt,
      anchor: { sessionId: String(s.anchor.sessionId || ''), documentId: a.documentId, pageNumber: s.anchor.pageNumber,
        exactQuote: typeof s.anchor.exactQuote === 'string' ? s.anchor.exactQuote.slice(0, 6000) : undefined,
        prefix: typeof s.anchor.prefix === 'string' ? s.anchor.prefix.slice(0, 1000) : undefined,
        suffix: typeof s.anchor.suffix === 'string' ? s.anchor.suffix.slice(0, 1000) : undefined,
        verification: ['quote-verified', 'page-only', 'model-hint'].includes(s.anchor.verification) ? s.anchor.verification : 'page-only' } } };
}
export async function loadAnnotations(documentId: string): Promise<Annotation[]> {
  const prefix = PREFIX + encodeURIComponent(documentId) + '.';
  const values = await chrome.storage.local.get(null);
  return Object.entries(values).filter(([k]) => k.startsWith(prefix)).map(([,v]) => {
    const a = clean(v); if (a) revisions.set(a, String((v as {revision?:string}).revision || 'legacy')); return a;
  })
    .filter((a): a is Annotation => !!a && a.documentId === documentId).sort((a,b) => a.createdAt - b.createdAt);
}
export async function saveAnnotation(record: Annotation): Promise<void> {
  const value = clean(record);
  if (!value) throw new Error('讨论内容无效或过长，请新建讨论。');
  await locked(value.documentId, async () => {
    const key = annotationKey(value.documentId, value.id);
    const prior = (await chrome.storage.local.get(key))[key] as { revision?: string } | undefined;
    const expected = revisions.get(record);
    if ((prior && expected !== String(prior.revision || 'legacy')) || (!prior && expected))
      throw new Error('讨论已在另一个窗口更新或删除，请重新打开讨论；当前内容可先复制保存。');
    const revision = crypto.randomUUID();
    await chrome.storage.local.set({ [key]: { ...value, revision } });
    revisions.set(record, revision);
  });
}
export async function deleteAnnotation(documentId: string, id: string): Promise<void> {
  await locked(documentId, () => chrome.storage.local.remove(annotationKey(documentId, id)));
}
export async function clearAnnotations(documentId: string): Promise<void> {
  const prefix = PREFIX + encodeURIComponent(documentId) + '.';
  await locked(documentId, async () => {
    const values = await chrome.storage.local.get(null);
    const keys = Object.keys(values).filter(k => k.startsWith(prefix));
    if (keys.length) await chrome.storage.local.remove(keys);
  });
}
