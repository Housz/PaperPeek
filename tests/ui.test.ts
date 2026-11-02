import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../sidepanel.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("reader-first UI contract", () => {
  it("has three reading destinations and separates utility settings", () => {
    const destinations = [...html.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
    expect(destinations).toEqual(["overview", "ask", "card"]);
    expect(html).toContain('id="settingsToggle"');
    expect(html).toContain('id="settingsBack"');
    expect(html).toContain('id="primaryTabs"');
    expect(html).not.toContain('data-tab="settings"');
    expect(html).not.toContain('data-tab="explain"');
  });
  it("preserves all interactive IDs exactly once", () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const name of [
      "paperContext", "paperTitle", "paperSubtitle", "paperState",
      "analyzeBtn", "uploadBtn", "fileInput",
      "overviewEmpty", "overviewContent", "emptyAction",
      "chatHistory", "promptSuggestions", "askForm", "askInput", "askBtn",
      "cardText", "copyBtn", "downloadBtn", "settingsForm",
      "providerInput", "modelInput", "keyInput", "rememberInput", "saveBtn", "testBtn"
    ]) expect(ids).toContain(name);
  });
  it("keeps explanation actions inside Ask and makes the settings tab accessible", () => {
    const ask = html.slice(html.indexOf('id="view-ask"'), html.indexOf('id="view-card"'));
    expect((ask.match(/data-prompt=/g) || []).length).toBe(4);
    expect(html).toContain('aria-label="模型设置"');
    expect(html).toContain('aria-label="发送问题"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-live="polite"');
  });
  it("uses semantic light/dark tokens and avoids decorative gradients", () => {
    for (const token of ["--canvas", "--text", "--muted", "--border", "--primary", "--focus"]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("linear-gradient");
    expect(css).not.toContain("box-shadow:");
  });
});
