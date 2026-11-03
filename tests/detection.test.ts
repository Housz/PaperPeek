import { describe, expect, it, vi } from "vitest";
import {
  isPdfResponseType, probePdfContentType, sanitizeDetectedCandidates
} from "../src/lib/detection";

describe("on-demand PDF detection", () => {
  it("recognizes application/pdf and optional parameters", () => {
    expect(isPdfResponseType("application/pdf")).toBe(true);
    expect(isPdfResponseType("application/pdf; charset=binary")).toBe(true);
    expect(isPdfResponseType("text/html")).toBe(false);
  });
  it("uses HEAD content type for dynamic publisher URLs", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 200, headers: { "Content-Type": "application/pdf" }
    })) as unknown as typeof fetch;
    expect(await probePdfContentType("https://publisher.org/article/download?id=1", fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect((fetcher as any).mock.calls[0][1].method).toBe("HEAD");
  });
  it("rejects HTML and blocks unsafe schemes", async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 200, headers: { "Content-Type": "text/html" }
    })) as unknown as typeof fetch;
    expect(await probePdfContentType("https://publisher.org/article", fetcher)).toBe(false);
    expect(await probePdfContentType("file:///tmp/paper.pdf", fetcher)).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("falls back to bounded GET signature when HEAD is not supported", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response("%PDF-1.7\nHello", { status: 200 })) as unknown as typeof fetch;
    expect(await probePdfContentType("https://publisher.org/download?id=2", fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher as any).mock.calls[1][1].headers.Range).toBe("bytes=0-4095");
  });
  it("de-duplicates candidates", () => {
    expect(sanitizeDetectedCandidates([
      "https://publisher.org/a.pdf#page=4", "https://publisher.org/a.pdf#page=2",
      "blob:https://publisher.org/abc", "javascript:alert(1)"
    ])).toEqual(["https://publisher.org/a.pdf"]);
  });
});
