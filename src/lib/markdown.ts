import type { Digest, Paper } from "../types";

function inline(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}
function bullets(items: string[]): string {
  return items.length ? items.map(s => "- " + inline(s)).join("\n") : "- 论文未提供足够信息。";
}
export function toMarkdown(paper: Paper, digest: Digest): string {
  const findings = digest.findings.map(f =>
    f.text + (f.verified && f.page ? "（PDF p." + f.page + "）" : ""));
  const source = paper.sourceUrl?.startsWith("https://")
    ? "[Open source PDF](" + paper.sourceUrl.replace(/\)/g, "%29") + ")"
    : "Local PDF (not exported)";
  return [
    "# " + inline(paper.title),
    "",
    "**Authors:** " + inline(paper.authors || "Not available"),
    "**Source:** " + source,
    "**PDF pages:** " + paper.totalPages,
    "",
    "## TL;DR", "",
    digest.tldr || "信息不足。", "",
    "## Research Problem", "",
    digest.problem || "信息不足。", "",
    "## Core Approach", "",
    bullets(digest.approach), "",
    "## Key Findings", "",
    bullets(findings), "",
    "## Limitations", "",
    bullets(digest.limitations), "",
    "## Keywords", "",
    digest.keywords.map(inline).join(" · ") || "Not available", "",
    paper.truncated ? "> ⚠ PDF text was truncated before analysis; this card may be incomplete.\n" : "",
    "> AI-generated summary. Verify important claims against the original paper.",
    ""
  ].join("\n");
}
export function markdownFilename(title: string): string {
  const safe = title.normalize("NFKC").replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-").replace(/[^\p{L}\p{N}._-]/gu, "").slice(0, 65);
  return (safe || "paper") + "-PaperPeek.md";
}
