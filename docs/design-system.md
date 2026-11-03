# PaperPeek design system — compact Side Panel v0.1.3

**Status:** implemented as CSS tokens and DOM. **Owner:** maintainer. **Updated:** 2026-11-03.

## Design goal and user mental model

The PDF remains the main work surface; PaperPeek is a narrow reader companion. Before presenting any AI features it must answer: **which PDF**, **how to start**, and **where to ask**. Decoration must not consume paper-reading space.

Reference principles (no proprietary code reused): [GitHub Primer](https://primer.style/product/getting-started/foundations/layout/), [shadcn/ui](https://ui.shadcn.com/docs/theming), [Radix Typography](https://www.radix-ui.com/themes/docs/theme/typography), [Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).

## Information architecture

\`\`\`text
┌───────────────────────────────────────┐
│ PaperPeek / paper title   ↻  ↥  分析 ⚙ │  single header (min 65px)
├───────────────────────────────────────┤
│ 概览       提问        卡片             │  tabs (41px)
├───────────────────────────────────────┤
│ Paper overview, or actionable state   │
│ / Q&A + prompt quick actions          │
│ / Markdown export                     │
└───────────────────────────────────────┘
\`\`\`

The top row is **one header**, not separate application and paper toolbars. Compact brand and title share one identity block; a small group of explicit source actions is at the right. Long paper titles are ellipsized, with full value in the tooltip. The user can re-detect current tab, choose local file, analyze or open model settings without secondary bars.

When a page offers multiple PDF sources, the source picker appears in the **Overview content region**, not in a persistent header. Settings replaces the three-tab content and has a Back action.

## Typography and spacing

| Element | Size | Rule |
|---|---|---|
| Primary reading text (digest/Q&A) | 14px, 1.75–1.8 line-height | Prioritize long academic Chinese paragraphs |
| Digest lead | 15.5px, 1.8 | Give a quick paper gist without oversized hero |
| Section label | 12px, semibold | Quiet heading, below body hierarchy |
| Paper title in header | 13.5px, semibold | Single-line truncation to preserve controls |
| Header brand | 11px | De-emphasized identity, not a billboard |
| Tab | 13px | Three user tasks |
| Input / action | 12.5–13.5px | Compact but readable |
| Hints / metadata | 10.5–11.5px | Secondary information only |

Spacing scale: **4 / 8 / 12 / 16 / 20 / 24px**, default content gutter **16px** (12px at widths <=340px). Header min-height 65px; tabs 41px. Controls 30–36px high. Radii 6px and 9px only. No shadows, gradients, badges for decoration or remote fonts.

## Semantic colors

CSS token source is \`src/styles.css\` with OS light/dark variants. Keep semantic role instead of hardcoding new component colors.

| Token | Light | Purpose |
|---|---|---|
| \`--canvas\` | \`#fff\` | Reading background |
| \`--surface\` | \`#fff\` | Inputs |
| \`--subtle\` | \`#f6f7f8\` | Gentle separation |
| \`--text\` | \`#1b252d\` | Reading text |
| \`--muted\` | \`#596773\` | Labels |
| \`--faint\` | \`#6a7680\` | Rare secondary hints |
| \`--border\` | \`#e5e8eb\` | Hairline sections |
| \`--primary\` | \`#1c685b\` | Primary action / source link |
| \`--error\` | \`#a12f32\` | Warning with text explanation |
| \`--focus\` | \`#237c70\` | Visible keyboard focus |

Use a readable color contrast and explicit words; no status conveyed by color alone.

## Component behavior

- **Source detection:** icon button with title and accessible label, always available even if no PDF was detected. Never automatically upload document text to AI during detection.
- **Local file:** icon button opens browser file picker; if current \`file://\` needs permission, render contextual explanation and a link to Chrome extension details.
- **Main action:** single \`分析\` button only when a PDF source is selected; if API Key is missing, routes to Settings.
- **Source candidates:** selection input appears only with multiple candidates, never auto-pick several unrelated files.
- **Overview:** textual research structure with section dividers; verified PDF page link is underlined text.
- **Ask:** compact question presets from the versioned registry (not duplicated hard-coded prompts); assistant answer is reading text, user question in subtle surface.
- **Card:** copy and save actions disabled until digest exists.
- **Models:** service selector, official list / refresh, custom ID override, per-provider Key persistence and explicit clear.
- **Feedback:** small inline status, not large alerts or fake loading animation.
- **Keyboard:** semantic buttons/tabs, tab arrow navigation, strong focus outlines, reduced motion.

## Responsive/manual review

Required screenshot widths **300 / 360 / 450px**, including long paper filename, pending PDF/permission, multiple source picker, full model dropdown, long response and dark mode. Verify no horizontal scrolling, no clipped settings actions, disabled states clear, and keyboard focus order. Test actual unpacked Chrome extension after static Chromium checks; CI DOM unit tests alone cannot prove full interaction.

## Change contract

Update \`sidepanel.html\`, \`src/styles.css\`, \`src/main.ts\`, \`docs/ui-design.md\`, this file and \`tests/ui.test.ts\` when navigation or controls change. Do not add visual ornament without a documented user need.
