import type { PdfAnchor, ReadingSelection, ReadingSession, ReadingPosition } from './reading-loop';
export const selectionKey = (id: string) => 'paperpeek.readerSelection.' + id;
export const positionKey = (id: string) => 'paperpeek.readerPosition.' + id;
export const anchorKey = (id: string) => 'paperpeek.readerAnchor.' + id;
export interface SelectionRequest { action: 'ask' | 'translate' | 'cite'; selection: ReadingSelection; requestId: string }
export async function loopMessage<T>(message: object): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || typeof response !== 'object') throw new Error('阅读器未能响应，请重试或重新打开插件。');
  if (response?.error) throw new Error(response.error);
  return response as T;
}
export async function openReader(workspaceTabId: number, documentId: string, sourceUrl: string | null,
  sourceTabUrl: string, sourceTabId: number, anchor?: Omit<PdfAnchor, 'sessionId' | 'documentId'>, position?: ReadingPosition, mode: "new-tab" | "current-tab" = "new-tab"): Promise<ReadingSession> {
  return loopMessage({ type: 'open-reader', workspaceTabId, documentId, sourceUrl, sourceTabUrl, sourceTabId, anchor, position, mode });
}
