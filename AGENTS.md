# PaperPeek — AI / developer handoff

This file is the **entry point for coding agents and new maintainers**. Read it before changing code. Keep it accurate whenever architecture, behavior, permissions or API contracts change.

## Mission and frozen scope

Version v0.1.5 is a **single current-PDF** reading helper with structure-focused summaries, Q&A, a short reusable Markdown Paper Card, and local BYOK provider settings. Public arXiv and permissioned local/public PDF sources first. No backend, no user accounts, no paper library, no external integrations, no automatic publication or notebook sync.

## Read order

1. `docs/requirements.md` — accepted behavior and out-of-scope items
   - `docs/tab-sessions.md`: per-tab data lifetime, async results and cleanup
   - `docs/pdf-support.md`: URL/file/HTML detection, permission boundaries, unsupported sources
   - `docs/prompts.md`: versioned bilingual research prompt contracts and evals
2. `docs/architecture.md` — modules and trust boundaries
3. `docs/security.md` — key storage, network, untrusted PDF
4. `docs/testing.md` — automated/manual acceptance
5. `docs/roadmap.md` — future-only ideas, not current functionality
6. `docs/design-system.md` — UI tokens, navigation and interaction contract
7. `docs/verification.md` — tested status and explicit browser/API test gaps
8. `docs/releasing.md` — GitHub Release workflow, build asset and version rules

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
- `src/lib/markdown-view.ts` only untrusted Markdown presentation boundary; raw HTML forbidden, no remote images
- `public/icons/` approved Issue #11 PNG icon assets and `docs/branding/` asset contract
- `tests/` deterministic unit tests; no real API credentials
- `.github/workflows/ci.yml` checks and per-version CI artifact
- `.github/workflows/release.yml` release-only build/test/package/tag/publish (main branch)

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
- **Deliver installable ZIPs via GitHub Releases**, not ephemeral chat attachments or Actions artifacts. Read `docs/releasing.md` before promising a download. Never publish an unmerged PR as a release; after the version bump is merged, inspect the successful release workflow and confirm assets appear.
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

## v0.1.5 handoff note

Run `tests/tab-workspace.test.ts` and `tests/reader-flows.test.ts` after modifying tab activation, state snapshots, async model tasks, model selection, PDF citation navigation, or Side Panel reopening. The workspaces live in `chrome.storage.session` and are cleared on browser restart/extension reload; do not silently turn them into an archival local database. Verify no API credentials enter the workspace snapshot. Follow `docs/tab-sessions.md`.

## v0.1.5 model-status/release invariant

- Keep a single topbar. `modelStatus` must show the active provider and exact model ID **used for new requests**, updating after settings save, and preserve a full tooltip on narrow sidebars. Do not disclose credentials.
- Changes to GitHub Release automation require `tests/release.test.ts`, full CI and a successful release workflow. Do not silently replace a published tag/asset; bump version for future releases. Update README with verified GitHub release link.

## v0.1.5 issue-specific invariants

- Issue #7: Render AI explanations and Paper Card preview via the bundled safe Markdown parser, **not** raw model HTML. Keep untrusted HTML disabled, restrict links, disable network image loading; preserve PDF citation behavior and original `.md` copy/download. Maintain `tests/markdown-view.test.ts` and `tests/reader-flows.test.ts`.
- Issue #11: Use original PNGs from asset branch, wired into Chrome Manifest. Never replace supplied artwork with generated substitutes. `tests/icons.test.ts` checks all four sizes; GitHub Release ZIP verifies all icon paths.

## Issue #14 development branch (supersedes frozen viewer scope above)

The owner authorized implementing Reading Loop on a new branch only. Do not merge main, create tags, dispatch Actions, or publish a release. Validate locally; Actions is unavailable. No default PDF interception.

Read `docs/reading-loop.md` and ADR `docs/decisions/0002-reading-loop.md`. `reader.html` / `src/reader.ts` implement an opt-in full-tab PDF.js Reader; the existing Side Panel remains the sole AI surface. `anchors.ts` owns document fingerprints and A/B/C navigation. `reading-loop.ts` owns explicit reading sessions: a source and its Reader share one synthetic workspace owner, whereas independently opened same-URL sources remain separate. A document fingerprint is not a session ID.

Explicit Translate now also authorizes an AI request. Selection, Ask-draft creation, search, scroll and navigation must never invoke AI. Source/Reader state is temporary, PDF bytes never enter storage. New selection must not silently discard an edited draft. Unverified model page hints must not receive exact quote highlights. Do not claim real Chrome or human-study acceptance from DOM tests; record execution limits precisely.

## Issue #15 development branch (supersedes #14 UI/lifetime constraints)

Read ADR `docs/decisions/0003-local-reading-discussions.md`. Reader now has independent local Ask/Translate interactions; the Side Panel remains the main whole-paper conversation. Cite adds multiple anchored cards without triggering AI. Local saved discussions are the only newly durable research data: `src/lib/annotations.ts` whitelists selected text, anchors and local messages in `storage.local`, keyed by document content. Never persist credentials, source file paths or PDF bytes in annotations. Rebind restored anchors to a new session only after matching the content fingerprint. Main paper workspaces remain ephemeral and tab-isolated. Translation is transient until saved or followed by a question. `reader-settings.ts` stores interaction preferences separately.

Same-tab Reader navigation is supported alongside default new-tab opening. Both the source and Reader URL are valid views of that same-tab session. Use `sessionMatchesTab`, not a one-sided Reader URL check. Native PDF remains optional and is not intercepted. Build and test locally; no Actions, main merge, tag or release is authorized. See the final verification record for actual browser limits.
