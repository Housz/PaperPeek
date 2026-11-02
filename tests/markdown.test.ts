import { describe, expect, it } from "vitest";
import { markdownFilename, toMarkdown } from "../src/lib/markdown";
import type { Digest, Paper } from "../src/types";

const paper: Paper = { id: "test", title: "A Test Paper", authors: "A. Researcher",
  sourceUrl: "https://arxiv.org/pdf/2601.01234", totalPages: 8, truncated: false, pages: [] };
const digest: Digest = { tldr: "核心概述", problem: "研究问题", approach: ["方法一"],
  findings: [{ text: "验证结果", page: 4, quote: "literal quote", verified: true }],
  limitations: ["限制一"], keywords: ["AI", "PDF"] };

describe("portable Markdown output", () => {
  it("contains stable headings and verified page reference", () => {
    const text = toMarkdown(paper, digest);
    expect(text).toContain("# A Test Paper");
    expect(text).toContain("## Core Approach");
    expect(text).toContain("验证结果（PDF p.4）");
    expect(text).toContain("https://arxiv.org/pdf/2601.01234");
  });
  it("marks truncated context", () => {
    expect(toMarkdown({ ...paper, truncated: true }, digest)).toContain("truncated");
  });
  it("sanitizes file names", () => {
    expect(markdownFilename('A / B : "test"')).not.toMatch(/[\/:*?"<>|]/);
    expect(markdownFilename("")).toBe("paper-PaperPeek.md");
  });
});
