# PDF source support and detection design — v0.1.3

**Status:** implemented detection paths, live website compatibility to be verified. The word "candidate" does not mean fetch success. Date: 2026-11-03.

## Why v0.1.2 missed files

The prior `candidatePdfUrl` recognized arXiv abstract/PDF and ordinary `https://.../*.pdf` only. It intentionally rejected `file://` and could not discover publisher links or inspect dynamic endpoints. Authenticated publishers also often cannot be re-fetched without session cookies, which PaperPeek deliberately does not send by default.

## Detection ladder

| Stage | Trigger | Behavior |
|---|---|---|
| 1. URL | Current tab on open/update | Recognize arXiv, `.pdf` on HTTPS, local `file:///*.pdf` |
| 2. HTML | Current tab on open, after complete | Using `chrome.scripting.executeScript`, examine top-document `iframe`, `embed`, `object`, link `type`, visible PDF links; no network/upload |
| 3. Explicit retry | Refresh button | Repeat URL + DOM scan, request one-site access if necessary, probe current URL via HEAD `Content-Type: application/pdf` |
| 4. PDF signature | Explicit retry if HEAD fails or is inconclusive | Use short Range GET; cancel after first chunk, check `%PDF-` signature |
| 5. Candidate selection | Multiple links found | Show selector; never silently choose among unrelated files |
| 6. Manual fallback | User enters a direct URL or chooses local file | Validate HTTPS or explicitly permitted file scheme, request one-site access on Analyze |

No background scanning of arbitrary browsing history; no arbitrary remote-code execution; no auto-upload to model. Detection may cause a **small request to the current website only when user clicks Refresh**.

## Local file scheme

Chrome extension must declare a file match pattern and user must opt in to **Allow access to file URLs** at `chrome://extensions/?id=<PaperPeek extension id>`. Check `chrome.extension.isAllowedFileSchemeAccess()` before fetching. Without it, show a direct permissions guide/button; user can still choose the file via browser file picker (explicitly shared file).

The URL may expose local filenames/path. PaperPeek only uses it inside the extension for reading/page navigation and **does not include the local file path in LLM prompts or Markdown output**.

## Why some websites are still unsupported

- `blob:`/in-memory PDF streams inside a page do not expose a re-fetchable HTTPS source.
- Cross-origin iframes whose real source is hidden from top document.
- Signed, POST-only or single-use PDF download URLs.
- Websites requiring cookies, tokens, SSO or anti-bot measures; current HTTPS fetch omits cookies.
- `http:` (non-TLS) sources are excluded deliberately to avoid insecure document fetch.
- Encrypted, image-only or malformed PDFs; OCR not shipped.

Chrome 151+ PDF MIME Handler offers a future optional viewer takeover path for response-body streams and POST cases, but requires an ADR and must not silently replace the browser's PDF viewer.

## Required compatibility test matrix (NOT claims of passing)

| Class | Example source type | Check |
|---|---|---|
| Direct accessible | arXiv PDF, ACL Anthology direct PDFs | URL detection, redirect, actual PDF bytes |
| Embedded HTML | Publisher or society HTML article with embedded PDF | DOM/iframe/object detection, candidate choice |
| Dynamic endpoint | An explicitly public `/download?id=...` | HEAD and signature fallback, optional host permission |
| Multiple PDFs | Article with main paper and supplementary files | Multi-select and correct context |
| Local | Desktop Chrome opening `file:///.../paper.pdf` | File access off/on, automatic reading |
| Public repository | Institution repository, Zenodo, OSF accessible PDF | Redirect and permission handling |
| Restricted | Login-only journal, signed download, blob URL | Honest error and manual file picker |

For tests record URL **only when publicly shareable**, OS/Chrome version, expected type, permissions, PDF parser success, model request, page jump and errors. Do not commit restricted PDFs or credentials. Start with manually selected real examples instead of inventing publisher URLs.

## Permission review

Manifest declares `scripting`, `activeTab`, file URL host pattern, specific provider endpoints and optional HTTPS host access. User consent is required for additional sites. File URL permission is powerful; document this clearly in the permission rationale and do not probe a local file in background.

## Engineering follow-up

Investigate redirect-to-CDN origin behavior, double-column reading order, hidden cross-origin PDF viewers and per-origin permission revocation. Keep `lib/urls.ts`, `lib/detection.ts`, `src/main.ts`, `tests/detection.test.ts` and this file in sync.
