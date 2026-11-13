# Reading Loop branch verification — 2026-11-13

Local TypeScript, Vitest (105/105 across 18 files, repeated three times after adversarial review fixes), and Vite production build passed for the Issue #14 implementation checkpoint. No GitHub Actions run or release was requested. New tests cover anchors/session lifecycle, actual Side Panel DOM with mocked Chrome/provider, Reader DOM with mocked PDF.js/Chrome, and bounded translation prompts. See [full matrix and limitations](reading-loop.md).

Installed Chromium startup was attempted but blocked by this executor's Unix socket permissions; existing managed-browser policy does not allow extension installation UI. Real extension, publisher/provider, quantitative navigation and 3–5-person usability acceptance therefore remain **not verified**. Do not equate mocked tests with end-to-end acceptance.

---

# Verification report — PaperPeek (through v0.1.4)

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

## v0.1.3 — expanded PDF detection, model catalog, scientific prompts (2026-11-03)

**Automated check:** [GitHub Actions run 41659198358](https://github.com/Housz/PaperPeek/actions/runs/41659198358) completed successfully on the feature branch after the latest model-refresh and PDF-error changes. Strict TypeScript, Vitest, and Vite extension packaging all passed. An earlier passing v0.1.3 run 41658003460 reported **8 test files / 33 tests passing**; model/source/prompt/security tests use fake model responses and no real API keys.

**Build verification:** the unpacked extension includes `manifest.json`, `sidepanel.html`, `assets/background.js`, bundled local JS/CSS and the PDF.js worker. Packaging does not imply Chrome runtime success.

**Static interface review:** actual built HTML/CSS was inspected with isolated Chromium snapshots at **300, 360, and 450 px**, including paper overview, settings, and dark mode empty state. No horizontal overflow observed; one shared header measured approximately 65 px; reading body text uses 14 px. This is static visual inspection, **not** an end-to-end extension test.

**Not yet proven by real desktop Chrome tests:**
- Direct automatic reading of a `file://` tab with Chrome's "Allow access to file URLs" toggle both OFF and ON.
- Publisher-host HTML `iframe/embed/object` detection, selection of the correct candidate, and HTTP redirect/CDN behavior.
- Dynamic no-`.pdf` endpoint via real HEAD and ranged GET on multiple real sites.
- OpenAI and DeepSeek official `GET /models` from a user-owned browser key, successful model generation, restart persistence.
- Prompt content accuracy, bilingual first mention consistency, quote-semantic correctness over an expert-audited PDF corpus.
- Full real-extension keyboard/permission navigation and security posture across Chrome versions.

**Environment blocker:** the isolated automated browser environment did not successfully register a locally loaded unpacked extension service worker; thus live Chrome extension, local-file, and provider tests were not completed. Headless `page.set_content` screenshots only validate markup/style, not Chrome APIs.

**Release decision:** v0.1.3 remains an experimental MVP suitable for owner-run Chrome smoke tests, not a blanket guarantee for publisher or restricted PDFs. Follow [PDF support matrix](pdf-support.md), [test matrix](testing.md), and [Prompt evaluation plan](prompts.md). Never attach credentials or proprietary PDFs to tickets.


## v0.1.3 follow-up verification — 2026-11-04

- **[CI run 41759810505](https://github.com/Housz/PaperPeek/actions/runs/41759810505): PASS**. Strict TypeScript, **8 test files / 34 passing tests**, Vite build, packaged manifest/service-worker checks and upload of `paperpeek-v0.1.3-unpacked`.
- Fixed an async race in `refreshActiveTab()`: a generation token now rejects late scans after another tab event or an explicit user source selection. Source detection for icon-only/aria-labeled PDF links now has a DOM-mocked regression test.
- Verified archive contents include `manifest.json`, `sidepanel.html`, `assets/background.js`, bundled JS/CSS and the local PDF.js Worker. ZIP is the unpacked developer-extension artifact; it is **not a signed Chrome Web Store release**.
- Attempted a real extension session in isolated Chromium using the unpacked ZIP and Playwright persistent context. Chromium launched but reported **zero registered extension service workers**, so no reliable extension-origin UI or file-scheme test could be completed in this environment.
- Documentation fix: the original v0.1.3 Markdown docs had escaped backticks in several files; restored standard fenced code blocks and inline code so GitHub renders them correctly.

**Still awaiting genuine desktop Chrome acceptance:** toggle file URL access off/on and read the currently opened local PDF without a file picker; test several public non-arXiv publisher URLs (including downloads that redirect to CDNs); verify real OpenAI/DeepSeek model catalog requests and persisted BYOK key after restart; validate page navigation and multi-PDF choice; expert-check terminology and source accuracy of the prompts.

The automated test counts above do **not** certify those browser/provider workflows. Continue to call v0.1.3 an **experimental MVP** until the owner records actual pass/fail evidence using the matrix in `docs/testing.md`.


## v0.1.4 — tab workspace continuity and settings icon (2026-11-04)

**Verified in CI:**
- [Passing GitHub Actions run 41766461379](https://github.com/Housz/PaperPeek/actions/runs/41766461379): strict TypeScript check, **51/51 passing tests in 10 test files**, Vite bundle build, packaged manifest / service worker checks and zipped unpacked extension artifact.
- [`tests/tab-workspace.test.ts`](../tests/tab-workspace.test.ts) (12 cases): per-tab storage isolation, same-URL tabs, A→B→A, local PDF manual import, saved draft, fragment navigation, arXiv abstract-to-PDF, delayed results, source invalidation, tab closure and gzip round trip.
- [`tests/reader-flows.test.ts`](../tests/reader-flows.test.ts) (5 cases): actual Side Panel DOM/TypeScript entry with **mocked Chrome tabs, storage and provider**. Tests analyze A → ask → B → A → reopen panel, delayed digest, delayed chat response, source navigation, citation page jump and Settings return.
- [`tests/ui.test.ts`](../tests/ui.test.ts) ensures accessible gear icon (`data-icon="settings"`) rather than sun-shaped appearance affordance.
- `chrome.storage.session` snapshot includes paper text, digest, messages, draft and reading destination but **never API keys**. Tab-close event removes that tab's state.

**Not tested as real Chrome acceptance:**
- Desktop Chrome global Side Panel switching and closing/reopening with an actual live PDF and actual provider key.
- Persistence behavior when several windows are open; interactions with browser memory pressure or exceeding `storage.session`'s 10 MiB quota.
- Real file URL permissions and publisher redirect behavior after reopening the panel.
- In-flight provider calls if the Side Panel is closed: browser may terminate requests. The product only promises restoration of **completed** work.
- Browser restart or extension reload/update clears ephemeral `storage.session` per official Chrome documentation, even when Chrome restores tabs; a future opt-in durable cache would need separate requirements and privacy review.

**Release status:** experimental MVP v0.1.4. Simulated UI tests plus a packaged build give stronger confidence than pure unit tests, but they are not a real desktop Chrome extension smoke test. Follow [tab-session manual checklist](tab-sessions.md) and [testing](testing.md) before store publication.


## v0.1.5 — Issues #7 and #11 (2026-11-07)

**Implementation:** Markdown formatting and Paper Card preview/source toggle are implemented in `src/lib/markdown-view.ts`, `src/main.ts`, and `sidepanel.html`. The renderer uses patched, bundled `markdown-it@15.0.3` with raw HTML disabled, HTTP(S)-only external links, and remote image loading disabled. The browser icons are the **original approved PNGs** from Issue #11's [existing Git blob commit](https://github.com/Housz/PaperPeek/commit/6f1d76681cb0d5265bbf198598f0071251a300b8); Chrome Manifest, CI and Release checks reference all sizes.

**Tests written (outcome pending GitHub runner):**
- `tests/markdown-view.test.ts`: headings/emphasis/tables/code, raw HTML/script and unsafe link rejection, no image fetch, bounded input and PDF navigation hints.
- `tests/reader-flows.test.ts`: actual simulated Side Panel DOM Markdown answer rendering, Card default preview ↔ raw source, unchanged Markdown export.
- `tests/icons.test.ts`: PNG signature, exact 16/32/48/128 dimensions, transparency metadata and Manifest paths.
- `tests/release.test.ts`: matching v0.1.5 manifest/package version, required release-notes asset and icon paths in release pipeline.

**GitHub Actions execution blocker:** On 2026-11-07 PR #12 runs [42348885708](https://github.com/Housz/PaperPeek/actions/runs/42348885708) and [42349019960](https://github.com/Housz/PaperPeek/actions/runs/42349019960) reported `failure` **without any job steps or available logs**; attempting to fetch logs returned `BlobNotFound`. To isolate the fault, temporary diagnostic draft PR #13 used **unchanged v0.1.4 main source**, but its runs [42349226102](https://github.com/Housz/PaperPeek/actions/runs/42349226102) and [42349300804](https://github.com/Housz/PaperPeek/actions/runs/42349300804) also failed before all job steps, including an explicit `ubuntu-24.04` runner. The diagnostic PR was closed without merge. This is **not evidence that the new tests failed**. It indicates a GitHub Actions runner/workflow/account environment blocker; its exact cause could not be established from the connected API. GitHub's public status board has not confirmed a current global outage.

**Release gate:** Do not state v0.1.5 is downloadable until the `Publish Chrome extension Release` workflow completes on `main`, and GitHub shows the `PaperPeek-v0.1.5-chrome.zip`, `SHA256SUMS.txt` assets plus a `paperpeek/release-assets` success status. Do not bypass this with a manually renamed temporary artifact. Run the owner-controlled desktop Chrome smoke of Markdown, icon and PDF behavior after release build.


## v0.1.5 merge and blocked GitHub Release (2026-11-07)

- PR [#12](https://github.com/Housz/PaperPeek/pull/12) merged into `main` as commit `5706d1aade72b592dfbf3e5de91b0c4e972222c7`; source version and Manifest are `0.1.5`. Issues [#7](https://github.com/Housz/PaperPeek/issues/7) and [#11](https://github.com/Housz/PaperPeek/issues/11) were automatically closed by GitHub.
- GitHub Actions [Release run 42349500943](https://github.com/Housz/PaperPeek/actions/runs/42349500943) **FAILED twice** before any runner steps (attempts 1 and 2): GitHub REST job output has `steps: []`, `runner_name: ""`, approximately two seconds to failure, and no job logs. **No v0.1.5 Release was created.**
- The push [CI run 42349500894](https://github.com/Housz/PaperPeek/actions/runs/42349500894) also failed before steps.
- Independent non-merged diagnostic PR [#13](https://github.com/Housz/PaperPeek/pull/13) using unchanged v0.1.4 source failed before runner steps on `ubuntu-latest` and on explicitly pinned `ubuntu-24.04`. Thus the no-runner failure cannot be attributed to v0.1.5 Markdown or icons; the underlying repo/account Actions execution condition **remains unverified**.
- GitHub's release API returned 404 for `v0.1.5`; its list still contained only v0.1.4. **Do not claim v0.1.5 is downloaded, tested or published** until the automated release workflow succeeds and its ZIP+SHA256 are both verified.
- To unblock: repository owner should inspect the **job annotations/banners** on the linked Actions run, check Settings → Actions → General and account billing/spending limits/runner access. The connected tool could not read those annotations or billing settings. After resolving the underlying problem, go to Actions → **Publish Chrome extension Release** → Run workflow on `main` (or rerun the failed run). The existing `workflow_dispatch` path builds and publishes v0.1.5 without changing its source version. Confirm the automated `paperpeek/release-assets` success commit status.
- Real Chrome and actual provider smoke also remain pending; CI could not validate this version. The new source-level regression tests are committed but **have not executed successfully in Actions**.

Maintainers: this blocked release is a delivery/environment issue; don't fabricate green checks or upload unverified artifacts by renaming old v0.1.4 binaries.

## Issue #15 development verification (2026-11-13)

- Changes implement local popup Ask/Translate, persistent local discussions, multiple main-chat citation cards, left navigation, same-tab/new-tab Reader opening and compact provider/model header.
- Real Chromium launch was retried using installed `/usr/bin/chromium` and Playwright. Startup failed before any page/extension check at `socket() failed: Operation not permitted` (including the allowed elevated path). No alternative connected computer was available. **Real Chrome MV3/native Side Panel acceptance remains unexecuted**, not passed.
- `scripts/browser-smoke.mjs` is updated for the new interactions and current-tab Back/Forward flow. It uses the actual built extension but synthetic network and an inactive extension tab hosting production Side Panel UI; it is not a substitute for native Side Panel, live API, publisher or human usability acceptance.
- No live API key was used in automated tests; all provider responses are mocks. No GitHub Actions, release/tag or main merge were run.
- Final integrated checks: TypeScript passed; all **142 tests across 20 files passed twice consecutively**; Vite production build passed; `git diff --check` and browser-harness syntax passed. Vite retains a >500 kB shared-chunk size warning. These are automated/mock results, not browser or live-provider acceptance.
- Independent review follow-up: citation deduplication now distinguishes identical text using the original anchor's prefix/suffix and verification fields; sent citation navigation preserves that full anchor rather than rebuilding a quote-only target. Added a repeated-text regression covering save/reopen and exact target forwarding.
- Independent review follow-up: unchanged navigation settings no longer trigger a second fit redraw. Layout requests now use a latest-request barrier so observer/navigation rendering cannot reuse a canvas while a newer layout clears layers. Added deferred-render/rapid-zoom and own-storage-notification regressions.
- After these follow-up fixes: TypeScript and production build passed; **145 tests / 20 files passed twice consecutively**; diff whitespace check passed. Browser limits above are unchanged.

### Reader-entry state regression fix

The main Side Panel now hides the entire Reader-entry row (including open-mode menu) while the visible tab is PaperPeek Reader. It shows the entry on a usable native/source page, and hides it in Settings, on empty pages and on expired Reader pages. Detection uses the actual visible tab URL, not the shared workspace source URL or a tab ID that can also represent same-tab Back/Forward. View-only controls refresh even when the source and Reader share an unchanged workspace. Added regression coverage for source/Reader switching, same-tab Back/Forward, Side Panel reopening, settings and empty/expired pages.
Verification for this follow-up: TypeScript, all 148 tests across 20 files, production build, diff whitespace check and browser-harness syntax passed. Native Chrome execution remains blocked as documented above.

### PDF-only Ctrl+wheel zoom follow-up

Previously there was no Reader wheel interception, so Ctrl+wheel could invoke browser page zoom rather than PDF rendering scale. Chrome documents automatic zoom as normally origin-scoped; Reader and panel share an extension origin. The reported panel coupling is consistent with that mechanism, but was not independently reproduced in real Chrome here. The new non-passive listener is scoped to PDF content, cancels cancellable Ctrl+wheel (including trackpad-style events), normalizes delta modes, clamps PDF scale and preserves the cursor's document point. Ordinary scrolling, form controls and keyboard/browser zoom remain unchanged; existing browser zoom is not automatically reset.

TypeScript, all 151 tests across 20 files, production build and diff checks passed. The browser harness now includes trusted Ctrl+wheel and Reader/panel browser-zoom comparisons, but that runtime remains unexecuted due to the documented launch restriction.
