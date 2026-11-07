# Test plan — v0.1.5

**Test strategy:** deterministic unit tests in CI + real Chrome/PDF/provider manual smoke. Do not infer successful production behavior from mocked tests.

## Automated (`npm test`)

- arXiv PDF URL normalization and unsafe URL rejection
- provider endpoint, authorization header shape and response parsing, via fake fetch (no real keys)
- digest JSON parsing, exact PDF page quote match and rejection of fabricated references
- Markdown structure, source, verified page and portable filename
- prompt context contains page markers; truncated PDF warning

CI runs TypeScript check, unit tests and bundle build; publishes `dist` artifact.

## UI acceptance (v0.1.5)

Check at 300 / 360 / 450px sidebar width, light and OS-dark modes: source strip is compact and hidden when no PDF or while Settings is open; only Overview / Ask / Card are main tabs; explanation quick questions live in Ask; Settings back restores last reading tab; empty-state actions reflect PDF+BYOK readiness; keyboard arrow keys navigate tabs; paper text, page links, chat and Markdown do not clip horizontally.

## Manual real-browser matrix

| ID | Input & action | Expected |
|---|---|---|
| M01 | Open public arXiv PDF then Analyze | Page-text extraction and overview appear |
| M02 | Open arXiv abstract `/abs/` then Analyze | Public PDF URL normalized and processed |
| M03 | Open a local text PDF via picker | Overview works, no source-page navigation |
| M04 | Upload scanned/image-only PDF | Clear unsupported-text/OCR explanation |
| M05 | Switch to another tab during PDF fetch | Old PDF not shown/queried as current |
| M06 | Provide incorrect API Key | 401/403, no secret rendered or logged |
| M07 | Exhaust model quota or simulate HTTP 429 | Clear quota/rate error, existing text kept |
| M08 | Ask and follow up | Context retains last conversation turns for same paper |
| M09 | Click verified finding page badge | Native PDF navigates to PDF physical page |
| M10 | Model supplies incorrect quote/page | No verified badge; warning appears |
| M11 | Copy and download Paper Card | UTF-8 Markdown clean in Obsidian/VS Code |
| M12 | Resize Side Panel to narrow width | Readable nav, forms, digest, chat |
| M13 | Right click text in native PDF | Record whether Chrome exposes selection to extension; fallback to manual Ask |
| M14 | Public non-arXiv .pdf HTTPS | Permission prompt occurs before fetch |
| M15 | Key persistence default/off/on | Session default, local opt-in, clearing is effective |

## Sample PDF corpus

Use publicly accessible arXiv IDs from at least 3 different research areas, including (a) standard single-column, (b) two-column with equations/figures, (c) long supplementary appendix. Do not commit copyright-restricted PDFs. Record exact URL, date, Chrome version, parsing quality, provider/model, latency, costs (if available), and observed limitations in a test issue.

## CI vs live API

The unit suite deliberately uses only dummy credentials and mocked responses. Actual Gemini/OpenAI/DeepSeek API access requires user-authorized keys and environment with network connectivity. **Do not add real keys as workflow secrets without explicit owner approval.** If live API calls were blocked or not executed, record status as *not verified*.

## Regression checks

Every new Chrome permission, PDF fetch strategy, prompt field, provider adapter or Markdown field needs corresponding tests and user guide update.

## v0.1.5 focused regression matrix

| ID | Case | Expected |
|---|---|---|
| P01 | file:// PDF, file access disabled | Permission guidance and usable file picker |
| P02 | file:// PDF, permission enabled | PDF detected and parsed without picker |
| P03 | Public HTML containing one iframe/embed PDF | Source auto-discovered without model upload |
| P04 | HTML page with several PDF links | Candidate selector; no silent choice |
| P05 | Dynamic HTTPS PDF without suffix | Explicit HEAD/MIME or bounded GET signature identifies PDF |
| P06 | Non-PDF HTML URL | No false-positive PDF status; manual fallback visible |
| P07 | Publisher login / blob / POST-only PDF | Honest failure; allow user-chosen downloaded PDF |
| S01 | Save OpenAI key, switch to DeepSeek | Different keys/models; no cross-provider leakage |
| S02 | Opt-in saved key + browser restart | Local key persists; session-only key expires |
| S03 | Clear one provider key | Other provider secrets remain untouched |
| S04 | Refresh DeepSeek/OpenAI model catalog | GET official endpoint, safe error, custom model fallback |
| R01 | Prompt: method/experiments/formula/terms | First mention Chinese (English) and no invented details |
| R02 | Source contains local path or instruction injection | No local file path in prompt, no execution or obedience to PDF instructions |
| U01 | Side Panel 300/360/450px | Single header, no overflow, 14px reading text, keyboard controls |

Do not interpret mocked tests as successful compatibility tests against publishers or actual browser file access.
## v0.1.5 common researcher journey tests

Automated `tests/tab-workspace.test.ts` and `tests/reader-flows.test.ts` cover compressed storage, A→B→A tab switching, identical URL tabs, reopen panel, draft retention, delayed responses, verified-source page jumps, invalidation on unrelated navigation and tab closure. The UI integration tests execute the **actual Side Panel TypeScript entrypoint and DOM** with mocked Chrome and LLM API calls (happy-dom), not a real Chrome extension runtime.

Manual desktop Chrome end-to-end acceptance required before public release:

| ID | Workflow | Expected |
|---|---|---|
| W01 | Analyze PDF A, ask questions, switch to PDF B, then back | A restores overview, questions, card, no reanalysis |
| W02 | Same PDF opened in two tabs | Independent state per tab ID |
| W03 | Close and reopen Side Panel (not tab) | All completed results and draft restored |
| W04 | Start analysis in A, immediately switch to B, then back | Completed result belongs to A, never B |
| W05 | Start Q&A in A, switch to B during answer | Answer appears only under A |
| W06 | Follow verified source link #page=N | Paper session preserved and browser PDF navigates |
| W07 | Open a different PDF in the same tab | Old paper and Q&A reset |
| W08 | Local file picker PDF on article tab, switch away and back | Restored local imported paper |
| W09 | Close A tab, keep B open | A cache cleaned, B remains |
| W10 | Type unfinished question, switch tabs and back | Draft and last reading view restored |
| W11 | Open Settings while Ask active, return to reading | Same tab and current work remain |
| W12 | Reload extension or restart browser | Temporary sessions clear with explicit documented limitation |

Also test 300/360/450px Side Panel widths, restricted file permission and offline/error handling. Never place real API keys or private PDFs in CI artifacts.

## v0.1.5 release and model status smoke

- Model status: after loading the extension, verify the current service/model name in the single header; change the model ID in Settings and Save, confirm the header updates without refreshing the tab. At 300px width, hover for the full ID.
- Use only a test/dummy key in CI. Model name is independent of the confidential API Key; never display a key in header or screenshot.
- GitHub Release workflow (after merge to main): verify GitHub Actions check/test/build success, tag `v0.1.5`, GitHub Release Assets `PaperPeek-v0.1.5-chrome.zip` and `SHA256SUMS.txt`. Unzip and confirm `manifest.json` is at ZIP root.
- Loading from Release assets is a **manual Chrome smoke**. Verify real PDF analysis and tab continuity after installation; do not infer it from unit or mocked DOM tests.

## v0.1.5 issue regression cases

| ID | Workflow | Expected |
|---|---|---|
| MD01 | Ask model returns `## Heading`, `**bold**`, Markdown list | Headings, emphasis, lists are rendered; no raw markers |
| MD02 | Ask returns table, fenced code, blockquote | Proper structure, horizontal scroll for wide code/tables |
| MD03 | Model returns script tags, event-handler HTML, JS/file/data links, remote image | No script/iframe/img element and no remote image requests |
| MD04 | Model returns `[PDF p.N]` in prose and code | Prose hint is clickable only for valid page; code remains unchanged |
| MD05 | Card summary generated and copied with preview open | Preview formatted; clipboard/download exactly the original Markdown |
| MD06 | Toggle Card source/preview, switch tabs, reopen panel | No losing digest or `.md` source; preview can be rebuilt |
| ICON01 | Extension loads with approved 16/32/48/128 PNGs | Icon visible at toolbar and extension manager, transparent outer corner |
| ICON02 | Build/release asset ZIP | All icon sizes included, Manifest references existing files |

Review the approved Issue #11 artwork visually in a real Chrome profile; binary file/PNG header tests cannot certify rendering at every DPI. The UI DOM tests use simulated Chrome and model calls, not a real desktop browser.
