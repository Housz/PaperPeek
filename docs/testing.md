# Test plan — v0.1.1

**Test strategy:** deterministic unit tests in CI + real Chrome/PDF/provider manual smoke. Do not infer successful production behavior from mocked tests.

## Automated (`npm test`)

- arXiv PDF URL normalization and unsafe URL rejection
- provider endpoint, authorization header shape and response parsing, via fake fetch (no real keys)
- digest JSON parsing, exact PDF page quote match and rejection of fabricated references
- Markdown structure, source, verified page and portable filename
- prompt context contains page markers; truncated PDF warning

CI runs TypeScript check, unit tests and bundle build; publishes `dist` artifact.

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
