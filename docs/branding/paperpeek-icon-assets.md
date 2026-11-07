# PaperPeek Chrome extension icons — integrated in v0.1.5

**Status:** adopted · **Source:** [Issue #11](https://github.com/Housz/PaperPeek/issues/11) · **Original artwork:** [asset commit 6f1d766](https://github.com/Housz/PaperPeek/commit/6f1d76681cb0d5265bbf198598f0071251a300b8)

The four **original, unchanged PNG assets** have been merged from `asset/paperpeek-icons-2026-11-07`. They show the sideways-looking paper character selected by the repository owner, with folded corner, eye, cheek, arm, three accent rays and three content lines, no text or external white border.

| Location | Dimensions | Chrome use |
|---|---:|---|
| `public/icons/icon16.png` | 16×16 | Toolbar |
| `public/icons/icon32.png` | 32×32 | HiDPI toolbar |
| `public/icons/icon48.png` | 48×48 | Extension management |
| `public/icons/icon128.png` | 128×128 | Extension installation/store |

Chrome Manifest V3 configuration:

```json
{
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_title": "Open PaperPeek",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    }
  }
}
```

Keep the existing `action.default_title`, other permissions, Side Panel path and service worker when editing the actual Manifest. Vite copies `public/icons/` into the root of `dist/icons/`. GitHub CI and Release ZIP packaging assert all four PNGs exist and tests validate PNG signatures, pixel dimensions and transparency metadata.

**Maintenance:** If a new design is approved, create a new asset issue with source art and export sizes, and update `tests/icons.test.ts`, this document, Manifest and release notes in the same PR. Do not silently generate substitute logos or replace the source artwork.
