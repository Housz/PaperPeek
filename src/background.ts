import { workspaceKey } from "./lib/tab-workspace";

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

// A tab's research state is temporary: never leave its PDF behind after closure.
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(workspaceKey(tabId)).catch(() => undefined);
});
