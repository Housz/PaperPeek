import { describe, expect, it } from "vitest";
import { askPrompt, overviewPrompt } from "../src/lib/prompts";
import type { Paper } from "../src/types";

const paper: Paper = { id: "1", title: "Study", sourceUrl: "https://arxiv.org/pdf/test",
  totalPages: 2, pages: [{ page: 1, text: "Method A" }, { page: 2, text: "Result B" }], truncated: true };
describe("paper prompts", () => {
  it("includes page markers and disclosure of truncation", () => {
    const text = overviewPrompt(paper);
    expect(text).toContain("[PDF page 2]");
    expect(text).toContain("Text truncated");
    expect(text).toContain("untrusted");
  });
  it("includes user question and bounded history", () => {
    const text = askPrompt(paper, "why?", [{ role: "user", text: "previous" }]);
    expect(text).toContain("Question: why?");
    expect(text).toContain("previous");
  });
});
