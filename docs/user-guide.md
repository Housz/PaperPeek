# PaperPeek user guide — v0.1.5

**Chrome 116+ · single research PDF · no PaperPeek backend.** Experimental extension; test with public materials first.

## Install from GitHub Releases (recommended)

1. Open [PaperPeek Releases](https://github.com/Housz/PaperPeek/releases) and select **v0.1.5**.
2. Under **Assets**, download `PaperPeek-v0.1.5-chrome.zip`. **Do not use the auto-generated GitHub Source code ZIP**, which is not the built extension.
3. Unzip into a stable local folder. The folder you select must directly contain `manifest.json`.
4. In Chrome open `chrome://extensions`, enable Developer mode → **Load unpacked** → select that folder.
5. Configure your own AI API Key in PaperPeek Settings.

Optional: download `SHA256SUMS.txt` from the same Release to verify the archive.

**Updating an existing installation:** replace files within the same unpacked directory and click Reload in `chrome://extensions`. Avoid removing the extension first, since reinstallation into a different directory can change the extension identity and local settings. Save important Markdown before Reload: completed paper sessions are intentionally temporary and may be cleared.

To build from source (developers only): Node.js 22.12+, `npm install && npm run check && npm test && npm run build`, then load the generated `dist/` folder. See [Release process](releasing.md).

## Quick start

1. Open a PDF in Chrome, or an article page that has a PDF download/link.
2. Click PaperPeek. The **single top row** contains the current source, **↻ Detect**, **choose file**, **Analyze** and Settings.
3. If no PDF was automatically recognized, click **重新检测**. The extension checks PDF links/embeds and, on a direct dynamic URL, may probe its PDF response type. Several candidates? Select the intended paper.
4. If detection is impossible, expand **无法自动识别？粘贴 PDF 地址** and enter a public HTTPS URL, or choose local PDF with the file button.
5. Open Settings → choose DeepSeek / OpenAI → enter API Key → click **刷新官方列表** to fetch model options; select model and **测试模型**. The chosen ID is used directly in the API call. There is a **手动填写模型 ID** option for models absent from the list.
6. **保存设置** to apply. For API Key reuse after browser restart, check **在此设备保存 Key（关闭后仍可使用）**. This is *opt-in* and local storage is not an encrypted vault.
7. Click **分析**. Read Overview; ask questions or choose research prompt presets; copy/download Card as `.md`.

The compact top status displays the **current provider and exact model ID used for new requests** (for example, `DeepSeek · deepseek-flash`). Hover over the truncated label on narrow Side Panels to see the full ID. This is the *current configuration*, not a retrospective claim about which model generated earlier answers.

## Read the PDF already opened locally (`file://`)

Previously PaperPeek ignored `file://` URLs. Now it recognizes `file:///.../paper.pdf` opened in Chrome, subject to **file scheme permission**.

1. Open the PDF locally in Chrome.
2. At `chrome://extensions`, find **PaperPeek**, open its detail page, enable **Allow access to file URLs / 允许访问文件网址**.
3. Return to the local PDF tab and click **↻ 重新检测** → **分析**.

If you cannot enable that permission, the file-picker button still allows you to share **one chosen PDF** with the extension. The local file path is never included in model prompts or exported Markdown.

## Other websites

- **Direct `.pdf` URL:** recognized on HTTPS. The first analysis from a non-preauthorized website prompts for permission to that host.
- **Article page with `iframe/embed/object` or a PDF button:** detected using a DOM scan (works on ordinary accessible HTML). It does **not** search in restricted cross-origin frames.
- **Public URL without `.pdf` suffix:** explicit detection checks HEAD MIME; if inconclusive, a short ranged GET checks PDF signature.
- **Signed or authenticated publisher content:** may fail, because PaperPeek does not send login cookies by default. Save the permitted PDF yourself and use the file picker.
- **Blob URL, POST-only download, image-only PDF:** no automatic re-fetch/OCR. A later enhanced reader may cover more scenarios.

See [PDF support matrix](pdf-support.md).

## AI providers and model selection

Model list endpoints for **OpenAI** and **DeepSeek** are their official APIs. The list updates on entering Settings with an existing key and via **刷新官方列表**. Not all listed OpenAI models support the current **Chat Completions** API; always use **测试模型** before analyzing an entire PDF. Custom ID fallback is available; the current model configuration is not a cosmetic field.

DeepSeek fallback ID: `deepseek-flash` (the official catalog decides availability). OpenAI fallback ID: `gpt-4.1-mini`. Existing users' previously saved model choices remain until explicitly changed. Gemini uses a manually entered model ID this iteration; no Gemini API behavior change.

API keys are stored **separately per provider**. Switching providers does not copy the previous provider's key. Session keys disappear after browser session ends. Optional long-term local persistence survives reopening, until you press **清除 Key** or delete extension data.

## Reading and reusable Markdown

Overview highlights research problem, mechanism, evidence/limitations. Key technical terms should first appear as **中文术语（English Term）**. Assistant may make errors; verified findings link to text that matched a specific physical PDF page, while general chat page hints are not independently verified. Card is a concise stable Markdown digest, not a transcript or a substitute for the paper.

## Troubleshooting

| Problem | What to try |
|---|---|
| Local file can't load | Enable file URL access in extension details; alternatively choose file |
| Current page not recognized | Click ↻, choose candidate, paste PDF URL, or choose file |
| Site asks for login / download fails | Save allowed file via browser, then choose it manually |
| API model list fails | Check key/permissions, choose custom ID and Test Model |
| Model 404 | Refresh official list, choose a supported model, retest |
| Key vanishes after restart | Enable opt-in local key persistence and Save; confirm provider |
| Unsupported scanned PDF | OCR is not yet shipped |
| Formula/figure garbled | PDF.js text extraction may lose layout; visual crop is not shipped |

Never paste keys in issues, screenshots or debugging logs. Use a separate limited-quota API key.

## Markdown reading and Paper Card (v0.1.5)

**Ask:** AI responses now render Markdown headings, emphasis, nested lists, tables and fenced code as reading content. References such as `[PDF p.3]` are clickable *navigation hints* only; their source location is not independently verified. Raw HTML in the answer is escaped rather than executed, and remote images are never loaded automatically.

**Paper Card:** Open the **卡片** tab to read formatted Markdown by default. Press **查看源码** to inspect exact Markdown text; press **显示预览** to return to formatted reading. **复制 Markdown** and **保存 .md** use the original text, not a rendered HTML export. Your Obsidian workflow and file format are unchanged.

**Browser icon:** Chrome now shows the approved folded-paper/side-eye PNG logo at toolbar and extension settings sizes. If an old icon remains, reload the unpacked extension at `chrome://extensions` and check that the selected directory contains `icons/icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png`.
