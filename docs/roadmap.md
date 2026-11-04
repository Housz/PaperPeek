# Roadmap and open questions

## Shipped target: v0.1.1–v0.1.4 (subject to real-browser smoke)

Chrome Side Panel; single public arXiv or locally picked PDF; local PDF.js text extraction; Gemini/OpenAI/DeepSeek BYOK; overview, explain starters, Q&A, quote-verified findings, page links; Markdown card. No backend.

## Candidate v0.1.2 (validation-driven)

- Add better reading-order recovery for two-column PDF layouts and PDF metadata handling.
- Improve chapter detection, long context budgeting, and provider-specific errors/retries.
- Improve citation matching from normalized excerpts and expose citation audit state.
- Add lightweight language preference and optional alternative Markdown length.
- Improve UI responsiveness, loading progress and session restoration on tab switch.

## Candidate v0.2+ (requires architecture decision)

- PDF.js enhanced reader with text selection, text-layer anchors, formula/figure region selection and overlay highlights.
- Optional Chrome MIME Handler interception where technically appropriate; user choice and conflict handling are essential.
- Image-driven formula/figure explanation for compatible multimodal providers.
- Optional on-device OCR for textless PDFs.
- Better document-level retrieval for long paper Q&A.

## Explicitly excluded until requirements change

Multi-paper corpus, remote database, Zotero/Obsidian/GitHub integration, shared API keys/backend, scientific novelty scoring and automatic bibliography management.

## Decision criteria

Prioritize success rate on real arXiv PDFs, user time-to-understanding, quote verification accuracy, export portability and cost transparency. Do not introduce expensive new infrastructure without usage evidence.

## v0.1.4 known follow-ups

- Real browser/manual publisher matrix, cookie-protected PDF fallback and redirects to CDN hosts.
- Improve detection of cross-origin frames, `blob:` documents and POST/signed PDFs through explicit opt-in reader/MIME Handler design (requires Chrome 151+ and architecture approval).
- PDF selection and precision highlight in controlled PDF.js viewer, rather than Chrome native internals.
- Model capability validation beyond heuristics (official list is not a definitive Chat Completions compatibility flag).
- Human-reviewed prompt evaluation, bilingual glossary consistency and hallucination metrics.

## v0.1.4 completed workflow continuity

Per-tab ephemeral sessions, Side Panel reopen, tab-close cleanup, delayed model answer routing and conventional Settings gear. Future versions may add user-opt-in durable research history, but **no automatic archival** is introduced in this patch.
