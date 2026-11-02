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
  it("keeps small-text and action colors readable on the light canvas", () => {
    const color = (name: string) => {
      const match = css.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"));
      if (!match) throw new Error("Missing token " + name);
      return match[1];
    };
    const lum = (hex: string) => {
      const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const channels = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const bg = lum(color("canvas"));
    for (const foreground of ["text", "muted", "faint", "primary"]) {
      const fg = lum(color(foreground));
      const contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
      expect(contrast, foreground + " contrast").toBeGreaterThanOrEqual(4.5);
    }
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
