import { describe, expect, it } from "vitest";
import { fingerprintPdf, resolveAnchor, type AnchorPage, type PdfAnchor } from "../src/lib/anchors";
const anchor: PdfAnchor = { sessionId: "s", documentId: "d", pageNumber: 2, exactQuote: "exact evidence", verification: "quote-verified" };
function page(text = "An exact evidence quote."): AnchorPage {
  return { sessionId: "s", documentId: "d", totalPages: 3, pageNumber: 2, text,
    segments: [...text].map((_, i) => ({ start: i, end: i + 1, rect: [i / 100, .2, .01, .03] })) };
}
describe("trustworthy anchors", () => {
  it("maps literal verified text with complete normalized geometry", () => {
    const result = resolveAnchor(anchor, page());
    expect(result.level).toBe("A"); expect(result.textOffsets).toEqual([3, 17]); expect(result.rects).toHaveLength(14);
  });
  it("uses content fingerprints, not source URLs", async () => {
    expect(await fingerprintPdf(new TextEncoder().encode("PDF A").buffer)).toBe(await fingerprintPdf(new TextEncoder().encode("PDF A").buffer));
    expect(await fingerprintPdf(new TextEncoder().encode("PDF A").buffer)).not.toBe(await fingerprintPdf(new TextEncoder().encode("PDF B").buffer));
  });
  it("never trusts model hints for highlights", () => {
    expect(resolveAnchor({ ...anchor, verification: "model-hint" }, page()).level).toBe("B");
    expect(resolveAnchor({ ...anchor, verification: "page-only" }, page()).rects).toEqual([]);
  });
  it("rejects cross-document and cross-session anchors", () => {
    expect(resolveAnchor(anchor, { ...page(), documentId: "other" }).level).toBe("C");
    expect(resolveAnchor(anchor, { ...page(), sessionId: "other" }).level).toBe("C");
  });
  it("rejects invalid physical pages", () => {
    for (const pageNumber of [0, -1, 4, 1.2, NaN]) expect(resolveAnchor({ ...anchor, pageNumber }, page()).level).toBe("C");
  });
  it("degrades ambiguous quotes, unless surrounding text disambiguates", () => {
    const repeated = page("A exact evidence X. B exact evidence Y.");
    expect(resolveAnchor(anchor, repeated).level).toBe("B");
    expect(resolveAnchor({ ...anchor, prefix: "B", suffix: "Y." }, repeated).level).toBe("A");
    expect(resolveAnchor({ ...anchor, prefix: "C" }, repeated).level).toBe("B");
  });
  it("maps whitespace, line-end hyphenation and ligature normalization", () => {
    expect(resolveAnchor({ ...anchor, exactQuote: "efficient computation" }, page("efﬁcient com-\nputation")).level).toBe("A");
    expect(resolveAnchor({ ...anchor, exactQuote: "exact evidence" }, page("exact\n  evidence")).level).toBe("A");
  });
  it("does not invent semantic matches or missing geometry", () => {
    expect(resolveAnchor(anchor, page("approximate support")).level).toBe("B");
    expect(resolveAnchor(anchor, { ...page(), segments: [] }).level).toBe("B");
    const incomplete = page(); incomplete.segments.splice(9, 1);
    expect(resolveAnchor(anchor, incomplete).level).toBe("B");
    const invalid = page(); invalid.segments[8].rect = [0, 0, Infinity, 1];
    expect(resolveAnchor(anchor, invalid).level).toBe("B");
  });
});
