import { workspaceKey } from "./tab-workspace";
import { anchorKey, positionKey, selectionKey } from "./reader-bridge";
import type { PdfAnchor } from "./anchors";
export type { PdfAnchor } from "./anchors";
export interface ReadingPosition {
  pageNumber: number;
  scrollTop: number;
  scrollLeft: number;
  scale: number;
  rotation: number;
}
export interface ReadingSelection {
  sessionId: string;
  documentId: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  anchor: PdfAnchor;
  position?: ReadingPosition; // captured when the selection is completed
  at: number;
}
export interface ReadingSession {
  sessionId: string;
  documentId: string;
  /** Synthetic stable workspace owner; independent of all real Chrome tab IDs. */
  workspaceTabId: number;
  sourceTabId?: number;
  readerTabId?: number;
  sourceUrl: string | null;
  sourceTabUrl: string;
}
export const MAX_SELECTION_CHARS = 6000;
const PREFIX = "paperpeek.readingSession.v1.";
export function readingSessionKey(id: string): string { return PREFIX + id; }
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const pending = queue.catch(() => undefined).then(operation);
  queue = pending;
  return pending;
}
async function deleteSession(session: ReadingSession): Promise<void> {
  for (const key of [readingSessionKey(session.sessionId), workspaceKey(session.workspaceTabId),
      anchorKey(session.sessionId), positionKey(session.sessionId), selectionKey(session.sessionId)]) {
    await chrome.storage.session.remove(key);
  }
}
async function sessions(): Promise<ReadingSession[]> {
  const entries = await chrome.storage.session.get(null);
  return Object.entries(entries).filter(([key]) => key.startsWith(PREFIX)).map(([, value]) => value as ReadingSession)
    .filter(s => typeof s?.sessionId === "string" && typeof s.documentId === "string" && Number.isSafeInteger(s.workspaceTabId));
}
export async function getReadingSession(id: string): Promise<ReadingSession | null> {
  const key = readingSessionKey(id);
  const entries = await chrome.storage.session.get(key);
  const session = entries[key] as ReadingSession | undefined;
  return session?.sessionId === id ? session : null;
}
export async function sessionForWorkspace(workspaceTabId: number): Promise<ReadingSession | null> {
  return (await sessions()).find(s => s.workspaceTabId === workspaceTabId) || null;
}
export async function sessionForTab(tabId: number): Promise<ReadingSession | null> {
  return (await sessions()).find(s => s.sourceTabId === tabId || s.readerTabId === tabId) || null;
}
/** Call mutations from the service worker only, so simultaneous panel/reader requests serialize. */
export function ensureReadingSession(workspaceTabId: number, documentId: string, sourceUrl: string | null, sourceTabUrl: string): Promise<ReadingSession> {
  return mutate(async () => {
    const existing = (await sessions()).find(s => s.sourceTabId === workspaceTabId && s.documentId === documentId);
    if (existing) return existing;
    // A new paper in the source tab must not inherit an old Reader's conversation.
    for (const prior of await sessions()) {
      if (prior.sourceTabId !== workspaceTabId) continue;
      delete prior.sourceTabId;
      if (prior.readerTabId === undefined) await deleteSession(prior);
      else await chrome.storage.session.set({ [readingSessionKey(prior.sessionId)]: prior });
    }
    const words = crypto.getRandomValues(new Uint32Array(2));
    const owner = 1_000_000_000_000 + (words[0] % 65536) * 4294967296 + words[1];
    const session: ReadingSession = { sessionId: crypto.randomUUID(), documentId, workspaceTabId: owner,
      sourceTabId: workspaceTabId, sourceUrl, sourceTabUrl };
    await chrome.storage.session.set({ [readingSessionKey(session.sessionId)]: session });
    return session;
  });
}
export function attachReader(id: string, readerTabId: number): Promise<ReadingSession> {
  return mutate(async () => {
    const session = await getReadingSession(id);
    if (!session) throw new Error("阅读会话已失效，请从原页面重新打开阅读器。");
    session.readerTabId = readerTabId;
    await chrome.storage.session.set({ [readingSessionKey(id)]: session });
    return session;
  });
}
export function detachSessionTab(tabId: number): Promise<{ session?: ReadingSession; deleteWorkspaceTabId?: number }> {
  return mutate(async () => {
    const session = await sessionForTab(tabId);
    if (!session) return { deleteWorkspaceTabId: tabId };
    if (session.sourceTabId === tabId) delete session.sourceTabId;
    if (session.readerTabId === tabId) delete session.readerTabId;
    if (session.sourceTabId === undefined && session.readerTabId === undefined) {
      await deleteSession(session);
      return { deleteWorkspaceTabId: session.workspaceTabId };
    }
    await chrome.storage.session.set({ [readingSessionKey(session.sessionId)]: session });
    return { session };
  });
}
export function validateSelection(selection: ReadingSelection, session: ReadingSession, totalPages: number): string | null {
  if (selection.sessionId !== session.sessionId || selection.documentId !== session.documentId ||
      selection.anchor.sessionId !== session.sessionId || selection.anchor.documentId !== session.documentId)
    return "选区不属于当前论文。";
  if (!selection.text.trim()) return "请选择有效正文文字。";
  if (selection.text.length > MAX_SELECTION_CHARS) return `选区超过 ${MAX_SELECTION_CHARS} 字符，请缩小范围。`;
  if (!Number.isSafeInteger(selection.pageStart) || !Number.isSafeInteger(selection.pageEnd) ||
      selection.pageStart < 1 || selection.pageEnd < selection.pageStart || selection.pageEnd > totalPages)
    return "无法确定选区的 PDF 物理页码。";
  return null;
}

export function validReadingPosition(p: ReadingPosition | undefined, totalPages: number): boolean {
  return !!p && Number.isSafeInteger(p.pageNumber) && p.pageNumber >= 1 && p.pageNumber <= totalPages &&
    [p.scrollTop, p.scrollLeft, p.scale, p.rotation].every(Number.isFinite) &&
    p.scrollTop >= 0 && p.scrollLeft >= 0 && p.scale > 0 && p.scale <= 10 && p.rotation % 90 === 0;
}
