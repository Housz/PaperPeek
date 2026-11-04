# GitHub Release and extension packaging

**Status:** automated release workflow · **Version policy:** \`package.json\` + \`public/manifest.json\` must match.

## What users download

Use the **GitHub Releases page** for stable download links:

https://github.com/Housz/PaperPeek/releases

Each release includes an unpacked developer-extension ZIP named:

\`PaperPeek-vX.Y.Z-chrome.zip\`

The ZIP has \`manifest.json\` at the **root**, not inside another \`dist/\` directory. Extract it to a fixed folder, open \`chrome://extensions\`, enable Developer mode, Load unpacked, and select that folder. A second \`SHA256SUMS.txt\` asset is published with the checksum.

Never direct users to expired GitHub Actions artifacts or temporary chat attachment URLs as the primary download channel.

## How releases are built

\`.github/workflows/release.yml\` runs on merges/pushes to \`main\` and can be manually dispatched:

1. Read \`package.json\` version and compare it to \`public/manifest.json\`.
2. Require \`docs/releases/vX.Y.Z.md\` with user-facing release notes.
3. Verify that \`vX.Y.Z\` is **not already published**. Existing releases are never silently overwritten.
4. Fresh GitHub Actions runner installs dependencies, runs \`npm run check\`, \`npm test\`, and \`npm run build\`.
5. Package the contents of \`dist/\` into a root-manifest ZIP, verify required files, generate SHA-256.
6. Using GitHub Actions' built-in repository token with \`contents: write\`, create Git tag and **pre-release** with the ZIP and checksum assets.
7. Check the live GitHub Release page and download link before telling users the release is available.

The workflow uses no third-party release-publishing dependency and no model API keys. \`GITHUB_TOKEN\` is used only by GitHub Actions to publish the release.

## Release checklist for maintainers and AI agents

- Develop and test on a branch, create a PR, and verify the normal CI job.
- Bump the **same** version in \`package.json\` and \`public/manifest.json\`; update the CI artifact name automatically.
- Add \`docs/releases/vX.Y.Z.md\` and the corresponding CHANGELOG entry. Keep real limitations accurately documented.
- Merge to \`main\` to trigger the release workflow. Do not try to publish from an unmerged PR.
- Open Actions → **Publish Chrome extension Release** and confirm success.
- Open https://github.com/Housz/PaperPeek/releases/tag/vX.Y.Z and confirm ZIP/checksum exist and are downloadable.
- If the workflow fails, repair the workflow and re-run it. Do not claim publication until GitHub confirms both release assets.
- If a published version needs another code change, **bump the version** rather than force-replacing an immutable release; a same-version main push is intentionally skipped.

## Privacy and quality

Do not put API Keys, proprietary research PDFs, logs containing model headers, or user data into any release assets, notes or CI variables. CI uses mocked providers only and cannot certify a real Chrome Side Panel / provider session. Verify these workflows before any Chrome Web Store publication.

## Installation upgrade nuance

Chrome identifies unpacked extensions by their stable extension identity. Updating in place (same folder + Reload) is preferable to removing and reloading from a new directory, which can result in a different ID and loss of local settings. Export important Markdown before a reload because PaperPeek's **paper workspace** is deliberately temporary (\`storage.session\`).
