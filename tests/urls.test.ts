import { describe, expect, it } from "vitest";
import { candidatePdfUrl, isArxivUrl, permissionOrigin, sourcePageUrl } from "../src/lib/urls";

describe("PDF URL recognition", () => {
  it("accepts arXiv PDF and abstract URLs", () => {
    expect(candidatePdfUrl("https://arxiv.org/pdf/2601.01234#page=4"))
      .toBe("https://arxiv.org/pdf/2601.01234");
    expect(candidatePdfUrl("https://arxiv.org/abs/2601.01234"))
      .toBe("https://arxiv.org/pdf/2601.01234");
    expect(isArxivUrl("https://export.arxiv.org/pdf/2601.01234")).toBe(true);
  });
  it("rejects non-PDF or unsafe schemes", () => {
    expect(candidatePdfUrl("javascript:alert(1)")).toBe(null);
    expect(candidatePdfUrl("file:///tmp/paper.pdf")).toBe(null);
    expect(candidatePdfUrl("https://example.com/index.html")).toBe(null);
    expect(candidatePdfUrl("https://example.com/a.pdf?download=1")).toBe("https://example.com/a.pdf?download=1");
  });
  it("generates permission origin and page fragment", () => {
    expect(permissionOrigin("https://example.com/a.pdf")).toBe("https://example.com/*");
    expect(sourcePageUrl("https://arxiv.org/pdf/2601.01234#old", 5))
      .toBe("https://arxiv.org/pdf/2601.01234#page=5");
  });
});
