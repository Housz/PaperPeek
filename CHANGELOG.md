# Changelog

All notable changes are recorded here. Versions follow semantic versioning for MVP milestones.

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
