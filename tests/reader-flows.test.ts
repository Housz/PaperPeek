// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "sidepanel.html"), "utf8");
const mock = vi.hoisted(() => ({
  generate: vi.fn(),
  parse: vi.fn()
}));
vi.mock("../src/lib/document", () => ({
  fetchPdf: vi.fn(async () => new ArrayBuffer(64)),
  parsePdf: (...args: unknown[]) => mock.parse(...args)
}));
vi.mock("../src/lib/provider", () => ({
  generateText: (...args: unknown[]) => mock.generate(...args),
  listModels: vi.fn(async () => [])
}));
vi.mock("../src/lib/storage", () => ({
  loadCredentials: vi.fn(async () => ({
    provider: "deepseek", model: "deepseek-flash",
    rememberKey: false, apiKey: "dummy-test-only"
  })),
  saveCredentials: vi.fn(async () => undefined),
  forgetProviderKey: vi.fn(async () => undefined)
}));

interface FakeTab { id: number; url: string }
let activeTab: FakeTab;
let storage: Record<string, unknown>;
let events: {
  activated: Array<(info: {tabId: number}) => void>;
  updated: Array<(id: number, info: {url?: string; status?: string}) => void>;
  removed: Array<(id: number) => void>;
  storage: Array<(changes: Record<string, unknown>, area: string) => void>;
};
const digest = JSON.stringify({
  tldr: "本文提出新的方法。", problem: "解决研究问题。",
  approach: ["方法 A"], findings: [{
    text: "实验支持了主要结论。",
    page: 2, quote: "Results improved accuracy on three datasets."
  }],
  limitations: ["样本规模有限"], keywords: ["method"]
});

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error("Missing " + id);
  return value as T;
}
function setupFakeChrome(): void {
  events = { activated: [], updated: [], removed: [], storage: [] };
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension-id", getURL: (path: string) => 'chrome-extension://test-extension-id/' + path,
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(async (message: Record<string, any>) => {
        if (message.type === 'open-reader') {
          const session = { sessionId: 'session-' + message.sourceTabId, documentId: message.documentId,
            workspaceTabId: message.workspaceTabId, sourceTabId: message.sourceTabId,
            readerTabId: message.sourceTabId + 1000, sourceUrl: message.sourceUrl, sourceTabUrl: message.sourceTabUrl };
          storage['paperpeek.readingSession.v1.' + session.sessionId] = session;
          return session;
        }
        if (message.type === 'reader-consume') {
          const key = 'paperpeek.readerSelection.' + message.sessionId;
          const request = storage[key] as { requestId?: string } | undefined;
          if (request?.requestId !== message.requestId) return { consumed: false };
          delete storage[key]; return { consumed: true };
        }
        return {};
      })
    },
    tabs: {
      query: vi.fn(async () => [{ ...activeTab }]),
      update: vi.fn(async (_id: number, change: {url?: string}) => {
        if (change.url) {
          activeTab.url = change.url;
          for (const callback of events.updated) callback(activeTab.id, { url: change.url });
        }
        return { ...activeTab };
      }),
      create: vi.fn(async () => undefined),
      onActivated: { addListener: (callback: (info: {tabId: number}) => void) =>
        events.activated.push(callback) },
      onUpdated: { addListener: (callback: (id: number, info: {url?: string}) => void) =>
        events.updated.push(callback) },
      onRemoved: { addListener: (callback: (id: number) => void) =>
        events.removed.push(callback) }
    },
    storage: {
      session: {
        get: vi.fn(async (keys: string | string[] | null) => {
          if (keys === null) return { ...storage };
          const names = typeof keys === "string" ? [keys] : keys;
          return Object.fromEntries(names.filter(key => key in storage).map(key => [key, storage[key]]));
        }),
        set: vi.fn(async (next: Record<string, unknown>) => Object.assign(storage, next)),
        remove: vi.fn(async (key: string) => { delete storage[key]; })
      },
      onChanged: { addListener: (cb: (changes: Record<string, unknown>, area: string) => void) => events.storage.push(cb) }
    },
    extension: { isAllowedFileSchemeAccess: vi.fn(async () => true) },
    permissions: {
      contains: vi.fn(async () => true),
      request: vi.fn(async () => true)
    },
    scripting: { executeScript: vi.fn(async () => []) }
  });
}

async function mountSidePanel(): Promise<void> {
  vi.resetModules();
  const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) throw new Error("No side panel body.");
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");
  setupFakeChrome();
  await import("../src/main");
  await vi.waitFor(() => expect(byId("paperTitle").textContent).toBeTruthy());
}
function setTab(id: number, url: string): void {
  activeTab = { id, url };
  for (const callback of events.activated) callback({ tabId: id });
}
function click(id: string): void { byId<HTMLButtonElement>(id).click(); }
async function analyzed(): Promise<void> {
  await vi.waitFor(() => {
    expect(byId("overviewContent").hidden).toBe(false);
    expect(byId("cardText") as HTMLTextAreaElement).toHaveProperty("value", expect.stringContaining("## TL;DR"));
  }, { timeout: 10000 });
}
async function openLoop(): Promise<void> {
  await mountSidePanel();
  await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
  click("analyzeBtn"); await analyzed(); click("openReaderBtn");
  await vi.waitFor(() => expect(storage['paperpeek.readingSession.v1.session-101']).toBeDefined());
  await new Promise(resolve => setTimeout(resolve, 30));
}
function selectionRequest(action: 'ask' | 'translate', id = 'selection-1'): void {
  const sessionId = 'session-101', documentId = 'sha256:paper-a';
  const request = { action, requestId: id, selection: { sessionId, documentId,
    text: 'Results improved accuracy on three datasets.', pageStart: 2, pageEnd: 2, at: Date.now(),
    anchor: { sessionId, documentId, pageNumber: 2, exactQuote: 'Results improved accuracy on three datasets.', verification: 'quote-verified' } } };
  const key = 'paperpeek.readerSelection.' + sessionId; storage[key] = request;
  for (const callback of events.storage) callback({ [key]: { newValue: request } }, 'session');
}
beforeEach(() => {
  vi.clearAllMocks();
  storage = {};
  activeTab = { id: 101, url: "https://arxiv.org/pdf/2601.00001" };
  mock.parse.mockImplementation(async (_bytes: ArrayBuffer, url: string | null) => ({
    id: url?.includes("2601.00002") ? "paper-b" : "paper-a",
    title: url?.includes("2601.00002") ? "Paper B" : "Paper A",
    documentId: url?.includes("2601.00002") ? "sha256:paper-b" : "sha256:paper-a",
    sourceUrl: url,
    totalPages: 2, truncated: false,
    pages: [
      { page: 1, text: "A scientific approach with experiments." },
      { page: 2, text: "Results improved accuracy on three datasets." }
    ]
  }));
  mock.generate.mockImplementation(async ({ prompt }: {prompt: string}) =>
    prompt.includes('"tldr"') ? digest : "The experiments confirm Method A. [PDF p.2]");
});

describe("reader journeys (actual Side Panel DOM with mocked Chrome/API)", () => {
  it("analyze A → ask → switch to B → return to A → reopen panel", async () => {
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();

    click("tab-ask");
    const input = byId<HTMLTextAreaElement>("askInput");
    input.value = "What does the experiment prove?";
    byId<HTMLFormElement>("askForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(document.querySelectorAll(".message.assistant").length).toBe(1));

    input.value = "Follow-up draft (not sent)";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setTab(102, "https://arxiv.org/pdf/2601.00002");
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00002"));
    expect(byId("overviewContent").hidden).toBe(true);

    setTab(101, "https://arxiv.org/pdf/2601.00001#page=2");
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toBe("Paper A"));
    expect(byId("overviewContent").hidden).toBe(false);
    expect(document.querySelectorAll(".message.assistant")).toHaveLength(1);
    expect(byId<HTMLTextAreaElement>("askInput").value).toBe("Follow-up draft (not sent)");
    expect(byId("view-ask").hidden).toBe(false);
    expect(byId<HTMLTextAreaElement>("cardText").value).toContain("## Key Findings");

    // Reload just the Side Panel, not the research tab. All work must be restored.
    await vi.waitFor(() => expect(storage["paperpeek.tabWorkspace.v1.101"]).toBeDefined());
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toBe("Paper A"));
    expect(byId<HTMLTextAreaElement>("cardText").value).toContain("Paper A");
    expect(byId<HTMLTextAreaElement>("askInput").value).toBe("Follow-up draft (not sent)");
  });

  it("does not put A's delayed analysis into B while A is offscreen", async () => {
    let complete!: (value: string) => void;
    mock.generate.mockImplementation(({ prompt }: { prompt: string }) =>
      prompt.includes('"tldr"') ? new Promise<string>(resolve => { complete = resolve; })
        : Promise.resolve("Answer"));
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    setTab(102, "https://arxiv.org/pdf/2601.00002");
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00002"));
    complete(digest);
    await vi.waitFor(() => expect(storage["paperpeek.tabWorkspace.v1.101"]).toBeDefined());
    setTab(101, "https://arxiv.org/pdf/2601.00001");
    await analyzed();
    expect(byId("paperTitle").textContent).toBe("Paper A");
    expect(byId<HTMLTextAreaElement>("cardText").value).toContain("## TL;DR");
  });

  it("same-tab navigation to a different paper invalidates old digest", async () => {
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();
    activeTab.url = "https://arxiv.org/pdf/2601.00002";
    for (const callback of events.updated) callback(101, { url: activeTab.url });
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00002"));
    expect(byId("overviewContent").hidden).toBe(true);
    expect(byId<HTMLTextAreaElement>("cardText").value).toBe("");
  });

  it("keeps paper work through citation jumps and opening model settings", async () => {
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();
    const citation = document.querySelector<HTMLButtonElement>(".digest-section .page-link");
    expect(citation).not.toBeNull();
    citation!.click();
    await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'open-reader', anchor: expect.objectContaining({ pageNumber: 2, verification: 'quote-verified' })
    })));
    expect(activeTab.url).toBe('https://arxiv.org/pdf/2601.00001');
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(byId("overviewContent").hidden).toBe(false);
    expect(byId<HTMLTextAreaElement>("cardText").value).toContain("Paper A");

    click("tab-ask");
    click("settingsToggle");
    expect(byId("view-settings").hidden).toBe(false);
    expect(document.querySelector('svg[data-icon="settings"]')).not.toBeNull();
    click("settingsBack");
    expect(byId("view-ask").hidden).toBe(false);
    expect(byId<HTMLTextAreaElement>("cardText").value).toContain("Paper A");
    expect(byId("modelStatus").textContent).toBe("DeepSeek · deepseek-flash");
    expect(byId("modelStatus").title).toContain("当前用于新请求的模型");
  });

  it("keeps a delayed Q&A response with the original tab, not the current tab", async () => {
    let complete!: (value: string) => void;
    mock.generate.mockImplementation(({ prompt }: { prompt: string }) =>
      prompt.includes('"tldr"') ? Promise.resolve(digest)
        : new Promise<string>(resolve => { complete = resolve; }));
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();
    click("tab-ask");
    byId<HTMLTextAreaElement>("askInput").value = "Explain this experiment";
    byId<HTMLFormElement>("askForm").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    setTab(102, "https://arxiv.org/pdf/2601.00002");
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00002"));
    complete("A's completed explanation");
    setTab(101, "https://arxiv.org/pdf/2601.00001");
    await vi.waitFor(() =>
      expect(document.querySelector(".message.assistant")?.textContent)
        .toContain("A's completed explanation")
    );
    setTab(102, "https://arxiv.org/pdf/2601.00002");
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00002"));
    expect(document.querySelector(".message.assistant")).toBeNull();
  });

  it("shows the exact saved model ID in the shared top-header status", async () => {
    await mountSidePanel();
    await vi.waitFor(() =>
      expect(byId("modelStatus").textContent).toBe("DeepSeek · deepseek-flash"));
    click("settingsToggle");
    const picker = byId<HTMLSelectElement>("modelSelect");
    picker.value = "__custom__";
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    const modelId = byId<HTMLInputElement>("modelInput");
    modelId.value = "deepseek-v4-pro";
    byId<HTMLFormElement>("settingsForm").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(byId("modelStatus").textContent).toBe("DeepSeek · deepseek-v4-pro"));
    expect(byId("modelStatus").title).toContain("deepseek-v4-pro");
  });


  it("renders assistant Markdown while preserving PDF page-hint links", async () => {
    mock.generate.mockImplementation(async ({ prompt }: { prompt: string }) =>
      prompt.includes('"tldr"')
        ? digest
        : "## 实验结果\n\n**显著提升**（attention mechanism）[PDF p.2]\n\n- 验证点 A\n- 验证点 B");
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();
    click("tab-ask");
    byId<HTMLTextAreaElement>("askInput").value = "解释实验结果";
    byId<HTMLFormElement>("askForm").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await vi.waitFor(() => expect(document.querySelector(".message.assistant h2")?.textContent)
      .toBe("实验结果"));
    expect(document.querySelector(".message.assistant strong")?.textContent).toBe("显著提升");
    expect(document.querySelectorAll(".message.assistant li")).toHaveLength(2);
    expect(document.querySelector(".message.assistant .page-link")?.textContent)
      .toContain("PDF p.2");
    expect(document.querySelector(".message.assistant")?.textContent).not.toContain("## 实验结果");
  });

  it("shows rendered Paper Card by default and exports unchanged Markdown source", async () => {
    await mountSidePanel();
    await vi.waitFor(() => expect(byId("paperTitle").textContent).toContain("2601.00001"));
    click("analyzeBtn");
    await analyzed();
    click("tab-card");
    const preview = byId("cardPreview");
    const source = byId<HTMLTextAreaElement>("cardText");
    const button = byId<HTMLButtonElement>("cardModeBtn");
    expect(preview.hidden).toBe(false);
    expect(source.hidden).toBe(true);
    expect(preview.querySelector("h1")?.textContent).toBe("Paper A");
    expect(preview.querySelector("h2")?.textContent).toBe("TL;DR");
    const original = source.value;
    expect(original).toContain("## TL;DR");
    click("cardModeBtn");
    expect(preview.hidden).toBe(true);
    expect(source.hidden).toBe(false);
    expect(source.value).toBe(original);
    click("cardModeBtn");
    expect(preview.hidden).toBe(false);
    expect(source.value).toBe(original);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it('selection Ask stages source without AI and protects an existing draft', async () => {
    await openLoop(); const calls = mock.generate.mock.calls.length;
    selectionRequest('ask');
    await vi.waitFor(() => expect(byId('selectionDraft').hidden).toBe(false));
    expect(mock.generate).toHaveBeenCalledTimes(calls);
    expect(byId('selectionDraft').textContent).toContain('Results improved accuracy');
    byId<HTMLTextAreaElement>('askInput').value = 'Keep my edited question';
    selectionRequest('ask', 'selection-2');
    await vi.waitFor(() => expect(byId('pendingSelection').hidden).toBe(false));
    expect(byId<HTMLTextAreaElement>('askInput').value).toBe('Keep my edited question');
    const keep = [...byId('pendingSelection').querySelectorAll('button')].find(b => b.textContent === '保留当前草稿')!;
    keep.click();
    expect(byId<HTMLTextAreaElement>('askInput').value).toBe('Keep my edited question');
    expect(mock.generate).toHaveBeenCalledTimes(calls);
  });

  it('explicit selection Translate makes one request and routes delayed answer to A only', async () => {
    await openLoop(); const calls = mock.generate.mock.calls.length;
    let complete!: (text: string) => void;
    mock.generate.mockImplementation(() => new Promise<string>(resolve => { complete = resolve; }));
    selectionRequest('translate');
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    expect(mock.generate).toHaveBeenCalledTimes(calls + 1);
    setTab(102, 'https://arxiv.org/pdf/2601.00002');
    await vi.waitFor(() => expect(byId('paperTitle').textContent).toContain('2601.00002'));
    complete('研究结果提高了三个数据集上的准确率。');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.querySelector('.message.assistant')).toBeNull();
    setTab(101, 'https://arxiv.org/pdf/2601.00001');
    await vi.waitFor(() => expect(document.querySelector('.message.assistant')?.textContent).toContain('研究结果提高'));
    expect(mock.generate).toHaveBeenCalledTimes(calls + 1);
  });

  it('source and its Reader share state while independent same-URL tabs remain isolated', async () => {
    await openLoop();
    byId<HTMLTextAreaElement>('askInput').value = 'Shared session draft';
    byId('askInput').dispatchEvent(new Event('input', { bubbles: true }));
    setTab(1101, 'chrome-extension://test-extension-id/reader.html?session=session-101');
    await vi.waitFor(() => expect(byId('paperTitle').textContent).toBe('Paper A'));
    expect(byId<HTMLTextAreaElement>('askInput').value).toBe('Shared session draft');
    setTab(103, 'https://arxiv.org/pdf/2601.00001');
    await vi.waitFor(() => expect(byId('paperTitle').textContent).toContain('2601.00001'));
    expect(byId('overviewContent').hidden).toBe(true);
    expect(byId<HTMLTextAreaElement>('askInput').value).toBe('');
    setTab(101, 'https://arxiv.org/pdf/2601.00001');
    await vi.waitFor(() => expect(byId('paperTitle').textContent).toBe('Paper A'));
    expect(byId<HTMLTextAreaElement>('askInput').value).toBe('Shared session draft');
  });

  it('does not translate a request already consumed by another panel', async () => {
    await openLoop(); const calls = mock.generate.mock.calls.length;
    const original = vi.mocked(chrome.runtime.sendMessage).getMockImplementation();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((message: {type?: string}) =>
      message.type === 'reader-consume' ? Promise.resolve({consumed:false}) : (original as ((value: unknown) => unknown) | undefined)?.(message)) as typeof chrome.runtime.sendMessage);
    selectionRequest('translate');
    await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({type:'reader-consume'})));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(mock.generate).toHaveBeenCalledTimes(calls);
  });

});
