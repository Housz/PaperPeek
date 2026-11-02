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
const paperTitle = byId("paperTitle");
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
  askBtn.disabled = value;
  testBtn.disabled = value;
  uploadBtn.disabled = value;
}
function setView(view: string): void {
  document.querySelectorAll<HTMLElement>(".view").forEach(el => {
    el.hidden = el.dataset.view !== view;
  });
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach(el => {
    const selected = el.dataset.tab === view;
    el.classList.toggle("active", selected);
    el.setAttribute("aria-selected", String(selected));
  });
}
function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function renderPaperState(): void {
  paperTitle.textContent = paper?.title ||
    (activePdfUrl ? "已识别 PDF · 点击分析" : "打开一篇 arXiv PDF，开始阅读");
  paperSubtitle.textContent = paper
    ? paper.totalPages + " 页 · " + (paper.sourceUrl || "本地文件") +
      (paper.truncated ? " · 文本过长，分析内容已截断" : "")
    : activePdfUrl || "支持公开 PDF 链接或手动选择本地文件";
  paperState.textContent = paper ? (digest ? "Analyzed" : "Loaded") : (activePdfUrl ? "Ready" : "Not loaded");
  analyzeBtn.textContent = digest ? "↻ 重新分析" : (paper ? "✦ 生成概览" : "✦ 分析当前论文");
}
function resetPaper(): void {
  paper = null; digest = null; conversation = []; cardText.value = "";
  overviewContent.replaceChildren(); renderOverview(); renderChat(); renderPaperState();
}
function makeCard(title: string, text: string | string[]): HTMLElement {
  const card = create("article", "digest-card");
  card.append(create("h3", "", title));
  if (typeof text === "string") card.append(create("p", "", text || "论文未提供足够信息。"));
  else {
    const list = create("ul");
    for (const item of text) list.append(create("li", "", item));
    card.append(list);
  }
  return card;
}
function renderOverview(): void {
  const exists = !!digest && !!paper;
  overviewEmpty.hidden = exists;
  overviewContent.hidden = !exists;
  overviewContent.replaceChildren();
  if (!digest || !paper) return;
  overviewContent.append(makeCard("一句话概括", digest.tldr),
    makeCard("研究问题", digest.problem),
    makeCard("核心方法", digest.approach));
  const findingsCard = create("article", "digest-card");
  findingsCard.append(create("h3", "", "关键发现与证据"));
  const list = create("ul");
  for (const finding of digest.findings) {
    const item = create("li");
    item.append(create("span", "", finding.text));
    if (finding.verified && finding.page) {
      const page = finding.page;
      const badge = create("button", "page-link", "✓ PDF p." + page + " · 查看原文");
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
  if (!conversation.length) {
    chatHistory.append(create("div", "chat-empty", "试着问：这篇论文的核心假设是什么？"));
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
  setBusy(true); showStatus("正在整理研究问题、方法与证据……");
  try {
    const raw = await generateText(currentRequest(overviewPrompt(paper), true));
    digest = parseDigest(raw, paper.pages);
    cardText.value = toMarkdown(paper, digest);
    renderOverview(); renderPaperState(); setView("overview");
    showStatus(digest.findings.some(f => !f.verified)
      ? "分析完成。部分结论没有可验证的原文片段，请人工核查。"
      : "论文分析完成。");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "分析失败，请重试。", true);
  } finally { setBusy(false); }
}
async function analyzeCurrent(): Promise<void> {
  if (busy) return;
  if (paper) { await summarize(); return; }
  if (!activePdfUrl) {
    showStatus("未识别到 PDF。请打开 arXiv PDF 链接或选择本地 PDF。", true); return;
  }
  const url = activePdfUrl;
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
    if (url !== activePdfUrl) throw new Error("标签页已切换，请重新分析当前论文。");
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
  setBusy(true); showStatus("正在读取本地 PDF……");
  try {
    paper = await parsePdf(await file.arrayBuffer(), null);
    if (!paper.title || paper.title === "Untitled paper") paper.title = file.name.replace(/\.pdf$/i, "");
    digest = null; conversation = [];
    renderOverview(); renderChat(); renderPaperState();
    showStatus("PDF 已加载。正在准备生成概览……");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "本地 PDF 加载失败。", true);
    return;
  } finally { setBusy(false); }
  await summarize();
}
async function ask(question: string): Promise<void> {
  if (!paper || busy) { showStatus("请先分析或加载当前论文。", true); return; }
  const history = conversation.slice(-6);
  conversation.push({ role: "user", text: question });
  renderChat(); setView("ask"); setBusy(true); showStatus("正在基于当前论文回答……");
  try {
    const answer = await generateText(currentRequest(askPrompt(paper, question, history)));
    conversation.push({ role: "assistant", text: answer });
    renderChat(); showStatus("");
  } catch (error) {
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
    credentials = next; showStatus("设置已保存在本机。现在可以分析论文。");
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
}
void init();
