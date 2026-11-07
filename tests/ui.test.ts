import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../sidepanel.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("single-header reader UI contract", () => {
  it("keeps only one topbar and three content destinations", () => {
    expect((html.match(/class="topbar"/g) || []).length).toBe(1);
    expect(html).not.toContain('class="paper-context"');
    expect([...html.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]))
      .toEqual(["overview", "ask", "card"]);
    expect(html).toContain('id="settingsBack"');
  });
  it("preserves core interactive IDs and PDF recovery actions", () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "paperTitle", "paperState", "modelStatus", "analyzeBtn", "detectBtn", "uploadBtn",
      "fileInput", "sourceChooser", "sourceSelect", "sourceChooseBtn",
      "pasteUrlInput", "pasteUrlForm", "fileAccessHint", "fileAccessBtn",
      "overviewEmpty", "overviewContent", "chatHistory", "promptSuggestions",
      "presetList", "askInput", "askBtn", "cardText", "cardPreview", "cardModeBtn", "copyBtn", "downloadBtn",
      "settingsToggle", "providerInput", "modelSelect", "modelInput",
      "refreshModelsBtn", "modelHint", "keyInput", "rememberInput", "clearKeyBtn"
    ]) expect(ids).toContain(id);
  });
  it("has accessible control names and models privacy guidance", () => {
    expect(html).toContain('aria-label="重新检测当前页面的 PDF"');
    expect(html).toContain('aria-label="选择本地 PDF"');
    expect(html).toContain('aria-label="模型设置"');
    expect(html).toContain('aria-label="当前 AI 模型"');
    expect(html).toContain('data-icon="settings"');
    expect(html).toContain('aria-label="论文卡片 Markdown 预览"');
    expect(html).toContain('id="rememberInput"');
    expect(html).toContain("关闭后仍可使用");
    expect(html).toContain('role="tablist"');
  });
  it("maintains semantic palettes and responsive typography", () => {
    for (const token of ["--canvas", "--text", "--muted", "--border", "--primary", "--focus"]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("font-size: 14px");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("box-shadow:");
  });
});
