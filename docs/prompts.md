# PaperPeek Prompt Library (v1.0.0)

**Code:** \`src/lib/prompts.ts\` · **Updated:** 2026-11-03 · **Owner:** PaperPeek maintainers.

## Purpose

PaperPeek is a research reading companion, not a translation utility. Its prompt library answers three types of questions: **screening** (is this paper relevant?), **understanding** (why/how does the method work?) and **verification** (what evidence supports the claim?). Paper Card output supports quick human recall and future AI reuse without re-reading the entire PDF.

The library is original to PaperPeek. No unpublished or proprietary SciSpace / Explainpaper prompts are copied.

## Research and references

- [OpenAI prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering): explicit task/output contracts, versioned evaluation when models change.
- [OpenAI reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices): straightforward instructions and clear delimiters; no instruction to reveal internal chain of thought.
- [Anthropic prompt guidance](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables): source delimiters, long-document structure and grounding through quotations.
- [SciSpace Copilot peer-reviewed demo (AAAI 2024)](https://ojs.aaai.org/index.php/AAAI/article/view/30578): scientific text explanation, summary and citations as research reader tasks.
- [SciSpace research workflow](https://scispace.com/guides/introducing-copilot-ai-assistant-explains-research-papers): summary/clarification/explanation and original-paper citation navigation.

These sources inform the design principles, **not a claim that their private prompts are available**.

## Shared policy

All tasks are in Simplified Chinese, with scientific terminology convention:

> First use: **中文术语（Original English Term）**; subsequent mentions can use the Chinese abbreviation. For names, algorithms, datasets, acronyms or ambiguous translation, preserve the original spelling rather than inventing a Chinese term.

Example (illustrative, not paper evidence): \`注意力机制（attention mechanism）\`, \`交叉熵损失（cross-entropy loss）\`. This is a **linguistic requirement**, not a guarantee every LLM follows it; add evaluation cases.

Other invariants:

1. PDF pages are presented with explicit \`[PDF page N]\` markers and wrapped as untrusted data, not higher-priority instructions.
2. Source and task are separated by delimiters. The user's question appears after the source and bounded conversation context.
3. Separate **author claims**, **experimental/theoretical evidence** and **assistant explanation/interpretation**.
4. Report missing data, uncertain extraction, truncated text or unreadable equations explicitly.
5. No unsupported novelty ranking, invented numerical results, made-up baseline claims or fake citations.
6. Page numbers in free-form Q&A are **hints** until independently verified; overview findings show a verified link only if normalized quote/page matching succeeds.
7. Metadata source in LLM input **never includes a local \`file://\` path**.
8. Output is compact, specific, and actionable; avoid generic praise or boilerplate.

## Built-in preset registry

| ID | User-facing label | Task contract |
|---|---|---|
| \`intuition\` | 直观理解 | Research problem, simple mechanism intuition, analogy with limits |
| \`method\` | 方法拆解 | Inputs, assumptions, modules, steps, outputs, design trade-offs |
| \`evidence\` | 实验与证据 | Baselines, datasets, metrics, evidence strength, unsupported inferences |
| \`formula\` | 公式讲解 | Symbols, constraints, roles, abstain if PDF extraction loses formula |
| \`terms\` | 术语速通 | 5–8 essential original bilingual terms in this paper's context |
| \`limitations\` | 局限与适用范围 | Distinguish explicit author limitations and assistant hypotheses |

These appear in Ask as compact options; avoid creating a separate navigation tab for them.

## Overview schema

\`overviewPrompt\` returns a JSON object consumed by \`parseDigest\`:

- \`tldr\`: what problem, method and strongest finding
- \`problem\`: specific research gap (not generic intro)
- \`approach\`: up to four essential technical mechanisms
- \`findings\`: \`[{text,page?,quote?}]\` with exact PDF-page quote only when confidently present
- \`limitations\`: explicit bounds and uncertainties
- \`keywords\`: stable bilingual terms

\`digest.ts\` validates fields and literal quote/page matches, then \`markdown.ts\` exports the same normalized analysis. This avoids regenerating inconsistent Markdown and mixing speculative chat with paper evidence.

## Test and evaluation discipline

Existing \`tests/prompts.test.ts\` checks contract/version, bilingual terminology instruction, quote requirement, page markers, local-path redaction and presets. This is **structural** rather than generative-quality evidence.

Recommended prompt evaluation set (with permissions to share each paper):

- At least 3 disciplines; single-column and double-column papers.
- At least 2 papers with mathematical notation and charts; check whether assistant abstains when extracted text is incomplete.
- At least 2 papers with negative/mixed results, measured evidence and limitations.
- Human-reviewed scorecard: factual accuracy, bilingual first mention, unsupported claims, exact citation hit rate, answer usefulness and length.
- Run same samples after model ID or prompt library version changes and record model snapshot, latency, context truncation and cost.

## Prompt maintenance

Do not patch random string literals in UI. Edit \`PROMPT_PRESETS\` and shared \`FOUNDATION\` in \`src/lib/prompts.ts\`. Bump \`PROMPT_LIBRARY_VERSION\` when behavior materially changes. Update test fixtures and release notes in same PR. No raw prompt or PDF document logging in public CI.
