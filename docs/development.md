# Development standards

## Environment and build

Node.js >=22.12, npm, Chrome >=116. Use `npm install`, `npm run check`, `npm test`, `npm run build`. No remote script tags; MV3 extension must bundle executable code locally. Do not commit `dist` or node_modules.

## Module boundaries

Treat `src/lib` as pure/domain modules wherever possible. Browser API usage is restricted to trusted extension contexts: `src/main.ts`, `src/background.ts`, `src/lib/storage.ts`. Tests can mock provider `fetch` without any real key.

Do not add heavy framework/SDK by default. The UI is vanilla TypeScript + CSS for MVP; a framework switch requires an ADR. Depend on official provider REST request shapes and keep model IDs configurable.

## Code style

- TypeScript strict, no implicit any. Small deterministic helpers for parsing and export.
- User/source/model strings use textContent / textarea, not untrusted HTML.
- Add bounded input and output length; normalize PDF page numbering to 1-based.
- Handle errors for network, permissions, quota, invalid JSON, stale tabs and large files.
- Never log keys, authorization headers, complete PDF content or model request bodies.
- Preserve user action before uploading PDF text and clearly disclose third-party processing.

## Documentation maintenance

For each PR: update requirements for behavior, architecture/ADR for trade-offs, user guide for workflows, testing for new cases, security for new data flows, CHANGELOG for user-visible changes, AGENTS for changed invariant. Mention if any checklist step was not run.

## Release checklist (GitHub Releases are the authoritative download channel)

Follow [docs/releasing.md](releasing.md). A release must be built by GitHub Actions from a merged `main` commit and published with a direct ZIP asset and checksum. Do not share a chat sandbox ZIP as the primary installation file.


1. `npm run check` and `npm test` pass.
2. `npm run build` produces `dist/manifest.json`, `dist/sidepanel.html`, `dist/assets/background.js` and bundled PDF.js worker.
3. Inspect manifest permissions and that no real secrets appear in built output.
4. Run manual real arXiv PDF + BYOK smoke using *local* key; never put it into CI/public logs.
5. Check narrow/wide Side Panel, switch tabs mid-load, local PDF, model 401/429, verified/unverified pages.
6. CI artifact is unpacked extension; tag release only after manual acceptance.

## Versioning

Patch for bugs and docs; minor for new reading/export feature; release notes must distinguish shipped vs planned capabilities.

## New modules v0.1.3

- The detection logic lives in `src/lib/urls.ts` and `src/lib/detection.ts`; keep injected DOM function self-contained (Chrome serializes it into isolated world).
- Provider metadata discovery is in `src/lib/provider.ts`; only fixed official endpoints and sanitized errors.
- Key persistence is per provider in `src/lib/storage.ts`; never revert to one shared key.
- Scientific prompt templates are maintained in `src/lib/prompts.ts` and `docs/prompts.md`, with version bump and regression tests.

## Release automation (v0.1.4)

`release.yml` runs after merge to `main` or via manual workflow dispatch. It reads the package and Manifest version, checks the matching release notes, repeats type/test/build, packages a root-manifest Chrome ZIP, generates SHA256SUMS and publishes a GitHub **pre-release**. An already published version is skipped; bump the version for future updates. Run `tests/release.test.ts` after changing release CI. CI uses GitHub's repository token only, not API keys from model vendors.

## v0.1.5 untrusted Markdown and icon contract

- Only `src/lib/markdown-view.ts` may convert assistant-supplied Markdown to markup. Keep `html: false`, HTTP(S)-only links, external images disabled and size caps. Never render arbitrary source HTML or use remote scripts/CDNs. Update `tests/markdown-view.test.ts` for changes.
- The Card preview is not the artifact. Export/clipboard must continue to use `cardText.value` from the deterministic `toMarkdown()` function, unchanged by rendering.
- Browser icons must originate from the approved Issue #11 PNG files in `public/icons/`. Do not regenerate them. Update `tests/icons.test.ts`, `docs/branding/paperpeek-icon-assets.md` and Manifest when changing branding.
- ZIP Release checks require all four PNG icons and the root Manifest. Follow `docs/releasing.md` before publishing.
