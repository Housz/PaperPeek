import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = (name: string) => readFileSync(resolve(process.cwd(), name), "utf8");
const workflow = file(".github/workflows/release.yml");
const manifest = JSON.parse(file("public/manifest.json")) as { version: string };
const pkg = JSON.parse(file("package.json")) as { version: string };

describe("GitHub Release publishing contract", () => {
  it("keeps the published version at v0.1.4 in both manifests", () => {
    expect(pkg.version).toBe("0.1.4");
    expect(manifest.version).toBe(pkg.version);
  });

  it("builds only on main or manual dispatch with explicitly scoped release permission", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("concurrency:");
    expect(workflow).not.toContain("pull_request:");
  });

  it("checks, tests and builds with GitHub before publishing a release", () => {
    expect(workflow).toContain("npm run check");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain('test -s dist/manifest.json');
    expect(workflow).toContain("unzip -Z1");
    expect(workflow).toContain("sha256sum");
    expect(workflow).toContain("gh release create");
  });

  it("prevents accidental overwrite and includes installable ZIP and checksum", () => {
    expect(workflow).toContain('gh release view "$TAG"');
    expect(workflow).toContain("publish=false");
    expect(workflow).not.toContain("gh release upload");
    expect(workflow).toContain('ZIP_NAME="PaperPeek-\${TAG}-chrome.zip"');
    expect(workflow).toContain("SHA256SUMS.txt");
    expect(workflow).toContain("docs/releases/");
    expect(file("docs/releases/v0.1.4.md")).toContain("PaperPeek-v0.1.4-chrome.zip");
  });
});
