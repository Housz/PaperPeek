# User guide — PaperPeek v0.1.1

## Requirements / setup

Chrome 116+, Node 22.12+, npm. From repository root:

```bash
npm install
npm run check
npm test
npm run build
```

At `chrome://extensions`, enable Developer mode → Load unpacked → choose `dist`. Pin the PaperPeek extension if helpful. For source edits run `npm run dev`, then reload the extension.

## Configure an AI model

Open extension Side Panel via toolbar icon → Settings (⚙) → choose provider → choose/edit model ID → paste API key → Save. Use **Test connection** for a short request. Defaults: `gemini-2.5-flash`, `gpt-4.1-mini`, `deepseek-chat`. Models may change; use a model ID available to your account.

API keys are session-only by default; persistent storage requires ticking a checkbox. The provider itself may charge for model calls. Use an account-specific limited key, never paste it into a GitHub issue.

## Analyze one paper

1. Open `https://arxiv.org/pdf/<valid-id>` (or abstract URL).
2. Click PaperPeek icon and choose **Analyze current paper**. The extension downloads the public PDF, extracts page text locally and sends the limited text to your chosen model.
3. Review Overview. Click validated evidence references to navigate to the claimed PDF page.
4. Ask follow-up questions in **Ask** or select starter questions under **Explain**.
5. **Card** → Copy Markdown or Download `.md` to any local knowledge base.

Alternative: **Open PDF** to select a file; no automatic page navigation is available from a locally uploaded file in this version.

For PDFs on other HTTPS origins ending in `.pdf`, the extension will ask for optional host access. Authenticated publishers, embedded PDF viewers and one-time links are not guaranteed. `file://` tab auto-reading is not supported: use manual upload.

## Selection context menu

Right-click selected text → `Explain with PaperPeek`. Chrome may not expose text selection from its internal PDF Viewer to third-party extensions. When it does, the quoted passage is inserted into Ask. If not, copy the sentence into Ask manually.

## Output quality

Paper Card contains Title, Authors, Source URL (if available), TL;DR, Problem, Approach, Findings, Limitations and Keywords. It is a summary, **not the PDF**. Verified page badges mean a model-supplied quote matched text extracted from that page; this does not independently prove the scientific interpretation. Chat page numbers are only unverified navigation hints.

## Troubleshooting

| Symptom | Action |
|---|---|
| No relevant PDF URL | Open direct arXiv PDF or use Open PDF |
| Failed to fetch | Check public URL, permission and network; try manual upload |
| No selectable text | PDF may be scanned; OCR not supported |
| 401 / 403 | Check API key, account permissions and provider |
| 429 | Check model quotas / balance / rate limit |
| Long paper truncated | Summary covers only input text; do not treat it as exhaustive |
| No page hyperlink | Evidence quote could not be verified or file is local |
| Formula text is poor | PDF layout issue; direct image crop planned, not yet available |

If a bug is reproducible, report Chrome version, *public* arXiv link, model name (never key), symptoms and console errors with secrets removed.
