# PaperPeek design system — Reader UI v0.1.2

**Status:** Implemented · **Updated:** 2026-11-02 · **Scope:** Chrome Side Panel at ~280–500px. This is a local CSS token system; no imported React/Tailwind component library.

## 1. Why this design

PaperPeek is a reading tool, **not a chatbot dashboard**. The user is already looking at the PDF. The extension should answer one question at a time while leaving maximum space for the source document.

Inspiration, not copied code:

- [GitHub Primer — Layout](https://primer.style/product/getting-started/foundations/layout/): focused hierarchy, natural reading order, responsive narrow surfaces.
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming): semantic tokens for foreground, muted, border, primary, error; do not spread raw hex values across components.
- [shadcn/ui compact styles](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/design-system.md): compact / Nova-like controls (roughly 32–36px), subtle borders instead of large cards and shadows.
- [Radix Themes — Typography](https://www.radix-ui.com/themes/docs/theme/typography): consistent type scale and line-height.
- [Chrome Extensions UI](https://developer.chrome.com/docs/extensions/develop/ui): Side Panel remains an adjunct to the user's active document.

No third-party UI code/assets, font hosting or dependencies were added. Reference links document rationale, **not source-code reuse**.

## 2. Experience principles

1. **Paper before feature taxonomy.** Current source + one primary next action appears before any navigation.
2. **One level of primary navigation.** Overview / Ask / Card. Explanation starters belong inside Ask; Settings is a utility action in the header.
3. **Progressive disclosure.** API details and privacy guidance appear inside Settings; long privacy text in a collapsible details section.
4. **Reading density, not dashboard density.** Digest sections are typographic blocks separated by hairlines, not individually boxed marketing cards.
5. **Source integrity.** Verified PDF pages use textual links; unverified citations remain visibly unverified. Never use color alone to imply proof.
6. **Honest state.** Empty view must tell the user the next actionable step: choose PDF, configure API key, or analyze a recognized PDF.
7. **No decorative noise.** No emoji feature grids, gradients, fake loading animations, version badges or external brand slogans in content area.

## 3. Layout and hierarchy

\`\`\`text
┌───────────────────────────────┐
│ PaperPeek           [settings]│  60px app header
├───────────────────────────────┤
│ Current paper (if recognized) │  Compact source context + Analyze / Change
├───────────────────────────────┤
│ Overview   Ask   Card         │  43px navigation, only 3 destinations
├───────────────────────────────┤
│ Primary reading/task content  │  20px horizontal padding
│                               │
│ (chat composer at bottom in   │
│  Ask when content is short)   │
└───────────────────────────────┘
\`\`\`

Settings replaces content and hides the document strip + tabs; explicit **Back to reading** returns to last task. It is not a fourth tab.

### Empty state model

| Context | Headline | Primary action |
|---|---|---|
| No PDF | 从一篇论文开始 | 选择 PDF |
| PDF present, API key missing | 先连接你的模型 | 配置 API Key |
| PDF ready, key present | 论文已就绪 | The Analyze button in paper header |
| Digest ready | Overview sections | PDF navigation / ask / export |

No duplicate primary button in an already-actionable state.

## 4. Color tokens

Tokens live in \`src/styles.css\`; never add new raw component colors without updating this document. The light system is primary; \`prefers-color-scheme: dark\` is supported using the same semantic roles.

| Token | Light | Role |
|---|---|---|
| \`--canvas\` | \`#ffffff\` | Reading background |
| \`--surface\` | \`#ffffff\` | Inputs and secondary controls |
| \`--subtle\` | \`#f6f7f8\` | Quiet user messages and markdown editor |
| \`--text\` | \`#1b252d\` | Body ink |
| \`--muted\` | \`#65717b\` | Subheadings, explanations |
| \`--faint\` | \`#859099\` | Passive metadata / hints |
| \`--border\` | \`#e5e8eb\` | Hairline dividers |
| \`--border-strong\` | \`#cdd4d9\` | Interactive control boundary |
| \`--primary\` | \`#1c685b\` | One accent for actions and source navigation |
| \`--soft-accent\` | \`#ecf5f1\` | Non-error status |
| \`--error\` | \`#ad3535\` | Error text |
| \`--focus\` | \`#237c70\` | 2px keyboard focus outline |

Use text + icon/label for status; do not rely on green/red color alone.

## 5. Spacing, type and radii

- Spacing: **4 / 8 / 12 / 16 / 20 / 24px**. Default content gutter **20px**; reduce to 16px below 340px.
- Controls: minimum **34px** height; text inputs ~37px; send action ~29px visually but surrounded by a larger composer (review touch targeting if mobile support is added).
- Main UI font 13px, line-height 1.6. Overview lead 15px / 1.8. Page title 14px. Utility headings 11–12px. PaperPeek wordmark 16px.
- Radii: **6px** for controls, **9px** for composer/messages. No large decorative 16–24px cards.
- Elevation: **none**. Hairline borders separate information. Avoid shadows and glass effects.
- Long titles clamp at 2 lines; source metadata is ellipsized. Digest/assistant text wraps naturally.
- No remote fonts. System fallback includes Chinese fonts.

## 6. Components and behavior

| Component | Rules |
|---|---|
| Primary button | One in a contextual area; compact solid accent |
| Secondary / ghost | For safe alternate actions only; no full-width promotional CTAs |
| Tabs | Three tasks; 2px underline, \`role=tab\`, arrow-left/right keyboard navigation |
| Source summary | Plain text sections with border-bottom, label plus content |
| Evidence link | Textual \`PDF p.N ↗\`, shown as verified only when quote matches page |
| Prompt suggestion | One-line full-width list row, not a card grid |
| Chat | User text in quiet neutral surface, assistant response as reading prose |
| Markdown card | Read-only source textarea, Copy / Save next to heading |
| Settings | Clearly labeled inputs, opt-in key persistence, privacy details |
| Feedback | Small inline live region; errors contain actionable explanations |
| Focus | Visible 2px outline with offset; labels and accessible button names |

## 7. Interaction and accessibility QA

Test with Side Panel widths **300px / 360px / 450px**, tall and short viewports, keyboard-only tabbing, \`prefers-color-scheme: dark\`, \`prefers-reduced-motion\`, and long Chinese/English paper titles.

Must verify: focus order, tab arrows, settings return path, empty-state actions, no clipped controls or horizontal scroll, and copy/download availability. Text from model and PDF must still be rendered as plain text, not HTML.

## 8. Maintenance contract

Any UI PR must describe: task affected, prior pain point, removed/added elements, updated states, keyboard impacts, screenshots at 300px/360px, and any new tokens. Keep \`docs/ui-design.md\`, this document, and \`tests/ui.test.ts\` synchronized.
