# Changelog

All notable changes are recorded here. Versions follow semantic versioning for MVP milestones.

## [0.1.3] - 2026-11-03

### Added
- PDF redetection, publisher HTML PDF link/embed discovery, multiple candidate picker and manual URL fallback.
- Direct local `file://` PDF handling with Chrome file scheme permission guidance.
- On-demand HEAD MIME and bounded Range GET signature probing for extensionless public PDF URLs.
- Official OpenAI and DeepSeek model list fetching, refresh and custom ID fallback; per-provider BYOK settings and explicit local key persistence.
- Versioned scientific reading prompt library with Chinese (English) term conventions, methods, experiments, formulas, terminology and evidence presets.
- Source/model/storage/prompt/UI regression tests and detailed support/evaluation documentation.

### Changed
- Merged app and paper header into one compact row; increased reading typography and reduced UI redundancy.
- DeepSeek default fallback uses `deepseek-flash`; existing user model choices are preserved.
- Gemini adapter remains unchanged in this cycle.

### Known limits
- Signed, POST-only, cookie-protected, cross-origin embedded and `blob:` PDF sources may still require manual download/upload.
- Official model catalog membership does not guarantee Chat Completions compatibility.
- Automatic real publisher website compatibility and live model-provider calls still need user-controlled browser smoke validation.

## [0.1.2] - 2026-11-02

### Changed
- Rebuilt Side Panel as a minimal light-first reader interface with adaptive dark mode and shared semantic design tokens.
- Reduced primary navigation from five destinations to **Overview / Ask / Card**; moved explanation starter questions inside Ask.
- Moved model settings to a header utility action with a clear Back path.
- Replaced gradient cards and promotional chrome with typographic paper sections, compact controls and contextual empty states.
- Improved keyboard tab navigation, clear icon names and focus visibility.
- Added design-system and UI contract documentation and automated structure tests.

### Unchanged
- Single PDF scope, BYOK provider adapters, PDF parser, claims verification and Markdown export. Real desktop Chrome provider smoke remains required.

## [0.1.1] - 2026-11-02

### Added
- Chrome MV3 Side Panel for single research PDF reading.
- arXiv PDF/abstract URL discovery, optional HTTPS PDF permission and manual PDF fallback.
- Text extraction by PDF.js with page labels, file size/context limits and error states.
- BYOK Gemini, OpenAI and DeepSeek REST model adapters with editable model ID and connection test.
- Structured paper digest, evidence quote verification, normal Q&A and guided explanation prompts.
- Portable Markdown Paper Card with copy and download.
- Selection context menu (subject to PDF viewer compatibility), session storage, CI and project documentation.

### Known limits
- No PDF.js interactive viewer, precision selection/highlight, multimodal image crop, OCR or multi-paper features.
- Model-suggested page hints inside free-form chat are not source-verified.
- Browser-only keys are not a hardened secret store. Live model/PDF browser tests must be run by an authorized key holder.
