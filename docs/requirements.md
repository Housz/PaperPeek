# Requirements / PRD — PaperPeek v0.1.1

**Status:** accepted initial scope. **Owner:** repository maintainer. **Last updated:** 2026-11-02. Change with a PR when behavior changes.

## Product statement

PaperPeek helps a scientist decide **whether to read** the PDF, understand research logic, check key claims against source pages and preserve a **compact Markdown paper card**. It is a reading companion, not a bibliography manager.

## Audience and jobs

| Job | Expected outcome |
|---|---|
| Screen unfamiliar research | Explain research question, mechanism, evidence, limitations without reading every page |
| Understand methods | Clear explanation of mechanism and experiments; Q&A about selected parts |
| Verify claims | Click validated page citation; avoid unsupported confidence claims |
| Reuse findings | Copy/download concise stable Markdown that future humans and AI can parse |

## Version boundaries

**IN:** One current text-based PDF, public arXiv as main test, local PDF fallback, BYOK Gemini/OpenAI/DeepSeek, summary, Q&A, preset explanations, verified digest page references, page navigation, Markdown export.

**OUT:** Multi-paper research, permanent archive, Obsidian/Zotero/GitHub connection, profile/login/backend, scanning/OCR, automatic source discovery, precise text highlighting, annotated PDF, region screenshot, chart detection, automated novelty/quality ratings.

## User stories and acceptance

- **P0 PDF:** Given an accessible `arxiv.org/pdf/...` or `arxiv.org/abs/...` tab, clicking Analyze fetches and extracts visible text by PDF page. If parsing fails, show an error and offer local selection. Reject >25MB and textless scans.
- **P0 BYOK:** A new user selects provider, model ID and key and tests the connection. No key is present in source or CI. Default key persistence is session-only; opt-in local persistence is plainly disclosed.
- **P0 Overview:** After analysis, show TL;DR, research question, method, findings, limitations and keywords in concise Chinese. Separate author claims from verified findings in prompt; never give unsupported numeric paper scores.
- **P0 Source:** A finding's clickable verified citation only exists if the quoted snippet matches the claimed PDF page. Otherwise visibly label source position unverified. PDF navigation is page-level in Chrome's native viewer.
- **P0 Ask/Explain:** User can ask a free-form question, see answer and retain recent conversational context. The answer should state uncertainty when source is insufficient. Preset prompts are quick entry points. Chat page labels are navigational *hints*, not verified evidence.
- **P0 Markdown:** Overview yields deterministic Markdown with title, author if available, URL, TL;DR, problem, approach, findings, limitations and keywords. Support copy and UTF-8 download. Do NOT dump transcript into the card.
- **P1 selection:** Context menu may relay selected text to Ask if supported by the current PDF viewer; lack of selection support must not break the main workflow.
- **State isolation:** Switching active tab resets current paper memory and does not leak previous paper into new requests. No long-term document database.
- **Error handling:** Provider 401/403/429 and request timeout have safe, comprehensible errors; do not expose secret values.

## Non-functional requirements

- Readable at 300–450px sidebar widths; keyboard focus visible.
- Model / PDF source text rendered as plain text, not executable HTML.
- Source PDF and prompt not sent before deliberate user action.
- No requests to developer-operated services or analytics destinations.
- Graceful failure for disconnected network, unsupported PDF, model mismatch and pages beyond context cutoff.
- Docs and tests maintained in same PR as feature changes.

## Unresolved usability questions

How many pages in a typical discipline? Should digest be auto-generated on PDF load or via a second click? Should users prefer a native PDF alongside Side Panel or a replacement viewer? Gather manual test evidence before redesign.

## Success signals

Time to initial paper decision; answer correctness audited against PDF; ratio of verified digest evidence; public PDF load success; Markdown reuse without edits. Do not report invented benchmark scores.
