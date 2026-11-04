import { describe, expect, it } from "vitest";
import {
  askPrompt, overviewPrompt, PROMPT_PRESETS,
  PROMPT_LIBRARY_VERSION, presetById
} from "../src/lib/prompts";
import type { Paper } from "../src/types";

const paper: Paper = {
  id: "1", title: "Study", sourceUrl: "https://arxiv.org/pdf/test",
  totalPages: 2, pages: [
    { page: 1, text: "Method A" }, { page: 2, text: "Result B" }
  ], truncated: true
};
describe("versioned scientific reading prompts", () => {
  it("demands Chinese-English first mention, scientific evidence and honest truncation", () => {
    const text = overviewPrompt(paper);
    expect(text).toContain("中文术语（Original English Term）");
    expect(text).toContain("[PDF page 2]");
    expect(text).toContain("truncated");
    expect(text).toContain("作者主张");
    expect(text).toContain("quote");
  });
  it("uses bounded history and places question after untrusted PDF material", () => {
    const text = askPrompt(paper, "为什么?", [{ role: "user", text: "previous" }]);
    expect(text).toContain("为什么?");
    expect(text).toContain("previous");
    expect(text.indexOf("Method A")).toBeLessThan(text.indexOf("为什么?"));
  });
  it("does not transmit local file paths in prompts", () => {
    const text = overviewPrompt({
      ...paper, sourceUrl: "file:///Users/Researcher/secret/path.pdf"
    });
    expect(text).not.toContain("/Users/Researcher");
    expect(text).toContain("Local PDF");
  });
  it("has complete prompt presets without accidental duplication", () => {
    expect(PROMPT_LIBRARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROMPT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PROMPT_PRESETS.map(p => p.id)).size).toBe(PROMPT_PRESETS.length);
    expect(presetById("formula")?.prompt).toContain("公式");
    expect(presetById("bad-preset")).toBeUndefined();
  });
});
