# Reading experience — Issue #15 development

## Two reading modes

Native browser PDF reading plus PaperPeek's Side Panel remains available for detection, analysis and whole-paper questions. It does not guarantee native-viewer selection overlays or exact text-layer control. The opt-in PaperPeek Reader adds local Ask/Translate/Cite and discussion markers. Opening the Reader does not call AI or globally intercept PDFs.

Settings offers **new tab** (default) and **current tab**. The Reader button uses that preference; the adjacent action menu offers either explicitly. Source and corresponding Reader share the main temporary workspace, while independently opened source tabs remain separate. Return source activates or reopens the origin. Browser Back/Forward are supported by the same-tab identity rules, but native PDF scroll restoration and protected-source availability require real-browser verification.

## Selection toolbar

Default: show after selecting text. Settings can require Alt or Ctrl at selection completion. Selection alone never calls AI. Alt+Q provides a keyboard path. Copy shortcuts must not send requests. Toolbar items have icons, short labels and full accessible descriptions.

- **Ask:** open a local popup, type a question and submit. Subsequent turns belong to that local thread. Only the selection and local history are sent, not the main conversation or unseen whole-paper context.
- **Translate:** explicitly request a Chinese translation of the selection. The result is transient until Save, or until a follow-up question converts it to a saved discussion.
- **Cite:** add a source card to the main question draft without sending. Existing typed text is preserved. Up to eight selections / 24,000 characters can be assembled; duplicates are not silently multiplied. Each sent card retains its own return-to-source action.

The local popup can close while generating without stopping. Stop cancels the request; failures can retry. Closing does not delete saved questions. Main conversation and local discussion remain separate; the popup can cite its original passage into the main draft.

## Local records and navigation

Saved discussions are local to this browser profile and keyed by PDF content fingerprint. They survive restarting the browser, unlike the main paper workspace. Saved data contains selected text, anchors and local messages, not PDF bytes or API credentials, and is not encrypted/synced. Delete one discussion or clear this document's discussions. This does not delete messages already sent to the main conversation or provider-side copies.

Temporary navigation highlighting differs from persistent question/translation markers. Click a marked passage or its page marker to reopen a discussion. Ambiguous or unavailable exact matching falls back to the physical page. Overlapping discussions can be selected from the discussion list. A changed PDF is a different identity and does not inherit highlights.

The left navigation is directly accessible, with Outline and Discussions. Outline preserves PDF hierarchy with separate expand/collapse and destination actions. It uses the embedded PDF outline, not AI-generated headings. Discussion counts are only attributed to a section when the page range is sufficiently clear; otherwise use the page list. Empty-outline PDFs remain usable. The navigation can resize, collapse and become a drawer in a narrow viewport.

## Model header

The main AI header shows the provider mark plus configured model ID, with a full provider/model tooltip. Bundled assets make no external request. Provider settings and credential handling are otherwise unchanged.

## Verification distinction

Automated tests use deterministic Chrome/PDF/model mocks. The Playwright script exercises the built MV3 package with synthetic network if a permitted Chromium environment is available. It does not test a live provider or replace real native Side Panel usability checks. See `verification.md` for executed status. No release is authorized by this issue.

Concurrent editing: saved discussions use per-document Web Locks and optimistic revisions. If another Reader edits or deletes the same discussion, a stale write is rejected with a copy/reopen message rather than silently overwriting the other window. Closing a request before completion leaves its submitted question available for retry on reopening.

### Reader entry and zoom boundaries

The Side Panel's Reader-entry button and open-mode menu are hidden when the actual active page is already PaperPeek Reader (also in Settings or without a usable paper). Returning to the native/source page restores the entry, including same-tab Back/Forward.

PDF-area Ctrl+wheel is intended as document zoom, distinct from browser page zoom. Chrome's automatic browser zoom is normally origin-scoped ([official zoom-scope reference](https://developer.chrome.com/docs/extensions/reference/api/tabs#type-ZoomSettingsScope)); Reader and Side Panel use the same extension origin. The Reader handles cancellable Ctrl+wheel events only in the PDF region to update PDF rendering scale and preserve the pointer anchor, including trackpad pinch events emitted as Ctrl+wheel. Ordinary scrolling and browser-level keyboard zoom remain available. Existing browser zoom is not forcibly reset, preserving accessibility preferences.
