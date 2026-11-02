# UI & interaction design — v0.1.1

**Navigation:** Side Panel header (current PDF + Analyze/Upload), then `Overview | Explain | Ask | Card | ⚙`.

- **Overview:** structure-first digest. Research problem and technical mechanism before details; evidence button on each confirmed finding. No arbitrary quality/novelty rating.
- **Explain:** four short starters (intuition, method flow, experiments, formulas), which place a tailored prompt into Ask. Method explanation is text-based in this version.
- **Ask:** plain-text conversation with a bounded recent history. Model's `[PDF p.N]` references are *not independently verified*; tooltip says so.
- **Card:** read-only Markdown source plus Copy and Download. Single stable structure, not a chat transcript or knowledge-base sync.
- **Settings:** provider, model ID, key, explicit opt-in persistent save, connection test and privacy reminder.

## Primary flow

1. User navigates to public arXiv PDF.
2. User opens Side Panel; current URL recognized (or chooses local file).
3. User configures BYOK key in Settings; may test using one short request.
4. User clicks Analyze; sees fetch, parsing and model states; receives Overview.
5. User asks follow-up questions, navigates to validated source page or exports Card.

## States to keep distinct

| State | UI |
|---|---|
| No relevant tab | Prompt for PDF/Upload |
| Relevant tab, not loaded | Ready status + Analyze |
| Parsing | Processing status and disabled conflicting actions |
| Model request | Processing status; keep previous content |
| Done | Digest & Markdown ready |
| Unsupported PDF | Error and manual import option |
| Key missing / invalid | Safe error directing to Settings |
| Context truncated | Persistent PDF metadata warning |
| Verified source | Green page-link with click |
| Unverified source | Plain-text warning, no falsely clickable verified citation |

## Follow-on interaction research

Deep mode PDF.js viewer with text selection rectangles, overlay highlights, chart/figure cropping and return-to-reading-position. Keep the same Paper/Anchor abstraction when introduced. Do not silently replace native PDF viewer.
