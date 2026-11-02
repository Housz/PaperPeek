# Contributing to PaperPeek

PaperPeek aims to be small, explainable and safe for researchers. New contributors should start with [AGENTS.md](AGENTS.md) and [requirements](docs/requirements.md).

## Change process

1. Open an issue explaining the research reading problem and desired behavior.
2. Check scope and risks; separate experimental ideas from v0.1.1 capabilities.
3. Work on a dedicated branch. Keep commits focused.
4. Add or update tests for parsing, provider requests, markdown, source handling and evidence.
5. Update affected documents, user guide and CHANGELOG whenever behavior changes.
6. Run `npm install && npm run check && npm test && npm run build`, then complete the manual matrix in `docs/testing.md`.
7. Submit a PR with screenshots (if UI changes), test details, limitations and privacy/permission implications.

## Security

Never publish API keys or proprietary PDF content in commits, fixtures, logs or issue discussions. All PDFs and model output are untrusted. Do not add analytics, tracking or network destinations without explicit product review. Do not log prompt or response bodies for convenience.

## Technical style

TypeScript strict, clear module boundaries, predictable errors, no unrelated dependencies. New provider adapters should include mock-based request/response tests. Expose unverified page references honestly. Make the default UI usable at narrow side-panel width.

## License

The repository owner has not yet selected a license. External contributors should confirm licensing policy before submitting substantial contributions.
