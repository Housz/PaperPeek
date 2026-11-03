import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Paper, PaperPage } from "../types";

GlobalWorkerOptions.workerSrc = workerUrl;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_CHARS = 125_000;

export function normalizeExtractedText(parts: { str?: string; hasEOL?: boolean }[]): string {
  return parts.map((part) => (part.str || "") + (part.hasEOL ? "\n" : " ")).join("")
    .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").trim();
}

export async function fetchPdf(url: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "omit", redirect: "follow" });
  } catch {
    throw new Error("无法重新获取 PDF：站点可能限制登录、跨域或临时下载链接。请在浏览器下载后，使用“选择本地 PDF”。");
  }
  if (!response.ok) throw new Error("PDF 获取失败（HTTP " + response.status + "）。可以尝试手动选择已下载的文件。");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_PDF_BYTES) throw new Error("PDF exceeds 25 MB limit.");
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.arrayBuffer();
    if (data.byteLength > MAX_PDF_BYTES) throw new Error("PDF exceeds 25 MB limit.");
    return data;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) throw new Error("PDF exceeds 25 MB limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export async function parsePdf(bytes: ArrayBuffer, sourceUrl: string | null): Promise<Paper> {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("PDF exceeds 25 MB limit.");
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("此地址返回的不是 PDF 文件。请尝试重新检测或手动打开 PDF。");
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loading.promise;
  try {
    let title = "";
    let authors: string | undefined;
    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info as { Title?: unknown; Author?: unknown };
      if (typeof info.Title === "string") title = info.Title.trim();
      if (typeof info.Author === "string") authors = info.Author.trim() || undefined;
    } catch { /* Metadata is optional. */ }
    const pages: PaperPage[] = [];
    let size = 0;
    let truncated = false;
    for (let number = 1; number <= pdf.numPages; number++) {
      if (size >= MAX_TEXT_CHARS) { truncated = true; break; }
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const parts = content.items.filter(
        (item): item is typeof item & { str: string } => "str" in item
      ).map(item => ({ str: item.str, hasEOL: "hasEOL" in item ? item.hasEOL : false }));
      const text = normalizeExtractedText(parts);
      const left = MAX_TEXT_CHARS - size;
      pages.push({ page: number, text: text.slice(0, left) });
      size += Math.min(left, text.length);
      if (text.length > left) truncated = true;
      page.cleanup();
    }
    const fallbackTitle = sourceUrl?.split("/").pop()?.split("?")[0] || "Untitled paper";
    const paper: Paper = {
      id: crypto.randomUUID(),
      title: title || fallbackTitle,
      authors,
      sourceUrl,
      pages,
      totalPages: pdf.numPages,
      truncated
    };
    if (!pages.some(page => page.text.length > 50))
      throw new Error("No selectable text found. 扫描版 PDF 暂不支持（需要 OCR）。");
    return paper;
  } finally {
    await loading.destroy();
  }
}
