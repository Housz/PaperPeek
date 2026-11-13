/** Coordinates are fractions of the unrotated PDF page, with a top-left origin. */
export type NormalizedRect = [number, number, number, number];
export interface PdfAnchor {
  sessionId: string;
  documentId: string;
  pageNumber: number;
  exactQuote?: string;
  prefix?: string;
  suffix?: string;
  verification: "quote-verified" | "page-only" | "model-hint";
}
export interface TextSegment { start: number; end: number; rect: NormalizedRect }
export interface AnchorPage {
  sessionId: string;
  documentId: string;
  totalPages: number;
  pageNumber: number;
  text: string;
  segments: TextSegment[];
}
export interface AnchorResolution {
  level: "A" | "B" | "C";
  pageNumber?: number;
  rects: NormalizedRect[];
  textOffsets?: [number, number];
  reason: string;
}

/** Same content has the same identity, including when served from a redirected URL. */
export async function fingerprintPdf(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

// Keep an index map: normalization must never turn guessed semantic similarity into geometry.
function normalize(text: string): { text: string; starts: number[]; ends: number[] } {
  let result = "";
  const starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < text.length;) {
    const hyphen = text.slice(i).match(/^[-\u00ad][ \t]*\r?\n[ \t]*/);
    if (hyphen) { i += hyphen[0].length; continue; }
    const codepoint = String.fromCodePoint(text.codePointAt(i)!);
    const end = i + codepoint.length;
    const value = codepoint === "\u00ad" ? "" : codepoint.normalize("NFKC");
    for (const c of value) {
      if (/\s/u.test(c)) {
        if (result.endsWith(" ")) { ends[ends.length - 1] = end; continue; }
        result += " "; starts.push(i); ends.push(end);
      } else { result += c; starts.push(i); ends.push(end); }
    }
    i = end;
  }
  return { text: result, starts, ends };
}
function occurrences(haystack: string, needle: string): number[] {
  const found: number[] = [];
  if (!needle) return found;
  let index = haystack.indexOf(needle);
  while (index >= 0) { found.push(index); index = haystack.indexOf(needle, index + 1); }
  return found;
}
function validRect(rect: NormalizedRect): boolean {
  return rect.length === 4 && rect.every(Number.isFinite) && rect[0] >= 0 && rect[1] >= 0 &&
    rect[2] > 0 && rect[3] > 0 && rect[0] + rect[2] <= 1.001 && rect[1] + rect[3] <= 1.001;
}
export function resolveAnchor(anchor: PdfAnchor, page: AnchorPage): AnchorResolution {
  const fail = (reason: string): AnchorResolution => ({ level: "C", rects: [], reason });
  if (anchor.sessionId !== page.sessionId || anchor.documentId !== page.documentId)
    return fail("文档或阅读会话不匹配；未执行跳转。");
  if (!Number.isSafeInteger(anchor.pageNumber) || anchor.pageNumber < 1 || anchor.pageNumber > page.totalPages)
    return fail("PDF 物理页码无效。");
  const fallback = (reason: string): AnchorResolution => ({ level: "B", pageNumber: anchor.pageNumber, rects: [], reason });
  if (page.pageNumber !== anchor.pageNumber) return fallback("已定位页面，尚未验证该页的具体段落。");
  if (anchor.verification !== "quote-verified" || !anchor.exactQuote?.trim())
    return fallback(anchor.verification === "model-hint" ? "模型提供的页码线索；未验证具体段落。" : "已定位 PDF 页面；未能定位具体段落。");
  const normalized = normalize(page.text);
  const quote = normalize(anchor.exactQuote).text.trim();
  // First literal matching, then equivalent Unicode/whitespace/hyphenation only.
  let ranges = occurrences(page.text, anchor.exactQuote).map(start => [start, start + anchor.exactQuote!.length] as [number, number]);
  if (!ranges.length) ranges = occurrences(normalized.text, quote).map(start => [normalized.starts[start], normalized.ends[start + quote.length - 1]]);
  if (ranges.length > 1 && (anchor.prefix || anchor.suffix)) {
    const prefix = normalize(anchor.prefix || "").text.trim();
    const suffix = normalize(anchor.suffix || "").text.trim();
    ranges = ranges.filter(([start, end]) =>
      (!prefix || normalize(page.text.slice(0, start)).text.trimEnd().endsWith(prefix)) &&
      (!suffix || normalize(page.text.slice(end)).text.trimStart().startsWith(suffix)));
  }
  if (ranges.length !== 1) return fallback(ranges.length ? "引文在该页重复，无法可靠确定段落。" : "该页未找到可验证引文；仅定位页面。");
  const [start, end] = ranges[0];
  const segments = page.segments.filter(s => s.start < end && s.end > start);
  if (!segments.length || segments.some(s => !validRect(s.rect))) return fallback("已找到文字，但缺少可信坐标；仅定位页面。");
  // Every non-whitespace character must be covered by supplied text geometry.
  for (let i = start; i < end; i++) {
    if (!/\s/u.test(page.text[i]) && !segments.some(s => s.start <= i && s.end > i))
      return fallback("文字几何映射不完整；仅定位页面。");
  }
  return { level: "A", pageNumber: anchor.pageNumber, rects: segments.map(s => s.rect), textOffsets: [start, end], reason: "已定位原文引文。" };
}
