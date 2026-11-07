# PaperPeek Chrome icon assets (draft)

This is an asset-only branch; the main branch is unchanged.

Design: a sly, sideways-peeking paper character (one eye, folded corner, three teal attention rays, and three paper content lines), no lettering or outer white border. Transparent rounded exterior with mint/teal interior.

Files: `public/icons/icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png`; each is an optimized indexed-color PNG with preserved transparency.

Suggested Chrome Manifest V3 configuration:

```json
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
```

Apply these keys to the existing manifest object (do not overwrite other keys). These files can be reviewed via the tracking GitHub Issue before any merge or adoption.
