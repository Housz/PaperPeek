# Technical architecture — v0.1.1

**Approach:** Backend-free Chrome Manifest V3 Side Panel. PDF.js parses and extracts text in trusted extension UI; providers are called over HTTPS with the user's key. Browser-native PDF remains the main viewer.

```mermaid
flowchart TD
 Tab[Active public PDF tab] --> Resolve[URL + optional origin permission]
 File[Manual local PDF] --> Parser[PDF.js in Side Panel]
 Resolve --> Fetch[Size-limited PDF fetch] --> Parser
 Parser --> Paper[Transient Paper & pages]
 Paper --> Prompt[Overview or Ask prompt]
 Prompt --> Adapter[Provider Adapter]
 Settings[Session BYOK / opt-in local storage] --> Adapter
 Adapter --> API[Gemini / OpenAI / DeepSeek API]
 API --> Parser2[Structured digest / chat text]
 Parser2 --> Verify[Quote match within PDF page]
 Verify --> Overview[Overview & page navigation]
 Verify --> Markdown[Deterministic Paper Card Markdown]
 ```

## Boundaries

- `src/main.ts` owns active tab, ephemeral Paper/Digest/chat, DOM orchestration and user actions.
- `src/background.ts` owns action opening and selection context menu, writing temporary selection to `chrome.storage.session`.
- `lib/urls.ts` normalizes arXiv PDF/abstract links, screens unsupported URLs and builds PDF `#page=N` fragments.
- `lib/document.ts` downloads at most **25 MiB**, sniffs PDF header, runs PDF.js locally, collects up to **125,000 characters** with explicit truncation.
- `lib/prompts.ts` treats paper as data, sets output format and uses last six recent messages for follow-ups.
- `lib/provider.ts` keeps three REST adapters and no provider SDK injection; 90s timeout, sanitized HTTP errors.
- `lib/digest.ts` validates schema and verifies a finding's literal quote on the claimed page after whitespace normalization.
- `lib/markdown.ts` deterministically serializes paper/digest; display and export share the same data.
- `lib/storage.ts` stores provider/model in `storage.local`, key by default in `storage.session`, optional local key persistence.

## Data model

```text
Paper { id, sourceUrl?, title, authors?, pages:[{page,text}], totalPages, truncated }
Digest { tldr, problem, approach:[], findings:[{text,page?,quote?,verified}], limitations:[], keywords:[] }
ChatMessage { role:'user'|'assistant', text }
Settings { provider, model, rememberKey } + key (trusted extension context only)
```

Page is the **PDF physical page index starting at 1**, not printed journal pagination. Native Chrome PDF's `#page=N` is best-effort page navigation, not a precise highlight API.

## Trust and consent

- User clicks Analyze to fetch PDF and make provider request; credentials are not included in PDF download.
- HTTPS API requests go to fixed, manifest-declared official endpoints. No arbitrary user-defined remote endpoint in this release.
- Model/PDF output goes to `textContent` or textarea; never `innerHTML`.
- Model-generated `page`/ `quote` is *candidate evidence*. Only quotes found on that extracted page enable verified navigation.
- Chat answer page hints are explicitly unverified.
- Third-party model processes transmitted PDF text under its own data terms; PaperPeek does not proxy, log or store papers in a server.

## Known technical debt

The PDF extraction currently follows PDF.js item order; complex two-column reading order and math may degrade quality. Text-based prompts are bounded, not retrieval-augmented. Direct API access can fail if keys, quotas, policies or model IDs differ. UI is one entry point for now; extract state/controller modules as complexity grows.

## Extension build

Vite bundles `sidepanel.html` and `src/background.ts`, with fixed `assets/background.js` service-worker path. Static `public/manifest.json` is copied to `dist/manifest.json`. PDF.js worker is bundled from `pdfjs-dist/...worker...mjs?url` as a local asset to comply with MV3 no-remote-code policy.

See ADR and Testing for why no MIME interception or PDF.js replacement viewer yet.
