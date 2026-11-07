# Security and privacy — PaperPeek

## Threat model

1. **API Key compromise:** A browser extension is not a hardened vault. Keys placed in local Chrome storage can be retrieved by actors with relevant device/profile access. By default PaperPeek stores a key in `chrome.storage.session` and only persists in `storage.local` with explicit consent. Prefer a limited-use key, spending limits and frequent rotation. Never share keys in chat, issues or commits.
2. **Third-party model processing:** A user click causes extracted PDF text to be sent over HTTPS to a chosen provider's official endpoint. Provider retention and processing policies are external to PaperPeek; no PaperPeek backend exists.
3. **Host permissions:** Static origins are restricted to arXiv and three official APIs; other HTTPS .pdf hosts require a user-granted optional host permission. Do not broaden hosts without review.
4. **Untrusted PDF:** The file may have malformed structures, embedded adversarial instructions and private/unpublished research. Check size, PDF header and parser errors. Prompt instructs model to treat PDF as data, but this does not guarantee injection immunity.
5. **Untrusted model text:** Render only as text/textarea; no unsanitized HTML, remote scripts or code execution.
6. **Fabricated evidence:** Verify candidate quote against extracted text of specified page; only then label verified navigation. Quote matching proves literal presence, not semantic correctness. Q&A citations are unverified.
7. **Data retention:** PDF bytes and Paper/Digest/chat live in current extension UI memory; no remote archive. User-exported Markdown is under their control. Settings and opt-in persistent keys live in Chrome storage.

## Secret hygiene

Never add keys to Git, Actions YAML, local fixtures, screenshots, console output or issue body. Avoid request-body or header logging. If any key has been shared in a conversation or publicly exposed, rotate/revoke it and review provider quota usage. A rotated key should be entered in Settings, not hardcoded.

## Release security review

Verify manifest host/optional permissions; verify service worker and PDF.js worker are packaged locally; verify all model strings use textContent; verify no analytics; verify no key in `dist`; verify correct authenticated request target and safe errors.

## Boundaries and known gaps

Client-only BYOK is not equivalent to a backend secret management solution. Password-protected PDFs, scanned PDFs and publisher login workflows are out of scope; user must not rely on PaperPeek for confidential research without reviewing the provider's data policy.

## v0.1.3 expanded source/model boundaries

- Chrome "Allow access to file URLs" allows extensive local file access. PaperPeek uses it **only for the current explicitly opened file PDF**; it never scans directories. Use file picker instead if this broad permission is unacceptable.
- PDF detection on HTML pages reads only PDF source URLs from accessible DOM; it does not transmit arbitrary article page text to model. Explicit Detect may send HEAD or a small Range GET to the current website with permission, without cookies. File source path is redacted in model prompts and exported Markdown.
- Optional HTTPS host permission is per actual PDF host. Credentials to a publisher site are not forwarded in v0.1.3; authenticated PDFs may require explicit user download.
- Per-provider API Keys are distinct. A secret can only be durably saved by opt-in. Chrome local storage is **not encrypted**, and clearing the extension's key does not revoke a leaked provider key.
- Do not log model list responses containing user data or HTTP request headers. Model list is from fixed official API endpoints, not arbitrary remote endpoint values.
- Keep file URL, embedded HTML, dynamic PDF and prompt-injection regressions in CI and manual privacy review.

## v0.1.4 temporary paper session storage

- Research text, digest and Q&A are cached **in memory** through `chrome.storage.session` per Chrome tab while the browser and extension session remain active. This enables tab switching and Side Panel reopening without repeated PDF uploads or LLM calls.
- Gzip packing is only a quota optimization, **not encryption**. Workspaces are only accessible to trusted extension contexts by default; credentials continue to live in their separate BYOK storage keys and must never be included in `TabWorkspace`.
- `tabs.onRemoved` deletes the closed tab's workspace. The extension does not create a permanent paper archive, and browser restart/extension reload clears Chrome session storage.
- PDF source URLs may contain filenames or query strings. They stay local to the browser session; never transmit local `file://` paths in LLM prompts.
- If session storage quota is exhausted, display a warning and advise copying Markdown; never silently claim persistence succeeded.

## v0.1.5 untrusted Markdown presentation (#7)

- `src/lib/markdown-view.ts` bundles `markdown-it@15.0.3` in the extension. It is configured with `html: false`, no automatic linkification, image syntax disabled and an explicit HTTP(S)-only link allowlist.
- Parser-produced markup is inserted through a DOMParser document; **raw source HTML never goes to `innerHTML`**. Script tags, event handlers, SVG and remote image tags contained in LLM/PDF source remain escaped text or inert Markdown syntax.
- External links open in a new tab using `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`; Markdown cannot trigger a background image request.
- PDF citation hints are converted only from plain text nodes outside code/links and cannot execute instructions.
- Rendered formatting is a presentation layer only. `toMarkdown` output, source evidence validation and clipboard/download keep their existing semantics.
- Regression tests must include script/link injection attempts and excessively long model responses.
