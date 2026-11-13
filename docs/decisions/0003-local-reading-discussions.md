# ADR 0003 — Local reading discussions and optional same-tab Reader (#15)

Status: implemented on a development branch, no release; supersedes ADR 0002's sole-AI-surface and transient-only discussion constraints.

## Context

Users need to understand a passage without losing their reading context, cite several passages in a larger question, and revisit questions after closing a popup. The browser's native PDF viewer remains useful and must not be intercepted.

## Decision

- Native PDF + the existing main Side Panel remains supported. Reader is an explicit opt-in enhancement, not a global PDF handler.
- Reader selections expose Ask, Translate and Cite. Ask opens a local multi-turn popup; Translate is a transient result unless explicitly saved or used in a question; Cite adds a source card to the main draft without calling AI.
- Local requests send the selected text and local thread only, not the main conversation or hidden whole-paper context. Provider credentials and adapters are shared; histories are separate.
- Questions are intentionally saved on this browser profile, keyed by the PDF content fingerprint, with only selected text, safe anchors and local messages. Translation can be explicitly saved. No PDF bytes or source file paths are archived. Per-thread and per-document deletion are available; deletion cannot revoke data already sent to a provider.
- Closing a popup hides it; stopping a request aborts it; deleting removes the saved discussion. These actions are separate. Persistent annotations are distinct from temporary navigation highlights.
- Main Q&A and full-paper analysis continue to use transient per-tab workspaces. Independent source tabs do not silently merge their main conversation. Saved local discussions belong to the same document and can reappear when the identical content is reopened.
- Reader may open in a new tab (default) or current tab. In current-tab mode the same tab can represent source or Reader; both URLs belong to the same session until an unrelated navigation or final tab close. Return to source is validated and recoverable.
- Navigation is left-accessible, with outline and discussions. Native PDF outlines are not replaced with guessed headings. Unknown/ambiguous section attribution falls back to page-based discussion access.
- Trigger preference defaults to direct menu display; Alt/Ctrl choices gate showing a selection toolbar, never trigger an automatic model request.

## Consequences and limits

Local saved annotations are not encrypted or synchronized. Browser storage quotas can fail; saving errors must be visible. A changed PDF fingerprint is a different document and must not inherit old highlights. Provider keys retain their existing explicit persistence policy.

There is no guaranteed access to native PDF text-layer selection, browser viewer scroll offsets, protected/one-time PDF sources or exact browser Back restoration. These need real-browser acceptance, distinct from mocked unit/DOM tests.

Current-tab navigation must not be tested merely by seeing a URL change: verify workspace survival, stale async result isolation, failure rollback, return to source, Back, local files and final cleanup.
