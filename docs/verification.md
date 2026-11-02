# Verification report — PaperPeek v0.1.2

**Date:** 2026-11-02  
**Status:** automated checks successful; real browser end-to-end and live provider call **not yet verified**.

## Confirmed automated checks

GitHub Actions on PR #1:
- [Passing run 41382227409](https://github.com/Housz/PaperPeek/actions/runs/41382227409): Node 22 dependency install, strict TypeScript check, Vitest **15/15 passing**, Vite production build, manifest/sidepanel/background packaging checks, and upload of unpacked extension.
- One earlier run failed on npm's `edgesOut` dependency resolution; addressed via `legacy-peer-deps` install policy, subsequently recorded in `.npmrc`.
- A subsequent run found a PDF.js TypeScript option mismatch; fixed by matching the current PDF.js API.
- Manual source review added a guard so a slow provider response cannot be displayed after the user changes the active paper/tab.

Automated unit coverage:
1. arXiv/HTTPS PDF URL handling and unsafe URL rejection
2. Provider request formation and response decoding with dummy credentials and mocked network
3. Digest JSON schema and exact candidate quote verification against the declared physical PDF page
4. Deterministic Markdown export and download filename sanitation
5. Prompt construction, page markers and truncation disclosure

The build output includes a bundled PDF.js worker (`assets/pdf.worker...`), sidepanel resources, Manifest V3 and a service worker. No real API Key was used by CI.

## UI refresh validation

The UI structure now has `tests/ui.test.ts` for navigation, unique IDs, accessible control labels and semantic tokens. Visual inspection in Chromium is a supplement, not proof of real Chrome extension compatibility.

## Not verified yet — important

- A fully functional Chrome extension session in an actual unrestricted desktop Chrome environment.
- Re-fetching representative public arXiv PDFs from **inside the extension** (including redirected CDN destinations).
- Native Chrome PDF context-menu selection availability on Chrome releases and OS variants.
- A complete real provider request using any private Gemini/OpenAI/DeepSeek API key.
- Actual page-jump behavior on native Chrome PDF viewer.
- Cross-platform appearance / accessibility / performance.
- Accuracy of scientific digest content beyond mocked parser and citation tests.

Browser-based testing in the execution environment was blocked by sandbox/browser policy (`ERR_BLOCKED_BY_ADMINISTRATOR` on localhost and inability to load an unpacked Chrome extension); this is a test environment limitation, **not a successful extension end-to-end test**.

## Manual acceptance checklist for release owner

Follow [testing.md](testing.md), especially M01–M15, on desktop Chrome. Use an **independently created, rate-limited API key** entered only in extension settings. Do not publish test keys, prompts containing confidential research, or error logs with credentials. Log actual Chrome version, PDF source and model identifier. Update this document with observed passes/failures before tagging or publishing v0.1.2.

## Interpretation

**CI green ≠ production-ready.** The code and bundle are available to install experimentally. Report the runtime and provider smoke as pending until a desktop Chrome session verifies the full flow.


## v0.1.2 UI refresh verification — 2026-11-02

- GitHub Actions [run 41385847837](https://github.com/Housz/PaperPeek/actions/runs/41385847837): dependency installation, strict TypeScript, **20/20 Vitest checks (6 test files)**, Vite build and packaged extension checks passed. Build artifact: \`paperpeek-v0.1.2-unpacked\`.
- \`tests/ui.test.ts\` guards the three reading tabs, settings escape, unique UI IDs, explanatory question entries, focus-related markup and **WCAG 4.5:1 minimum contrast** for light theme's small-text/action tokens against white.
- Visual layout was inspected in an isolated headless Chromium using the **actual Vite-produced sidepanel HTML/CSS** plus representative *static* mock paper/response content. Widths: **300px, 360px, 450px**. No horizontal overflow observed; inspected Overview, Ask, Card, Settings and a dark-mode empty state.
- This visual check was not a real extension API / PDF / LLM end-to-end test: local navigation was blocked by sandbox policy, so snapshots used \`page.set_content\` rather than the actual extension runtime. Real Side Panel accessibility and runtime behavior in desktop Chrome remain manual release criteria.
- Fixed a contrast issue discovered during review: small muted text token \`--faint\` was changed from \`#859099\` to \`#6a7680\` to meet >=4.5:1 on white. Disabled Copy/Save before card generation.
