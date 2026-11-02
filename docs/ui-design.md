# PaperPeek interaction design — v0.1.2

**Status:** Implemented compact reader UI. See [design system](design-system.md) for tokens and component contract.

## User mental model

The user has **one open PDF** and needs a quick decision. Avoid asking them to learn a feature taxonomy. The order is:

1. **Which paper?** Detect current arXiv/PDF and show the source in a compact strip. If none, show a single contextual empty state.
2. **What next?** Analyze when model is configured, otherwise configure API Key. Do not hide prerequisites behind error messages.
3. **What did the paper actually say?** Overview presents TL;DR, problem, approach, findings with checked source links, limitations and keywords.
4. **What don't I understand?** Ask directly, optionally with one of four small starter questions (no standalone Explain tab).
5. **What should I keep?** Card provides a compact Markdown summary with Copy/Save. It is not a notes library.

## Navigation and layout

Header: **PaperPeek** + Settings (utility icon). A document strip appears only when PDF is known and hides while Settings is open. Main navigation: **概览 | 提问 | 卡片**. Settings is a separate view with an explicit **返回阅读** action.

### Removed from v0.1.1

- Dark gradients, teal glow, decorative logos/version badge and GitHub footer.
- Feature-card grid and standalone Explain tab: explanation is a question type, not a separate destination.
- Five-item tab row, large boxed overview sections, repeated process tips.
- Chatbot-style boxed assistant answers and unnecessary uppercase labels.

### Kept

All v0.1.1 core behaviors: public arXiv and manual PDF, provider selection/BYOK, analyzed digest, free-form Ask, concise Markdown copy/download, verified page-link and unverified-page disclaimers.

## Interaction states

| Context | UI response |
|---|---|
| No PDF | Show "从一篇论文开始" and primary "选择 PDF". Current-source strip hidden. |
| Recognized PDF but no API Key | Source strip + "先连接你的模型"; Analyze label becomes "配置模型". |
| Recognized PDF + key | Source strip with "分析论文"; empty state indicates next step without duplicating the CTA. |
| Loading PDF or model | Disable conflicting actions and show compact status in live region. |
| Digest ready | Overview immediately populated, no giant instruction panel. |
| Chat | Prompt suggestions shown until first message, then hidden. Composer anchored to lower part of content view. |
| Settings | Hide tab nav + source strip; explicit return to last reading tab. |
| Invalid or unavailable source | Error state, manual file upload remains accessible. |
| Verified evidence | Inline page link, explicitly matched page quote. |
| Model page hint (unverified) | Linked navigational hint with tooltip warning, not a proof badge. |

## Accessibility

- Native buttons, labels and textareas; proper \`role=tablist/tab/tabpanel\` semantics, roving tab index and arrow navigation.
- A descriptive accessible name for icon buttons.
- Inline messages use \`aria-live=polite\`.
- Keyboard focus remains visible; semantic \`hidden\` controls visibility.
- No unsanitized HTML from PDF or models.

## Next UX validation

Test real Chrome Side Panel in widths 300/360/450px, with 2-line titles, long model answers, failed requests, native PDF page navigation and light/dark system settings. Do not claim actual Chrome extension smoke is complete merely because Vite and mocked DOM checks pass.
