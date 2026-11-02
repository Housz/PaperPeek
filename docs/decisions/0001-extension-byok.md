# ADR-0001: Chrome MV3 Side Panel, public PDF.js parsing and BYOK

**Status:** Accepted for v0.1.1 · **Date:** 2026-11-02

## Context

Researchers want to assess and understand the currently open PDF without a separate upload service. They want a portable Markdown paper card and can configure their own API keys. They do not want a paper database, external integrations or developer-run backend.

## Decision

- Start with Chrome MV3 Side Panel, native browser PDF visible beside AI UI.
- For open arXiv URLs, fetch public PDF from trusted extension context and parse text with bundled PDF.js.
- Allow manual PDF file selection as fallback.
- Use direct official provider REST requests with explicit BYOK settings; session-only key default.
- Represent the paper as page-indexed transient text, digest, and plain Markdown export.
- Verify candidate exact quotes against extracted page text before showing a verified citation.
- Defer PDF.js replacement viewer, MIME Handler, OCR and multimodal region selection until justified by tests.

## Why not alternatives?

- **PDF viewer injection:** Chrome native PDF internal DOM/text-layer is not exposed as a normal third-party web page.
- **MIME handler first:** PDF takeover may conflict with existing reader extensions and expands initial build scope.
- **Backend proxy:** violates user's no-backend requirement and creates service-key/account burden.
- **Vector DB/RAG:** current scope is one paper; indexing and prompt budget are enough for v0.1.1.
- **Markdown from transcript:** produces verbose, unstructured archives and may conflate user/AI speculation with paper facts.

## Consequences

- Some PDFs requiring login or complex response handling cannot load.
- Approximate PDF text order and page-only navigation limits precision.
- Direct API BYOK has client-side key risk, mitigated but not eliminated by session storage and explicit opt-in persistence.
- No promise of browser PDF selection/highlight until PoC validates capability.

## Revisit when

Real PDF success rate is inadequate; users demand precise selection/highlights; user research shows enhanced viewer is essential; model providers remove client-side API access.
