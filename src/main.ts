import type { ChatMessage, Digest, Paper, Provider } from "./types";
import { DEFAULT_MODELS } from "./types";
import { fetchPdf, parsePdf } from "./lib/document";
import { generateText, listModels, type AvailableModel } from "./lib/provider";
import { askPrompt, overviewPrompt, PROMPT_PRESETS } from "./lib/prompts";
import { parseDigest } from "./lib/digest";
import { markdownFilename, toMarkdown } from "./lib/markdown";
import {
  allowedPdfSource, candidatePdfUrl, isArxivUrl, permissionOrigin, sourcePageUrl
} from "./lib/urls";
import {
  collectDocumentCandidates, sanitizeDetectedCandidates, probePdfContentType
} from "./lib/detection";
import {
  forgetProviderKey, loadCredentials, saveCredentials, type Credentials
} from "./lib/storage";
import {
  TabWorkspaceManager, blankWorkspace, workspaceMatchesTab,
  documentIdentity, type TabWorkspace, type ReadingView
} from "./lib/tab-workspace";

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing UI element: " + id);
  return element as T;
};
const paperTitle = byId("paperTitle");
const paperSubtitle = byId("paperSubtitle");
const paperState = byId("paperState");
const primaryTabs = byId("primaryTabs");
const settingsToggle = byId<HTMLButtonElement>("settingsToggle");
const settingsBack = byId<HTMLButtonElement>("settingsBack");
const detectBtn = byId<HTMLButtonElement>("detectBtn");
const sourceChooser = byId("sourceChooser");
const sourceSelect = byId<HTMLSelectElement>("sourceSelect");
const sourceChooseBtn = byId<HTMLButtonElement>("sourceChooseBtn");
const pasteUrlForm = byId<HTMLFormElement>("pasteUrlForm");
const pasteUrlInput = byId<HTMLInputElement>("pasteUrlInput");
const emptyTitle = byId("emptyTitle");
const emptyDescription = byId("emptyDescription");
const emptyAction = byId<HTMLButtonElement>("emptyAction");
const emptyHint = byId("emptyHint");
const fileAccessHint = byId("fileAccessHint");
const fileAccessBtn = byId<HTMLButtonElement>("fileAccessBtn");
const promptSuggestions = byId("promptSuggestions");
const presetList = byId("presetList");
const status = byId("status");
const analyzeBtn = byId<HTMLButtonElement>("analyzeBtn");
const uploadBtn = byId<HTMLButtonElement>("uploadBtn");
const fileInput = byId<HTMLInputElement>("fileInput");
const overviewEmpty = byId("overviewEmpty");
const overviewContent = byId("overviewContent");
const chatHistory = byId("chatHistory");
const askForm = byId<HTMLFormElement>("askForm");
const askInput = byId<HTMLTextAreaElement>("askInput");
const askBtn = byId<HTMLButtonElement>("askBtn");
const cardText = byId<HTMLTextAreaElement>("cardText");
const providerInput = byId<HTMLSelectElement>("providerInput");
const modelSelect = byId<HTMLSelectElement>("modelSelect");
const modelInput = byId<HTMLInputElement>("modelInput");
const customModelLabel = byId("customModelLabel");
const refreshModelsBtn = byId<HTMLButtonElement>("refreshModelsBtn");
const modelHint = byId("modelHint");
const keyInput = byId<HTMLInputElement>("keyInput");
const rememberInput = byId<HTMLInputElement>("rememberInput");
const settingsForm = byId<HTMLFormElement>("settingsForm");
const testBtn = byId<HTMLButtonElement>("testBtn");
const clearKeyBtn = byId<HTMLButtonElement>("clearKeyBtn");

const workspaces = new TabWorkspaceManager();
const pendingTabs = new Set<number>();
let activeTabId: number | undefined;
let tabUrl = "";
let restoringWorkspace = false;
let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;
let activePdfUrl: string | null = null;
let candidates: string[] = [];
let scanPerformed = false;
let scanGeneration = 0;
let filePermissionBlocked = false;
let paper: Paper | null = null;
let digest: Digest | null = null;
let conversation: ChatMessage[] = [];
let busy = false;
let currentView = "overview";
let lastReadingView = "overview";
let credentials: Credentials = {
  provider: "deepseek", model: DEFAULT_MODELS.deepseek,
  rememberKey: false, apiKey: ""
};
const modelCatalogs: Partial<Record<Provider, AvailableModel[]>> = {};
const credentialDrafts: Partial<Record<Provider, Credentials>> = {};
let modelRequestSerial = 0;
let previousFormProvider: Provider = "deepseek";

function showStatus(message: string, error = false): void {
  status.hidden = !message;
  status.textContent = message;
  status.className = error ? "status status-error" : "status";
}
function setBusy(value: boolean, tabId = activeTabId): void {
  if (tabId !== undefined) {
    if (value) pendingTabs.add(tabId);
    else pendingTabs.delete(tabId);
  }
  if (tabId !== activeTabId) return;
  busy = value;
  analyzeBtn.disabled = value;
  detectBtn.disabled = value;
  askBtn.disabled = value || !paper;
  askInput.disabled = value || !paper;
  testBtn.disabled = value;
  uploadBtn.disabled = value;
  emptyAction.disabled = value;
  sourceChooseBtn.disabled = value;
}
function setView(view: string): void {
  currentView = view;
  const settings = view === "settings";
  if (!settings) lastReadingView = view;
  primaryTabs.hidden = settings;
  settingsToggle.setAttribute("aria-pressed", String(settings));
  document.querySelectorAll<HTMLElement>(".view").forEach(el => {
    el.hidden = el.dataset.view !== view;
  });
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach(el => {
    const selected = el.dataset.tab === view;
    el.classList.toggle("active", selected);
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
  });
  renderPaperState();
  checkpointWorkspace();
}
function create<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = "", text = ""
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}


/** Snapshot only the active tab's reading data. No provider credentials. */
function currentWorkspaceSnapshot(): TabWorkspace | null {
  if (activeTabId === undefined) return null;
  const existing = workspaces.get(activeTabId) || blankWorkspace(activeTabId, tabUrl);
  return {
    ...existing,
    tabUrl,
    selectedPdfUrl: activePdfUrl,
    candidates: [...candidates],
    scanPerformed,
    paper,
    digest,
    conversation: conversation.map(message => ({ ...message })),
    draft: askInput.value,
    view: lastReadingView === "ask" || lastReadingView === "card"
      ? lastReadingView : "overview"
  };
}

/** Updates are queued in storage.session; switching tabs never discards a snapshot. */
function checkpointWorkspace(): void {
  if (restoringWorkspace || activeTabId === undefined) return;
  const snapshot = currentWorkspaceSnapshot();
  if (!snapshot) return;
  void workspaces.save(snapshot).catch(() => {
    if (activeTabId === snapshot.tabId)
      showStatus("临时会话保存失败。请复制重要结果，或关闭其他论文标签后重试。", true);
  });
}

function restoreWorkspace(state: TabWorkspace): void {
  restoringWorkspace = true;
  try {
    activePdfUrl = state.selectedPdfUrl;
    candidates = [...state.candidates];
    scanPerformed = state.scanPerformed;
    paper = state.paper;
    digest = state.digest;
    conversation = state.conversation.map(item => ({ ...item }));
    askInput.value = state.draft;
    cardText.value = paper && digest ? toMarkdown(paper, digest) : "";
    lastReadingView = state.view;
    renderSourceChooser();
    renderOverview();
    renderChat();
    setView(state.view);
    setBusy(pendingTabs.has(state.tabId), state.tabId);
  } finally {
    restoringWorkspace = false;
  }
}

function isCurrentPaper(tabId: number, paperId: string): boolean {
  return activeTabId === tabId && paper?.id === paperId;
}

/** When an AI call finishes after a tab switch, keep its result in its original tab. */
async function updatePaperResult(
  tabId: number, paperId: string, update: (workspace: TabWorkspace) => void
): Promise<boolean> {
  const exists = await workspaces.updatePaper(tabId, paperId, update);
  if (!exists) return false;
  if (isCurrentPaper(tabId, paperId)) {
    const saved = workspaces.get(tabId)!;
    digest = saved.digest;
    conversation = [...saved.conversation];
    cardText.value = paper && digest ? toMarkdown(paper, digest) : "";
    renderOverview();
    renderChat();
    renderPaperState();
  }
  return true;
}

function renderSourceChooser(): void {
  sourceChooser.hidden = candidates.length < 2 || currentView === "settings";
  sourceSelect.replaceChildren();
  if (candidates.length < 2) return;
  for (const url of candidates) {
    const option = create("option");
    option.value = url;
    const u = new URL(url);
    option.textContent = u.host + u.pathname.slice(0, 90) + (u.search ? "…" : "");
    sourceSelect.append(option);
  }
}

function renderEmptyState(): void {
  fileAccessHint.hidden = !filePermissionBlocked;
  if (filePermissionBlocked) {
    emptyTitle.textContent = "需要授权访问本地 PDF";
    emptyDescription.textContent = "Chrome 默认可能阻止扩展读取 file:// 文件。开启文件访问权限后，返回这里重新检测。";
    emptyAction.textContent = "打开扩展权限";
    emptyAction.dataset.action = "file-access";
    emptyAction.hidden = false;
    emptyHint.textContent = "仅在用户明确开启权限后读取当前文件。";
  } else if (candidates.length >= 2 && !activePdfUrl) {
    emptyTitle.textContent = "找到了多个 PDF";
    emptyDescription.textContent = "在上方选择需要分析的文件，避免误将网页里的其他附件当作当前论文。";
    emptyAction.hidden = true;
    emptyHint.textContent = "无法确定时，可粘贴论文的直接地址。";
  } else if (!activePdfUrl && !paper) {
    emptyTitle.textContent = scanPerformed ? "未找到可读取的 PDF" : "打开一篇论文";
    emptyDescription.textContent = scanPerformed
      ? "可以重新检测当前网页、粘贴 PDF 地址，或者选择本地文件。部分受保护的 PDF 无法自动获取。"
      : "打开 PDF 后可以一键检测。支持 arXiv、出版社网页中的 PDF 链接及本地文件。";
    emptyAction.textContent = "检测当前页面";
    emptyAction.dataset.action = "detect";
    emptyAction.hidden = false;
    emptyHint.textContent = "也可以使用顶部的文件按钮选择 PDF。";
  } else if (!credentials.apiKey.trim()) {
    emptyTitle.textContent = "先配置模型";
    emptyDescription.textContent = "论文已经识别。请配置自己的 API Key，再生成论文概览。";
    emptyAction.textContent = "设置模型";
    emptyAction.dataset.action = "settings";
    emptyAction.hidden = false;
    emptyHint.textContent = "正文仅在点击“分析”或主动提问后发送到所选模型。";
  } else {
    emptyTitle.textContent = "论文准备就绪";
    emptyDescription.textContent = "点击右上角“分析”，提取研究问题、方法和关键结果。";
    emptyAction.hidden = true;
    emptyHint.textContent = "完成后可复制或下载 Markdown 论文卡片。";
  }
}

function documentLabel(raw: string): string {
  try {
    const url = new URL(raw);
    const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (url.protocol === "file:") return filename || "本地 PDF";
    return filename && filename.length <= 55 ? filename : url.hostname + " · PDF";
  } catch { return "当前 PDF"; }
}

function renderPaperState(): void {
  const hasPaper = !!paper || !!activePdfUrl;
  paperTitle.textContent = currentView === "settings" ? "模型与 API Key" :
    paper?.title || (activePdfUrl ? documentLabel(activePdfUrl) : "未选择论文");
  paperTitle.title = paperTitle.textContent || "";
  paperSubtitle.textContent = paper
    ? paper.totalPages + " 页" + (paper.truncated ? " · 文本已截断" : "")
    : activePdfUrl || "";
  paperState.hidden = !hasPaper || currentView === "settings";
  paperState.textContent = digest ? "已分析" : paper ? "已读取" : "待分析";
  analyzeBtn.hidden = currentView === "settings" || !hasPaper;
  analyzeBtn.textContent = !credentials.apiKey.trim() ? "设置" :
    digest ? "重新分析" : "分析";
  askBtn.disabled = busy || !paper;
  askInput.disabled = busy || !paper;
  byId<HTMLButtonElement>("copyBtn").disabled = !cardText.value;
  byId<HTMLButtonElement>("downloadBtn").disabled = !cardText.value;
  renderEmptyState();
}

function resetPaper(): void {
  paper = null; digest = null; conversation = [];
  cardText.value = "";
  askInput.value = "";
  overviewContent.replaceChildren();
  renderOverview(); renderChat(); renderPaperState();
  checkpointWorkspace();
}

function makeCard(title: string, text: string | string[], lead = false): HTMLElement {
  const section = create("section", lead ? "digest-section lead" : "digest-section");
  section.append(create("h3", "", title));
  if (typeof text === "string") section.append(create("p", "", text || "论文未提供足够信息。"));
  else {
    const list = create("ul");
    for (const item of text) list.append(create("li", "", item));
    section.append(list);
  }
  return section;
}
function renderOverview(): void {
  const exists = !!digest && !!paper;
  overviewEmpty.hidden = exists;
  overviewContent.hidden = !exists;
  renderEmptyState();
  overviewContent.replaceChildren();
  if (!digest || !paper) return;
  overviewContent.append(makeCard("这篇论文做了什么", digest.tldr, true),
    makeCard("研究问题", digest.problem),
    makeCard("核心方法", digest.approach));
  const findingsCard = create("section", "digest-section");
  findingsCard.append(create("h3", "", "关键结果"));
  const list = create("ul");
  for (const finding of digest.findings) {
    const item = create("li");
    item.append(create("span", "", finding.text));
    if (finding.verified && finding.page) {
      const page = finding.page;
      const badge = create("button", "page-link", "PDF p." + page + " ↗");
      badge.type = "button";
      badge.addEventListener("click", () => void navigateToPage(page));
      item.append(badge);
    } else {
      item.append(create("small", "unverified", "原文位置未验证"));
    }
    list.append(item);
  }
  findingsCard.append(list);
  overviewContent.append(findingsCard,
    makeCard("局限与注意", digest.limitations),
    makeCard("关键词", digest.keywords.join(" · ")));
}
function renderChat(): void {
  chatHistory.replaceChildren();
  promptSuggestions.hidden = !!conversation.length || !paper;
  if (!conversation.length) {
    chatHistory.append(create("div", "chat-empty", paper
      ? "针对方法、实验或某个难懂的概念继续提问。" : "先分析当前论文，再提问。"));
    return;
  }
  for (const message of conversation) {
    const bubble = create("article", "message " + message.role);
    bubble.append(create("div", "message-role", message.role === "user" ? "YOU" : "PAPERPEEK"));
    const text = message.text;
    if (message.role === "assistant" && paper?.sourceUrl) {
      const matcher = /\[PDF p\.(\d+)\]/g;
      let last = 0; let match: RegExpExecArray | null;
      const body = create("div", "message-text");
      while ((match = matcher.exec(text))) {
        body.append(document.createTextNode(text.slice(last, match.index)));
        const page = Number(match[1]);
        if (page >= 1 && page <= paper.totalPages) {
          const link = create("button", "page-link", match[0] + " ↗");
          link.title = "模型提供的候选页码；未经过原文引用校验";
          link.addEventListener("click", () => void navigateToPage(page));
          body.append(link);
        } else body.append(document.createTextNode(match[0]));
        last = matcher.lastIndex;
      }
      body.append(document.createTextNode(text.slice(last)));
      bubble.append(body);
    } else bubble.append(create("div", "message-text", text));
    chatHistory.append(bubble);
  }
  chatHistory.scrollTop = chatHistory.scrollHeight;
}
async function navigateToPage(page: number): Promise<void> {
  if (!paper?.sourceUrl || activeTabId === undefined) {
    showStatus("本地导入的 PDF 暂不支持自动跳转，请在原阅读器中定位。", true);
    return;
  }
  try { await chrome.tabs.update(activeTabId, { url: sourcePageUrl(paper.sourceUrl, page) }); }
  catch { showStatus("无法自动跳转 PDF；可手动查看第 " + page + " 页。", true); }
}
function tabIdentity(raw?: string): string {
  if (!raw) return "";
  try { const u = new URL(raw); u.hash = ""; return u.href; }
  catch { return raw; }
}

async function fileAccessAllowed(): Promise<boolean> {
  try { return await chrome.extension.isAllowedFileSchemeAccess(); }
  catch { return false; }
}

async function requestHostAccess(raw: string): Promise<boolean> {
  if (raw.startsWith("file:")) return fileAccessAllowed();
  if (isArxivUrl(raw)) return true;
  const origin = permissionOrigin(raw);
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  // Only called from user-triggered Detect/Analyze actions.
  return chrome.permissions.request({ origins: [origin] });
}

async function inspectPage(tabId: number): Promise<string[]> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId }, func: collectDocumentCandidates
    });
    const values = result.flatMap(item => Array.isArray(item.result) ? item.result : []);
    return sanitizeDetectedCandidates(values);
  } catch {
    // Protected Chrome PDF viewer and cross-origin iframes may not be scriptable.
    return [];
  }
}

/** Automatically scans current tab and DOM; explicit Detect may also use HEAD. */
async function refreshActiveTab(thorough = false, rescan = false): Promise<void> {
  // Ignore previous asynchronous tab scans when the user changes tabs or chooses a file.
  const generation = ++scanGeneration;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (generation !== scanGeneration) return;
  const url = tabIdentity(tab?.url);
  const id = tab?.id;
  const changed = id !== activeTabId || url !== tabUrl;

  if (changed) {
    // Preserve the outgoing workspace *before* replacing active tab identity.
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    checkpointWorkspace();
    activeTabId = id;
    tabUrl = url;
    showStatus("");
    if (id !== undefined) {
      const restored = await workspaces.open(id, url);
      if (generation !== scanGeneration) return;
      restoreWorkspace(restored);
    } else {
      // No user tab: show a neutral empty state, never another paper's content.
      restoringWorkspace = true;
      try {
        activePdfUrl = null;
        candidates = [];
        scanPerformed = false;
        paper = null;
        digest = null;
        conversation = [];
        askInput.value = "";
        cardText.value = "";
        lastReadingView = "overview";
        renderOverview();
        renderChat();
        setView("overview");
      } finally {
        restoringWorkspace = false;
      }
    }
  }

  const stillCurrent = () =>
    generation === scanGeneration && activeTabId === id && tabUrl === url;
  const allowed = await fileAccessAllowed();
  if (!stillCurrent()) return;
  filePermissionBlocked = !!activePdfUrl?.startsWith("file:") && !allowed;

  if (id !== undefined && !filePermissionBlocked && (changed || thorough || rescan) && !paper) {
    let found = await inspectPage(id);
    if (!stillCurrent()) return;
    if (!found.length && thorough && url.startsWith("https:")) {
      try {
        const access = await requestHostAccess(url);
        if (!stillCurrent()) return;
        if (access) found = await inspectPage(id);
        if (!stillCurrent()) return;
      } catch { /* Manual source selection stays available. */ }
    }
    if (!activePdfUrl && found.length === 1) {
      activePdfUrl = found[0];
      candidates = found;
    } else if (found.length >= 2) {
      candidates = found;
    }
  }

  if (thorough && !paper && !activePdfUrl && candidates.length < 2 && url.startsWith("https:")) {
    try {
      const access = await requestHostAccess(url);
      if (!stillCurrent()) return;
      if (access) {
        const pdf = await probePdfContentType(url);
        if (!stillCurrent()) return;
        if (pdf) activePdfUrl = url;
      }
    } catch { /* Not a directly accessible PDF. */ }
  }
  if (!stillCurrent()) return;
  if (thorough) scanPerformed = true;
  renderSourceChooser();
  renderOverview();
  renderPaperState();
  checkpointWorkspace();
  if (thorough) {
    if (filePermissionBlocked) showStatus("需要启用“允许访问文件网址”后才能读取本地 PDF。", true);
    else if (paper || activePdfUrl) showStatus(paper
      ? "已恢复当前论文，可以继续提问或查看卡片。"
      : "已找到 PDF。可以点击“分析”开始阅读。");
    else if (candidates.length > 1) showStatus("找到 " + candidates.length + " 个候选 PDF，请选择。");
    else showStatus("未找到可直接获取的 PDF，可粘贴链接或选择本地文件。", true);
  }
}

function usePdfSource(url: string): void {
  if (!allowedPdfSource(url) ||
      (url.startsWith("file:") && !candidatePdfUrl(url))) {
    showStatus("仅支持 HTTPS PDF 地址或以 .pdf 结尾的本地文件。", true);
    return;
  }
  // An earlier asynchronous scan must not replace the explicit user choice.
  scanGeneration++;
  const parsed = new URL(url);
  parsed.hash = "";
  const next = parsed.href;
  if (next !== activePdfUrl) resetPaper();
  activePdfUrl = next;
  candidates = [];
  filePermissionBlocked = false;
  scanPerformed = true;
  renderSourceChooser(); renderPaperState(); renderOverview();
  checkpointWorkspace();
  showStatus("已选择 PDF。点击“分析”读取正文。");
}

function currentRequest(prompt: string, json = false) {
  if (!credentials.apiKey.trim()) throw new Error("请先在设置中配置 API Key。");
  return {
    provider: credentials.provider, model: credentials.model, apiKey: credentials.apiKey,
    prompt, json
  };
}
async function summarize(): Promise<void> {
  if (!paper || busy) return;
  const targetPaper = paper;
  setBusy(true); showStatus("正在整理研究问题、方法与证据……");
  try {
    const raw = await generateText(currentRequest(overviewPrompt(targetPaper), true));
    // The tab may change while the provider request is in flight.
    if (paper !== targetPaper) return;
    const nextDigest = parseDigest(raw, targetPaper.pages);
    digest = nextDigest;
    cardText.value = toMarkdown(targetPaper, nextDigest);
    renderOverview(); renderPaperState(); setView("overview");
    showStatus(nextDigest.findings.some(f => !f.verified)
      ? "分析完成。部分结论没有可验证的原文片段，请人工核查。"
      : "论文分析完成。");
  } catch (error) {
    if (paper === targetPaper)
      showStatus(error instanceof Error ? error.message : "分析失败，请重试。", true);
  } finally { setBusy(false); }
}
async function analyzeCurrent(): Promise<void> {
  if (busy) return;
  if (!credentials.apiKey.trim()) {
    setView("settings");
    showStatus("先配置当前服务商的 API Key。");
    return;
  }
  if (paper) { await summarize(); return; }
  if (!activePdfUrl) {
    showStatus("尚未选择 PDF。请点击重新检测、选择链接或打开本地文件。", true);
    return;
  }
  const url = activePdfUrl;
  const tabId = activeTabId;
  try {
    if (!(await requestHostAccess(url))) {
      filePermissionBlocked = url.startsWith("file:");
      renderOverview();
      throw new Error(filePermissionBlocked
        ? "请到 Chrome 扩展详情页打开“允许访问文件网址”，再重新分析。"
        : "需要先授权该 PDF 网站的读取权限。");
    }
    setBusy(true);
    showStatus("正在提取 PDF 正文…");
    const bytes = await fetchPdf(url);
    const loaded = await parsePdf(bytes, url);
    if (url !== activePdfUrl || tabId !== activeTabId)
      throw new Error("检测到标签页发生变化，请重新分析。");
    paper = loaded; digest = null; conversation = [];
    renderOverview(); renderChat(); renderPaperState();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "无法读取该 PDF。可以选择本地文件。", true);
    return;
  } finally { setBusy(false); }
  await summarize();
}

async function openLocal(file: File): Promise<void> {
  if (busy) return;
  const tabId = activeTabId;
  setBusy(true); showStatus("正在读取本地 PDF……");
  try {
    const loaded = await parsePdf(await file.arrayBuffer(), null);
    if (tabId !== activeTabId) return;
    if (!loaded.title || loaded.title === "Untitled paper")
      loaded.title = file.name.replace(/\.pdf$/i, "");
    paper = loaded;
    digest = null; conversation = [];
    renderOverview(); renderChat(); renderPaperState();
    showStatus("PDF 已加载。正在准备生成概览……");
  } catch (error) {
    if (tabId === activeTabId)
      showStatus(error instanceof Error ? error.message : "本地 PDF 加载失败。", true);
    return;
  } finally { setBusy(false); }
  await summarize();
}
async function ask(question: string): Promise<void> {
  if (!paper || busy) { showStatus("请先分析或加载当前论文。", true); return; }
  const targetPaper = paper;
  const history = conversation.slice(-6);
  conversation.push({ role: "user", text: question });
  renderChat(); setView("ask"); setBusy(true); showStatus("正在基于当前论文回答……");
  try {
    const answer = await generateText(currentRequest(askPrompt(targetPaper, question, history)));
    if (paper !== targetPaper) return; // Never show a former paper's answer in another tab.
    conversation.push({ role: "assistant", text: answer });
    renderChat(); showStatus("");
  } catch (error) {
    if (paper === targetPaper)
      showStatus(error instanceof Error ? error.message : "提问失败。", true);
  } finally { setBusy(false); }
}
function selectedModel(): string {
  return modelSelect.value === "__custom__" ? modelInput.value.trim() : modelSelect.value;
}
function formCredentials(provider: Provider = providerInput.value as Provider): Credentials {
  return { provider, model: selectedModel(), apiKey: keyInput.value.trim(),
    rememberKey: rememberInput.checked };
}
function updateModelInputVisibility(): void {
  const custom = modelSelect.value === "__custom__" || providerInput.value === "gemini";
  modelInput.hidden = !custom;
  customModelLabel.hidden = !custom;
  modelInput.disabled = !custom;
  modelInput.required = custom;
}
function renderModelOptions(provider: Provider, configured: string): void {
  modelSelect.replaceChildren();
  const known = modelCatalogs[provider] || [];
  const options = new Map<string, string>();
  if (configured) options.set(configured,
    known.some(m => m.id === configured) ? configured : configured + "（已配置）");
  if (provider !== "gemini") {
    if (!configured) options.set(DEFAULT_MODELS[provider], DEFAULT_MODELS[provider] + "（默认）");
    for (const model of known) {
      const suffix = model.contextWindow
        ? " · " + (model.contextWindow / 1000).toFixed(0) + "k" : "";
      options.set(model.id, model.label + suffix);
    }
  }
  for (const [id, label] of options) {
    const opt = create("option");
    opt.value = id; opt.textContent = label; modelSelect.append(opt);
  }
  const custom = create("option");
  custom.value = "__custom__";
  custom.textContent = "手动填写模型 ID…";
  modelSelect.append(custom);
  modelSelect.value = provider === "gemini" || !options.has(configured)
    ? "__custom__" : configured;
  modelInput.value = configured;
  updateModelInputVisibility();
  refreshModelsBtn.hidden = provider === "gemini";
  modelHint.textContent = provider === "gemini"
    ? "Gemini 暂时通过自定义 ID 配置。"
    : known.length
      ? "已从官方模型接口获取 " + known.length + " 个候选；使用前仍应测试模型兼容性。"
      : "可刷新官方列表。模型 ID 会直接用于实际 API 请求。";
}
function applyCredentials(input: Credentials): void {
  providerInput.value = input.provider;
  previousFormProvider = input.provider;
  keyInput.value = input.apiKey;
  rememberInput.checked = input.rememberKey;
  renderModelOptions(input.provider, input.model);
}

async function refreshModelCatalog(): Promise<void> {
  const provider = providerInput.value as Provider;
  if (provider === "gemini") return;
  const apiKey = keyInput.value.trim();
  if (!apiKey) {
    modelHint.textContent = "先填写当前服务商的 API Key，才能获取模型列表。";
    return;
  }
  const requestId = ++modelRequestSerial;
  const currentSelection = selectedModel();
  refreshModelsBtn.disabled = true;
  modelHint.textContent = "正在从 " + (provider === "openai" ? "OpenAI" : "DeepSeek") + " 获取模型列表…";
  try {
    const models = await listModels(provider, apiKey);
    if (requestId !== modelRequestSerial || providerInput.value !== provider) return;
    modelCatalogs[provider] = models;
    renderModelOptions(provider, currentSelection);
    if (!models.length) modelHint.textContent = "官方列表没有匹配的聊天模型，请手动填写并测试。";
  } catch (error) {
    if (requestId !== modelRequestSerial || providerInput.value !== provider) return;
    modelHint.textContent = error instanceof Error ? error.message : "获取模型列表失败。";
  } finally {
    if (requestId === modelRequestSerial) refreshModelsBtn.disabled = false;
  }
}

async function loadProviderForm(provider: Provider): Promise<void> {
  const requestId = ++modelRequestSerial;
  const stored = credentialDrafts[provider] || await loadCredentials(provider);
  if (requestId !== modelRequestSerial || providerInput.value !== provider) return;
  applyCredentials(stored);
  if (provider !== "gemini" && stored.apiKey)
    await refreshModelCatalog();
}

async function acceptSelection(): Promise<void> {
  const data = await chrome.storage.session.get("paperpeek.selection");
  const selection = data["paperpeek.selection"] as
    { text?: string; tabId?: number; url?: string; at?: number } | undefined;
  if (!selection || !selection.text || !selection.at ||
      Date.now() - selection.at > 5 * 60_000) return;
  if (selection.tabId !== activeTabId ||
      (candidatePdfUrl(selection.url) !== activePdfUrl && tabIdentity(selection.url) !== tabUrl)) return;
  askInput.value = "请解释论文中选中的这段话，并联系上下文：\n\n“" +
    selection.text.slice(0, 1600) + "”";
  await chrome.storage.session.remove("paperpeek.selection");
  setView("ask");
}
document.querySelectorAll<HTMLButtonElement>(".tab").forEach(tab => {
  tab.addEventListener("click", () => setView(tab.dataset.tab || "overview"));
  tab.addEventListener("keydown", event => {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>(".tab")];
    const index = tabs.indexOf(tab);
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setView(next.dataset.tab || "overview");
    next.focus();
  });
});
settingsToggle.addEventListener("click", () => {
  const open = currentView !== "settings";
  setView(open ? "settings" : lastReadingView);
  if (open && keyInput.value && providerInput.value !== "gemini")
    void refreshModelCatalog();
});
settingsBack.addEventListener("click", () => setView(lastReadingView));
emptyAction.addEventListener("click", () => {
  if (emptyAction.dataset.action === "settings") setView("settings");
  else if (emptyAction.dataset.action === "file-access") openFileAccessSettings();
  else void refreshActiveTab(true);
});
fileAccessBtn.addEventListener("click", openFileAccessSettings);
function openFileAccessSettings(): void {
  void chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
}
analyzeBtn.addEventListener("click", () => void analyzeCurrent());
detectBtn.addEventListener("click", () => void refreshActiveTab(true));
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void openLocal(file);
  fileInput.value = "";
});
sourceChooseBtn.addEventListener("click", () => {
  if (sourceSelect.value) usePdfSource(sourceSelect.value);
});
pasteUrlForm.addEventListener("submit", event => {
  event.preventDefault();
  const url = pasteUrlInput.value.trim();
  if (!allowedPdfSource(url)) {
    showStatus("请填写 HTTPS PDF 地址，或使用顶部按钮选择本地文件。", true);
    return;
  }
  usePdfSource(url);
  pasteUrlInput.value = "";
});
for (const preset of PROMPT_PRESETS) {
  const button = create("button", "prompt-row");
  button.type = "button";
  button.title = preset.description;
  button.append(create("span", "", preset.label));
  button.append(create("span", "", preset.description + " ↗"));
  button.addEventListener("click", () => {
    askInput.value = preset.prompt;
    setView("ask");
    askInput.focus();
  });
  presetList.append(button);
}
askForm.addEventListener("submit", event => {
  event.preventDefault();
  const question = askInput.value.trim();
  if (!question) return;
  askInput.value = "";
  void ask(question);
});
askInput.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault(); askForm.requestSubmit();
  }
});

providerInput.addEventListener("change", () => {
  // Preserve unsaved drafts without copying another provider's key.
  credentialDrafts[previousFormProvider] = formCredentials(previousFormProvider);
  const provider = providerInput.value as Provider;
  void loadProviderForm(provider).catch(() => showStatus("无法读取模型设置。", true));
});
modelSelect.addEventListener("change", () => {
  if (modelSelect.value !== "__custom__") modelInput.value = modelSelect.value;
  updateModelInputVisibility();
});
refreshModelsBtn.addEventListener("click", () => void refreshModelCatalog());
keyInput.addEventListener("blur", () => {
  const provider = providerInput.value as Provider;
  if (keyInput.value.trim() && provider !== "gemini")
    void refreshModelCatalog();
});
settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const next = formCredentials();
  if (!next.model || !next.apiKey) {
    showStatus("请填写模型 ID 和当前服务商的 API Key。", true);
    return;
  }
  void saveCredentials(next).then(() => {
    credentials = next;
    credentialDrafts[next.provider] = next;
    renderPaperState();
    renderOverview();
    setView(lastReadingView);
    showStatus("已保存 " + next.provider + " 的模型与 Key 设置。");
  }).catch(() => showStatus("无法保存设置。", true));
});
testBtn.addEventListener("click", () => {
  if (busy) return;
  const input = formCredentials();
  if (!input.apiKey || !input.model) {
    showStatus("请先提供模型和 API Key。", true);
    return;
  }
  setBusy(true);
  showStatus("正在验证模型是否支持当前请求…");
  void generateText({ ...input, prompt: "Reply with OK only." })
    .then(() => showStatus("模型生成测试通过。"))
    .catch(error => showStatus(error instanceof Error ? error.message : "连接失败。", true))
    .finally(() => setBusy(false));
});
clearKeyBtn.addEventListener("click", () => {
  const provider = providerInput.value as Provider;
  void forgetProviderKey(provider).then(() => {
    keyInput.value = "";
    rememberInput.checked = false;
    if (credentials.provider === provider) credentials.apiKey = "";
    delete credentialDrafts[provider];
    renderPaperState();
    showStatus("已清除 " + provider + " 保存的 API Key。");
  }).catch(() => showStatus("清除 Key 失败。", true));
});
byId("copyBtn").addEventListener("click", () => {
  if (!cardText.value) { showStatus("请先生成论文概览。", true); return; }
  void navigator.clipboard.writeText(cardText.value)
    .then(() => showStatus("Markdown 已复制到剪贴板。"))
    .catch(() => showStatus("复制失败，可以手动选中文本。", true));
});
byId("downloadBtn").addEventListener("click", () => {
  if (!paper || !cardText.value) { showStatus("请先生成论文概览。", true); return; }
  const blob = new Blob([cardText.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = create("a");
  anchor.href = url; anchor.download = markdownFilename(paper.title);
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
chrome.tabs.onActivated.addListener(() => void refreshActiveTab());
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId !== activeTabId) return;
  if (info.url) void refreshActiveTab();
  else if (info.status === "complete") void refreshActiveTab(false, true);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes["paperpeek.selection"]) void acceptSelection();
});

async function init(): Promise<void> {
  try {
    credentials = await loadCredentials();
    applyCredentials(credentials);
    await refreshActiveTab(false, true);
    await acceptSelection();
  } catch {
    showStatus("浏览器存储或标签页访问失败，请重新打开插件。", true);
  }
  renderOverview();
  renderChat();
  setView("overview");
}
void init();
