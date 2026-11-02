# Roadmap and open questions

## Shipped target: v0.1.1

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
