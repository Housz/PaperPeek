# Per-tab reading sessions — PaperPeek v0.1.4

**Status:** implemented; real desktop Chrome manual verification required. **Updated:** 2026-11-04.

## User mental model

Each open Chrome tab represents **one current paper workspace**. The user may switch tabs, return to a paper, temporarily close and reopen the Side Panel, ask questions, jump to cited PDF pages and continue working without losing the paper's completed analysis.

This is **not a persistent research library**. Closed tabs have no saved workspaces. Browser restart and extension reload/update clear the temporary store.

## What is preserved in each tab

| Data | Preserved while Chrome tab/browser session is open? |
|---|---|
| Selected PDF source and detected candidates | Yes |
| Parsed PDF text/pages | Yes |
| Structured overview/digest | Yes |
| Full Q&A visible conversation | Yes |
| Unsent question draft | Yes |
| Last Overview / Ask / Card destination | Yes |
| Regenerated Markdown Paper Card | Yes, derived from PDF + digest (no second copy) |
| API Key / selected AI provider | Separate BYOK settings, **never** part of paper workspace |
| Downloaded Markdown or PDF file | User-controlled outside PaperPeek |
| In-flight LLM operation after Side Panel closes | **No guarantee.** Completed state before closing is saved; running requests may be cancelled. Reopen and retry. |
| After browser restart, extension reload or upgrade | No; Chrome clears \`storage.session\` |

## Lifecycle truth table

| User action | Expected behavior |
|---|---|
| Switch PDF tab A → PDF tab B → A | Restore A's analysis, Q&A, draft and last reading view; B has independent data |
| Two tabs show the same PDF URL | Independent sessions keyed to **tab ID**, not URL |
| Close and reopen Side Panel while Chrome tabs stay open | Restore from \`chrome.storage.session\` |
| Click AI evidence page link \`#page=N\` | Preserve session; PDF hash change is not a new document |
| Go from arXiv \`/abs/ID\` to its \`/pdf/ID\` | Preserve if PDF source identity matches |
| Upload PDF from local picker | Keep parsed text/digest bound to the tab where user chose it |
| Analyze A; switch to B while API response is pending | Save eventual response to A only, never display it under B |
| Navigate in the same tab to an unrelated paper/article | Discard previous paper context; do not mix sources |
| Close tab | Background \`chrome.tabs.onRemoved\` clears only that tab's session |
| Open another tab with same URL after previous tab closed | Start a **new** workspace |
| Browser restart or extension reload | Temporary session storage is cleared (not an archival feature) |
| Storage quota exhausted | Display a persistence warning; recommend copying important results |

## Implementation

- \`src/lib/tab-workspace.ts\` owns \`TabWorkspace\` schema, compressed storage serialization, matching/restore rules, serialized per-tab writes and \`TabWorkspaceManager\`.
- \`src/main.ts\` captures the outgoing tab before activating another, restores cached/session data and checkpoints changes to digest, user question draft, conversation and selected view.
- \`src/background.ts\` removes the tab's cache key when Chrome reports tab closure.
- Workspace keys: \`paperpeek.tabWorkspace.v1.<tabId>\`.
- Store: \`chrome.storage.session\` (in-memory, default trusted extension context; 10 MiB total per extension in modern Chrome). PDF text is gzip-compressed before storing where supported; **compression is not encryption**.
- Never serialize credentials, provider request headers or raw PDF bytes in the workspace. Keys remain separately controlled by \`src/lib/storage.ts\`.
- Updates to workspace snapshots serialize writes per tab. An async response mutates the original workspace cache before awaiting disk/memory persistence so a new tab-switch snapshot cannot overwrite it.
- \`TabWorkspaceManager.updatePaper(tabId,paperId,...)\` discards updates when the paper's identity changed; a closed tab cannot silently be recreated by a slow request.

## Verification

Automated:
- \`tests/tab-workspace.test.ts\`: same/different tabs, hash navigation, arXiv abstract/PDF, local picker, close, large compressed PDF, late answer and stale paper updates.
- \`tests/reader-flows.test.ts\`: actual Side Panel DOM using happy-dom with mocked Chrome and model calls, simulating analysis, free-form Q&A, draft preservation, tab switches, re-opening the panel and same-tab navigation.
- GitHub Actions \`check / test / build\` and unpacked artifact.

Manual desktop Chrome verification is still required:
1. Run a real public arXiv PDF on tab A, generate overview and ask twice.
2. Open a second research PDF on tab B, analyze and ask; return to A, verify A's state and draft intact.
3. Close **only Side Panel**, reopen and verify state retained.
4. Click a verified PDF page reference and confirm conversation/digest survive PDF hash navigation.
5. Close A (not B), reopen the same URL in a new tab; verify clean start. B remains unchanged.
6. Analyze while switching tabs before API completion, ensuring result returns to the original tab.
7. Repeat for local file picker and permitted \`file://\` PDFs.
8. Observe clear behavior on browser restart and extension reload; do not promise persistence across either.

These checks are especially important because a DOM simulator cannot establish real Chrome Side Panel/service-worker lifecycle behavior.
