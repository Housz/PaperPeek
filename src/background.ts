import { ensureReadingSession, getReadingSession, attachReader, detachSessionTab, validateSelection, validReadingPosition, sessionForTab } from "./lib/reading-loop";
import { anchorKey, positionKey, selectionKey, type SelectionRequest } from "./lib/reader-bridge";
import { saveTabWorkspace, unpackWorkspace, workspaceKey, workspaceMatchesTab, blankWorkspace } from "./lib/tab-workspace";

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "paperpeek-selection",
    title: "Explain with PaperPeek",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "paperpeek-selection" || !info.selectionText?.trim()) return;
  // Opening occurs inside the user gesture. Selection is short-lived session data.
  if (tab?.windowId !== undefined) {
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined);
  }
  void chrome.storage.session.set({
    "paperpeek.selection": {
      text: info.selectionText.slice(0, 2000),
      tabId: tab?.id,
      url: tab?.url,
      at: Date.now()
    }
  });
});

let opening: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = opening.catch(() => undefined).then(operation);
  opening = result;
  return result;
}

// Keep a session while either its source or Reader is alive.
chrome.tabs.onRemoved.addListener((tabId) => {
  void enqueue(async () => {
    const result = await detachSessionTab(tabId);
    if (result.deleteWorkspaceTabId !== undefined) await chrome.storage.session.remove(workspaceKey(result.deleteWorkspaceTabId));
    await chrome.storage.session.remove(workspaceKey(tabId));
  }).catch(() => undefined);
});

// Only extension pages can submit reading-loop events. No external/content message API.
const trusted = (sender: chrome.runtime.MessageSender) => sender.id === chrome.runtime.id &&
  !!sender.url?.startsWith(chrome.runtime.getURL(''));
function isReaderUrl(url: string | undefined, id: string): boolean {
  if (!url) return false;
  try { const parsed = new URL(url); return parsed.href.split(/[?#]/)[0] === chrome.runtime.getURL('reader.html') && parsed.searchParams.get('session') === id; }
  catch { return false; }
}
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url) return;
  void enqueue(async () => {
    const session = await sessionForTab(tabId);
    if (!session) return;
    const matches = session.readerTabId === tabId ? isReaderUrl(change.url, session.sessionId) :
      workspaceMatchesTab({ ...blankWorkspace(session.workspaceTabId, session.sourceTabUrl), selectedPdfUrl: session.sourceUrl }, change.url!);
    if (!matches) await detachSessionTab(tabId);
  }).catch(() => undefined);
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!trusted(sender) || !message || typeof message.type !== 'string' ||
      !['open-reader','reader-ready','reader-selection','reader-position','reader-detach','reader-consume'].includes(message.type)) return;
  const execute = async () => {
    if (message.type === 'open-reader') {
      if (sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('sidepanel.html') ||
          typeof message.documentId !== 'string' || !message.documentId ||
          !Number.isSafeInteger(message.sourceTabId) || message.sourceTabId < 0 ||
          !Number.isSafeInteger(message.workspaceTabId) || message.workspaceTabId < 0)
        throw new Error('无效的阅读器打开请求。');
      const original = await unpackWorkspace((await chrome.storage.session.get(workspaceKey(message.workspaceTabId)))[workspaceKey(message.workspaceTabId)]);
      if (!original?.paper || original.paper.documentId !== message.documentId) throw new Error('当前 PDF 身份已改变，请重新打开阅读器。');
      const linked = await sessionForTab(message.sourceTabId);
      if (message.workspaceTabId !== message.sourceTabId && linked?.workspaceTabId !== message.workspaceTabId)
        throw new Error('阅读工作区与来源不匹配。');
      const session = linked && linked.documentId === message.documentId && linked.workspaceTabId === message.workspaceTabId ? linked :
        await ensureReadingSession(message.sourceTabId, message.documentId, original.paper.sourceUrl, original.tabUrl);
      if (message.anchor && (!Number.isSafeInteger(message.anchor.pageNumber) || message.anchor.pageNumber < 1 ||
          message.anchor.pageNumber > original.paper.totalPages ||
          (message.anchor.exactQuote !== undefined && (typeof message.anchor.exactQuote !== 'string' || message.anchor.exactQuote.length > 12000))))
        throw new Error('无效的 PDF 页码或引文。');
      if (message.position && !validReadingPosition(message.position, original.paper.totalPages)) throw new Error('无效的选区阅读位置。');
      if (message.position) {
        await chrome.storage.session.set({ [positionKey(session.sessionId)]: message.position });
        await chrome.storage.session.remove(anchorKey(session.sessionId));
      }
      if (session.workspaceTabId !== message.workspaceTabId)
        await saveTabWorkspace({ ...original, tabId: session.workspaceTabId });
      if (message.anchor) await chrome.storage.session.set({ [anchorKey(session.sessionId)]:
        { ...message.anchor, sessionId: session.sessionId, documentId: session.documentId } });
      let reader: chrome.tabs.Tab | undefined;
      if (session.readerTabId !== undefined) {
        try { reader = await chrome.tabs.get(session.readerTabId); } catch { /* Closed reader. */ }
      }
      if (!reader || !isReaderUrl(reader.url, session.sessionId)) {
        reader = await chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') + '?session=' + encodeURIComponent(session.sessionId), active: true });
        if (reader.id === undefined) throw new Error('无法打开阅读器。');
        await attachReader(session.sessionId, reader.id);
      } else {
        await chrome.tabs.update(reader.id!, { active: true });
        if (message.position) void chrome.runtime.sendMessage({ type: 'reader-return', sessionId: session.sessionId, documentId: session.documentId, position: message.position }).catch(() => undefined);
        else if (message.anchor) void chrome.runtime.sendMessage({ type: 'reader-navigate', sessionId: session.sessionId,
          documentId: session.documentId, anchor: { ...message.anchor, sessionId: session.sessionId, documentId: session.documentId } }).catch(() => undefined);
      }
      return { ...session, readerTabId: reader.id };
    }
    if (message.type === 'reader-detach') {
      if (sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('sidepanel.html') || !Number.isSafeInteger(message.tabId))
        throw new Error('无效的会话请求。');
      return detachSessionTab(message.tabId);
    }
    if (message.type === 'reader-consume') {
      if (sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('sidepanel.html') || typeof message.sessionId !== 'string')
        throw new Error('无效的选区请求。');
      const key = selectionKey(message.sessionId);
      const pending = (await chrome.storage.session.get(key))[key] as SelectionRequest | undefined;
      if (pending?.requestId === message.requestId) {
        await chrome.storage.session.remove(key); return { consumed: true };
      }
      return { consumed: false };
    }
    const id = message.sessionId || message.selection?.sessionId;
    const session = await getReadingSession(id);
    if (!session || sender.tab?.id !== session.readerTabId || !isReaderUrl(sender.url, session.sessionId)) throw new Error('阅读会话已失效。');
    const workspace = await unpackWorkspace((await chrome.storage.session.get(workspaceKey(session.workspaceTabId)))[workspaceKey(session.workspaceTabId)]);
    if (message.type === 'reader-ready') {
      const entries = await chrome.storage.session.get([anchorKey(id), positionKey(id)]);
      await chrome.storage.session.remove(anchorKey(id));
      return { sessionId: id, documentId: session.documentId, sourceUrl: session.sourceUrl,
        title: workspace?.paper?.title, anchor: entries[anchorKey(id)], position: entries[positionKey(id)] };
    }
    if (message.documentId !== session.documentId) throw new Error('PDF 身份不匹配。');
    if (message.type === 'reader-position') {
      const p = message.position;
      if (!p || !Number.isSafeInteger(p.pageNumber) || p.pageNumber < 1 || p.pageNumber > (workspace?.paper?.totalPages || 0) ||
          ![p.scrollTop, p.scrollLeft, p.scale, p.rotation].every(Number.isFinite) || p.scale <= 0 || p.scale > 10 ||
          p.scrollTop < 0 || p.scrollLeft < 0 || p.rotation % 90 !== 0) throw new Error('无效的阅读位置。');
      await chrome.storage.session.set({ [positionKey(id)]: message.position }); return { ok: true };
    }
    const error = validateSelection(message.selection, session, workspace?.paper?.totalPages || 0);
    if (error) throw new Error(error);
    if (message.action !== 'ask' && message.action !== 'translate') throw new Error('未知选区操作。');
    const position = message.selection.position || message.position;
    if (position && !validReadingPosition(position, workspace?.paper?.totalPages || 0)) throw new Error('无效的选区阅读位置。');
    const request: SelectionRequest = { action: message.action, selection: { ...message.selection, position }, requestId: crypto.randomUUID() };
    await chrome.storage.session.set({ [selectionKey(id)]: request });
    return { ok: true };
  };
  const operation = enqueue(execute);
  void operation.then(respond, error => respond({ error: error instanceof Error ? error.message : '阅读器请求失败。' }));
  return true;
});
