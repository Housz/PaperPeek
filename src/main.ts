import type { ChatMessage, Digest, Paper, Provider } from "./types";
import { DEFAULT_MODELS } from "./types";
import { fetchPdf, parsePdf } from "./lib/document";
import { generateText } from "./lib/provider";
import { askPrompt, overviewPrompt } from "./lib/prompts";
import { parseDigest } from "./lib/digest";
import { markdownFilename, toMarkdown } from "./lib/markdown";
import { candidatePdfUrl, isArxivUrl, permissionOrigin, sourcePageUrl } from "./lib/urls";
import { loadCredentials, saveCredentials, type Credentials } from "./lib/storage";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing UI element: " + id);
  return element as T;
};
const paperContext = byId("paperContext");
const paperTitle = byId("paperTitle");
const primaryTabs = byId("primaryTabs");
const settingsToggle = byId<HTMLButtonElement>("settingsToggle");
const settingsBack = byId<HTMLButtonElement>("settingsBack");
const emptyTitle = byId("emptyTitle");
const emptyDescription = byId("emptyDescription");
const emptyAction = byId<HTMLButtonElement>("emptyAction");
const emptyHint = byId("emptyHint");
const promptSuggestions = byId("promptSuggestions");
const paperSubtitle = byId("paperSubtitle");
const paperState = byId("paperState");
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
const modelInput = byId<HTMLInputElement>("modelInput");
const keyInput = byId<HTMLInputElement>("keyInput");
const rememberInput = byId<HTMLInputElement>("rememberInput");
const settingsForm = byId<HTMLFormElement>("settingsForm");
const testBtn = byId<HTMLButtonElement>("testBtn");

let activeTabId: number | undefined;
let activePdfUrl: string | null = null;
let paper: Paper | null = null;
let digest: Digest | null = null;
let conversation: ChatMessage[] = [];
let busy = false;
let currentView = "overview";
let lastReadingView = "overview";
let credentials: Credentials = {
  provider: "gemini", model: DEFAULT_MODELS.gemini, rememberKey: false, apiKey: ""
};

function showStatus(message: string, error = false): void {
  status.hidden = !message;
  status.textContent = message;
  status.className = error ? "status status-error" : "status";
}
function setBusy(value: boolean): void {
  busy = value;
  analyzeBtn.disabled = value;
  askBtn.disabled = value || !paper;
  askInput.disabled = value || !paper;
  testBtn.disabled = value;
  uploadBtn.disabled = value;
  emptyAction.disabled = value;
}
function setView(view: string): void {
  currentView = view;
  const isSettings = view === "settings";
  if (!isSettings) lastReadingView = view;
  primaryTabs.hidden = isSettings;
  paperContext.hidden = isSettings || !(paper || activePdfUrl);
  settingsToggle.setAttribute("aria-pressed", String(isSettings));
  document.querySelectorAll<HTMLElement>(".view").forEach(el => {
    el.hidden = el.dataset.view !== view;
  });
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach(el => {
    const selected = el.dataset.tab === view;
    el.classList.toggle("active", selected);
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
  });
}
function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function renderEmptyState(): void {
  if (!activePdfUrl && !paper) {
    emptyTitle.textContent = "从一篇论文开始";
    emptyDescription.textContent = "打开 arXiv 论文，或选择本地 PDF。快速了解研究问题、方法和重要结果。";
    emptyAction.textContent = "选择 PDF";
    emptyAction.dataset.action = "upload";
    emptyAction.hidden = false;
    emptyHint.textContent = "一次只分析当前论文，不建立文献库。";
  } else if (!credentials.apiKey.trim()) {
    emptyTitle.textContent = "先连接你的模型";
    emptyDescription.textContent = "论文已就绪。添加自己的 API Key 后，即可生成概览和提问。";
    emptyAction.textContent = "配置 API Key";
    emptyAction.dataset.action = "settings";
    emptyAction.hidden = false;
    emptyHint.textContent = "仅在你开始分析或提问后，正文才会发送到模型服务商。";
  } else {
    emptyTitle.textContent = "论文已就绪";
    emptyDescription.textContent = "点击上方「分析论文」，获取研究问题、核心方法与关键证据。";
    emptyAction.hidden = true;
    emptyHint.textContent = "概览生成后可直接导出为 Markdown。";
  }
}
function renderPaperState(): void {
  paperContext.hidden = currentView === "settings" || !(paper || activePdfUrl);
  paperTitle.textContent = paper?.title || (activePdfUrl ? "当前 PDF" : "尚未打开论文");
  paperSubtitle.textContent = paper
    ? paper.totalPages + " 页 · " + (paper.sourceUrl ? "在线 PDF" : "本地 PDF") +
      (paper.truncated ? " · 正文已截断" : "")
    : activePdfUrl ? activePdfUrl : "";
  paperState.textContent = digest ? "已分析" : paper ? "已读取" : "待分析";
  analyzeBtn.textContent = !credentials.apiKey.trim()
    ? "配置模型" : digest ? "重新分析" : "分析论文";
  askBtn.disabled = busy || !paper;
  askInput.disabled = busy || !paper;
  renderEmptyState();
}
function resetPaper(): void {
  paper = null; digest = null; conversation = []; cardText.value = "";
  overviewContent.replaceChildren(); renderOverview(); renderChat(); renderPaperState();
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
async function refreshActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = candidatePdfUrl(tab?.url);
  if (tab?.id !== activeTabId || url !== activePdfUrl) {
    activeTabId = tab?.id; activePdfUrl = url;
    showStatus("");
    if (paper) resetPaper();
  }
  renderPaperState();
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
    showStatus("先配置 API Key，再分析论文。");
    return;
  }
  if (paper) { await summarize(); return; }
  if (!activePdfUrl) {
    showStatus("未识别到 PDF。请打开 arXiv PDF 链接或选择本地 PDF。", true); return;
  }
  const url = activePdfUrl;
  const tabId = activeTabId;
  try {
    if (!isArxivUrl(url)) {
      const origin = permissionOrigin(url);
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) throw new Error("需要当前 PDF 网站的读取权限。");
    }
    setBusy(true); showStatus("正在读取并解析 PDF……");
    const bytes = await fetchPdf(url);
    const loaded = await parsePdf(bytes, url);
    // Reject a stale load after switching browser tabs.
    if (url !== activePdfUrl || tabId !== activeTabId)
      throw new Error("标签页已切换，请重新分析当前论文。");
    paper = loaded; digest = null; conversation = [];
    renderOverview(); renderChat(); renderPaperState();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "无法读取 PDF。可以尝试手动打开文件。", true);
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
function formCredentials(): Credentials {
  return {
    provider: providerInput.value as Provider,
    model: modelInput.value.trim(),
    apiKey: keyInput.value.trim(),
    rememberKey: rememberInput.checked
  };
}
function applyCredentials(input: Credentials): void {
  providerInput.value = input.provider;
  modelInput.value = input.model;
  keyInput.value = input.apiKey;
  rememberInput.checked = input.rememberKey;
}
async function acceptSelection(): Promise<void> {
  const data = await chrome.storage.session.get("paperpeek.selection");
  const selection = data["paperpeek.selection"] as
    { text?: string; tabId?: number; url?: string; at?: number } | undefined;
  if (!selection || !selection.text || !selection.at ||
      Date.now() - selection.at > 5 * 60_000) return;
  if (selection.tabId !== activeTabId ||
      candidatePdfUrl(selection.url) !== activePdfUrl) return;
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
  setView(currentView === "settings" ? lastReadingView : "settings");
});
settingsBack.addEventListener("click", () => setView(lastReadingView));
emptyAction.addEventListener("click", () => {
  if (emptyAction.dataset.action === "settings") setView("settings");
  else fileInput.click();
});
analyzeBtn.addEventListener("click", () => void analyzeCurrent());
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void openLocal(file);
  fileInput.value = "";
});
document.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    askInput.value = button.dataset.prompt || "";
    setView("ask");
    askInput.focus();
  });
});
askForm.addEventListener("submit", (event) => {
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
  const provider = providerInput.value as Provider;
  modelInput.value = DEFAULT_MODELS[provider];
  keyInput.value = "";
});
settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const next = formCredentials();
  void saveCredentials(next).then(() => {
    credentials = next;
    renderPaperState();
    renderOverview();
    setView(lastReadingView);
    showStatus("模型设置已保存。");
  }).catch(() => showStatus("无法保存设置。", true));
});
testBtn.addEventListener("click", () => {
  if (busy) return;
  setBusy(true); showStatus("正在测试模型连接……");
  void generateText({ ...formCredentials(), prompt: "Reply with OK only." })
    .then(() => showStatus("连接成功。"))
    .catch(error => showStatus(error instanceof Error ? error.message : "连接失败。", true))
    .finally(() => setBusy(false));
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
  if (tabId === activeTabId && info.url) void refreshActiveTab();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes["paperpeek.selection"]) void acceptSelection();
});

async function init(): Promise<void> {
  try {
    credentials = await loadCredentials();
    applyCredentials(credentials);
    await refreshActiveTab();
    await acceptSelection();
  } catch {
    showStatus("浏览器存储或标签页访问失败，请重新打开插件。", true);
  }
  renderOverview();
  renderChat();
  setView("overview");
}
void init();
