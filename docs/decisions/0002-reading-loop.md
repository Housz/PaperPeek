# ADR 0002: opt-in PDF.js Reading Loop

Status: accepted for the Issue #14 development branch; not a release.

## Context

The native PDF `#page=N` URL fragment is a navigation hint, not proof that a
viewer reached the requested physical page. It cannot establish quote geometry.
Replacing an article tab with its PDF also destroys the original browsing entry
point. Native viewers do not expose a stable selection/text-layer API to this
extension.

## Decision

Keep normal browser PDF behavior unchanged. An explicit Reader action or evidence
click opens or reuses a separate, bundled PDF.js Reader for that reading session.
The existing Side Panel remains the only AI interface. No MIME interception,
remote PDF service, account, archive, OCR, or automatic analysis is introduced.

Three identities remain distinct: a reading session owns the workflow, a content
fingerprint identifies the PDF, and browser tabs are display endpoints. Source and
Reader share a session; independent opens of an identical URL do not. The last
associated tab closing ends temporary retention. PDF bytes remain in active UI
memory, never in `storage.local` or the compressed session workspace. Lost local
bytes require explicit reselection of the matching file.

Navigation reports A (unique verified quote and mapped geometry), B (physical
page only), or C (unusable document/identity/page). Model page hints never become
verified quotations. Ambiguity degrades rather than guessing. Coordinates use
PDF-relative geometry and are projected again after zoom/rotation. A bounded
return-position history restores the prior view.

Selection Ask prepares an editable source-bearing draft without calling a model.
Translate is an explicit request through the existing BYOK provider; selected
text has priority over bounded adjacent context, with fidelity instructions for
numbers, conditions, uncertainty and terminology. Existing drafts are protected.

## Alternatives

- Native `#page`: retained only as an explicitly weaker source fallback; not the
  trust or geometry layer.
- MIME handler: rejected for this stage because it takes over default workflows
  and complicates compatibility/permissions.
- Full reader in Side Panel / second chat: rejected because PDF needs space and
  split conversations obscure ownership.
- Persistent binary cache: rejected for this stage; changes retention/privacy
  expectations and requires a separate policy.

## Consequences and acceptance limits

PDF.js adds a full reading surface and rendering lifecycle to maintain. A mock DOM
cannot certify canvas geometry, Chromium extension lifecycle, native selection,
or Side Panel focus. Deterministic tests, original PDF fixtures, and a runnable
installed-extension smoke complement real desktop and real-user observation;
none substitutes for the latter. No releases or Actions workflows are triggered
by this branch's development checks.
