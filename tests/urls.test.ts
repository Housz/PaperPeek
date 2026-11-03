import { describe, expect, it } from "vitest";
import {
  allowedPdfSource, candidatePdfUrl, permissionOrigin, sourcePageUrl,
  isArxivUrl, looksLikePdfLink, cleanPdfCandidates
} from "../src/lib/urls";

describe("PDF URL handling across sources", () => {
  it("accepts arXiv direct PDFs and abstract pages", () => {
    expect(candidatePdfUrl("https://arxiv.org/pdf/2601.01234#page=4"))
      .toBe("https://arxiv.org/pdf/2601.01234");
    expect(candidatePdfUrl("https://arxiv.org/abs/2601.01234"))
      .toBe("https://arxiv.org/pdf/2601.01234");
    expect(isArxivUrl("https://export.arxiv.org/pdf/2601.01234")).toBe(true);
  });
  it("recognizes local file PDFs but not arbitrary local files", () => {
    expect(candidatePdfUrl("file:///Users/test/My%20Paper.pdf#page=3"))
      .toBe("file:///Users/test/My%20Paper.pdf");
    expect(candidatePdfUrl("file:///tmp/secrets.txt")).toBeNull();
    expect(permissionOrigin("file:///tmp/paper.pdf")).toBe("file:///*");
  });
  it("uses safe schemes and allows dynamic addresses only after explicit identification", () => {
    expect(allowedPdfSource("javascript:alert(1)")).toBe(false);
    expect(allowedPdfSource("blob:https://example.org/1")).toBe(false);
    expect(allowedPdfSource("http://example.org/paper.pdf")).toBe(false);
    expect(candidatePdfUrl("https://publisher.org/download?id=123")).toBeNull();
    expect(looksLikePdfLink("https://publisher.org/download?id=123", "PDF")).toBe(true);
    expect(looksLikePdfLink("https://publisher.org/other", "Introduction")).toBe(false);
    expect(looksLikePdfLink("https://example.org/item?format=pdf")).toBe(true);
  });
  it("normalizes, deduplicates and limits PDF candidates", () => {
    expect(cleanPdfCandidates([
      "https://example.org/a.pdf#page=1",
      "https://example.org/a.pdf#page=3",
      "javascript:bad()"
    ])).toEqual(["https://example.org/a.pdf"]);
  });
  it("generates host permission and navigation target", () => {
    expect(permissionOrigin("https://example.org/download?id=123")).toBe("https://example.org/*");
    expect(sourcePageUrl("file:///tmp/test.pdf", 5)).toBe("file:///tmp/test.pdf#page=5");
  });
});
