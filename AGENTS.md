# PaperPeek — AI / developer handoff

This file is the **entry point for coding agents and new maintainers**. Read it before changing code. Keep it accurate whenever architecture, behavior, permissions or API contracts change.

## Mission and frozen scope

Version v0.1.4 is a **single current-PDF** reading helper with structure-focused summaries, Q&A, a short reusable Markdown Paper Card, and local BYOK provider settings. Public arXiv and permissioned local/public PDF sources first. No backend, no user accounts, no paper library, no external integrations, no automatic publication or notebook sync.

## Read order

1. `docs/requirements.md` — accepted behavior and out-of-scope items
   - `docs/tab-sessions.md`: per-tab data lifetime, async results and cleanup
   - `docs/pdf-support.md`: URL/file/HTML detection, permission boundaries, unsupported sources
   - `docs/prompts.md`: versioned bilingual research prompt contracts and evals
2. `docs/architecture.md` — modules and trust boundaries
3. `docs/security.md` — key storage, network, untrusted PDF
4. `docs/testing.md` — automated/manual acceptance
5. `docs/roadmap.md` — future-only ideas, not current functionality
7. `docs/design-system.md` — UI tokens, navigation and interaction contract
6. `docs/verification.md` — tested status and explicit browser/API test gaps

## Code map

- `public/manifest.json` Chrome MV3 permissions
- `src/background.ts` right-click selection and panel opening
- `sidepanel.html`, `src/styles.css`, `src/main.ts` UI and transient session
- `src/lib/urls.ts` URL normalization/safe source gates
- `src/lib/detection.ts` HTML source discovery and explicit MIME/signature probes
- `src/lib/document.ts` public fetch and PDF.js parsing
- `src/lib/prompts.ts` paper prompts, context and multi-turn Q&A
- `src/lib/provider.ts` OpenAI / Gemini / DeepSeek REST adapters
- `src/lib/digest.ts` schema validation and quote/page verification
- `src/lib/markdown.ts` deterministic Markdown export
- `src/lib/storage.ts` per-provider BYOK profiles, opt-in persistent keys, legacy migration
- `src/lib/tab-workspace.ts` compressed per-tab ephemeral research state; must never contain API keys
- `tests/` deterministic unit tests; no real API credentials
- `.github/workflows/ci.yml` checks and packaged extension build

## Invariants — DO NOT BREAK

1. **No hardcoded keys.** Do not copy any secret from chat, local machine or CI into repository, issue, screenshot, error log or commit history.
2. **No backend.** Provider requests originate in trusted extension context; do not introduce a proxy or account system unless requirements change.
3. **No silent uploads.** Detection can inspect current page DOM; explicit retry can make a bounded request to the current host. No AI calls without Analyze/Ask. Only user-triggered analysis/Q&A may transmit extracted PDF contents to the selected provider.
4. **No raw model HTML.** All PDF/model text goes into `textContent` / textarea, never unsanitized `innerHTML`.
5. **No fabricated citations.** Verified findings require an exact normalized quote on the claimed PDF page. Other page hints must be labeled unverified.
6. **No hidden archive.** Store only settings and intentional key persistence; keep paper sessions transient.
7. **Never imply PDF.js viewer/highlighting or OCR already works** in this version. It is on the roadmap.
8. **One paper per tab.** Each open Chrome tab has its own temporary research session. Switching/reopening Side Panel must not lose completed work or leak it into another tab; close-tab cleanup is mandatory. Switching tabs must not send an earlier paper to the model.

## Workflow

- Create feature branch and small PR; link it to issue, affected documents and reproducible tests.
- Update docs + CHANGELOG for any user-visible feature or limitation.
- Run `npm run check && npm test && npm run build` and check CI status.
- Manually verify `docs/testing.md` with arXiv sample and an authorized BYOK key **outside CI and public logs**.
- Pay attention to consent/permissions, Chrome sidePanel behavior, tokenizer/context truncation, model error states, and PDF source switching.
- Prefer a pure helper with a unit test over adding browser-only logic to `src/main.ts`.

## Future architecture decisions

Write an ADR in `docs/decisions/` for migration to MIME Handler, PDF.js viewer, secret storage change, remote backend, or retrieval infrastructure. Keep rejected alternatives recorded, not silently removed.

## v0.1.3 checks

- Updating PDF detection requires permission-on/off, candidate list, file:// and dynamic endpoint regression tests.
- Updating provider settings requires per-provider key isolation, session vs local retention, legacy migration and official GET /models mock tests.
- Updating prompt templates requires bilingual first mention and evidence abstention checks; bump PROMPT_LIBRARY_VERSION on substantive changes.
- Use `docs/verification.md` to distinguish CI green from manually verified publisher/Chrome behavior.

## v0.1.4 handoff note

Run `tests/tab-workspace.test.ts` and `tests/reader-flows.test.ts` after modifying tab activation, state snapshots, async model tasks, model selection, PDF citation navigation, or Side Panel reopening. The workspaces live in `chrome.storage.session` and are cleared on browser restart/extension reload; do not silently turn them into an archival local database. Verify no API credentials enter the workspace snapshot. Follow `docs/tab-sessions.md`.
