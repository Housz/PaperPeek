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
  const response = await fetch(url, { credentials: "omit", redirect: "follow" });
  if (!response.ok) throw new Error("PDF request failed (HTTP " + response.status + ").");
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
  if (!header.includes("%PDF-")) throw new Error("This file does not appear to be a PDF.");
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
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
      throw new Error("No selectable text found. Scanned PDFs require OCR (not in v0.1.1).");
    return paper;
  } finally {
    await loading.destroy();
  }
}
