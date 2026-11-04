# Interaction design — PaperPeek v0.1.4

**Status:** implemented, manual Chrome verification pending.

## User workflow

1. User opens any PDF or an HTML page containing PDF links.
2. A **single topbar** shows the current source, re-detection, local upload, Analyze and settings. Re-detection is always available.
3. If no direct PDF is recognized, PaperPeek inspects page links/embeds; explicit re-detection may inspect response MIME/signature. If several candidates, user chooses one; manual URL/file is the fallback.
4. If viewing a local `file://` PDF without permission, display "allow file URLs" instructions and link to extension details.
5. First use: select provider and configure API Key; official OpenAI/DeepSeek model options fetched from their own API; custom ID remains available. Gemini is manual for this iteration.
6. Overview presents research problem, approach, evidence-backed findings and limitations.
7. Ask: free-form question or choose from six scientific prompt presets; bilingual terminology is used on first occurrence where feasible.
8. Card: copy/download a concise Markdown digest.

## Primary information hierarchy

One header (~65px), three tabs (Overview, Ask, Card), task content. No second paper bar. Settings is a utility page with explicit Back, not a fourth tab. Source chooser and paste-link fallback appear only when relevant. Paper content should occupy the majority of the narrow sidebar.

## Honest states

| Scenario | Next action |
|---|---|
| No PDF recognized | Detect current page, upload PDF, or paste URL |
| Multiple PDFs found | Choose correct link; do not guess |
| Local file access disabled | Enable "Allow access to file URLs" in Chrome extension details |
| URL recognized but API Key missing | Configure provider |
| Paper present but not analyzed | Analyze in single header |
| Summary ready | Read, follow verified page links, Ask or export |
| Dynamic HTML / protected iframe | Manual URL/file fallback with clear limitations |
| Model list unavailable | Keep current/custom ID, show failure reason and offer manual retry |
| Key session-only | Warn about loss when browser session ends; opt-in to local persistence |
| API model 404 | Explain unavailable model, advise refresh and retest |

## Input/permission distinctions

- Page DOM inspection does not send model requests and does not collect arbitrary webpage content for archival.
- Explicit Detect may make HEAD/short GET to the **current** website, after permission as necessary.
- Analyze performs full PDF fetch and transmits extracted text to selected LLM only after user action.
- Existing extension permission for another origin does not imply access to arbitrary private files.
- Local file path is not included in generated AI prompts or Markdown card.

## Accessibility and QA

Three tabs with roving tabIndex; named icon actions; 2px keyboard focus; status live region; model picker can be operated by keyboard; buttons disabled during active long tasks. Check 300/360/450px, system dark mode and long Chinese model names, compare with [design system](design-system.md).

## v0.1.4 continuity and Settings affordance

Chrome tabs act as independent paper workspaces: the Overview/Ask/Card view, questions, unsent draft and Paper Card follow each tab. Switching to another PDF must not erase the first; reopening the global Side Panel should restore the active tab. The Settings action uses a recognizable gear shape (`svg[data-icon="settings"]`) and remains distinct from sun/moon theme controls.

The status badge may show **处理中** when a model call is ongoing in the active tab. Switching to a different tab permits the second paper to be used independently; a delayed response returns only to the original tab.
