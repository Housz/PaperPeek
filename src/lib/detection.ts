import { allowedPdfSource, cleanPdfCandidates } from "./urls";

export interface DetectionResult {
  tabId?: number;
  tabUrl?: string;
  sourceUrl: string | null;
  candidates: string[];
  reason: "direct" | "embedded" | "multiple" | "none" | "file-permission";
}

/**
 * Extracts PDF links in ordinary HTML, not Chrome's protected native PDF viewer.
 * Called using chrome.scripting.executeScript after opening the extension.
 * The injected code has no secrets and makes no network requests.
 */
export function collectDocumentCandidates(): string[] {
  const candidates: string[] = [];
  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      const value = new URL(raw, document.baseURI);
      if (value.protocol !== "https:") return;
      value.hash = "";
      candidates.push(value.href);
    } catch { /* Unusable URL. */ }
  };
  const test = (url: string, label: string, type: string) => {
    const path = (() => { try { return new URL(url, document.baseURI).pathname; } catch { return ""; } })();
    if (/application\/pdf/i.test(type)
      || /\.pdf$/i.test(path)
      || /^(?:(?:download|full[\s-]*text)\s*)?pdf(?:\s*(?:full[\s-]*text|download))?$/i.test(label)
      || /\/(?:pdf|download-pdf)(?:\/|$)/i.test(path)
      || /\b(?:format|download|type)=pdf\b/i.test(url)) add(url);
  };

  if (document.contentType?.toLowerCase() === "application/pdf") add(location.href);
  for (const item of document.querySelectorAll<HTMLIFrameElement | HTMLEmbedElement | HTMLObjectElement>(
    "iframe[src], embed[src], object[data]"
  )) {
    const value = item instanceof HTMLObjectElement ? item.data : item.src;
    test(value, "", item.getAttribute("type") || "");
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href], link[href]")) {
    const text = (link.textContent?.trim() || link.getAttribute("aria-label")?.trim() || "").slice(0, 100);
    test(link.href, text, link.getAttribute("type") || "");
  }
  return [...new Set(candidates)].slice(0, 24);
}

export function sanitizeDetectedCandidates(sources: string[]): string[] {
  return cleanPdfCandidates(sources).filter(allowedPdfSource);
}

export function isPdfResponseType(value: string | null): boolean {
  return !!value && /^application\/pdf(?:\s*;|$)/i.test(value.trim());
}

/**
 * No download occurs during automatic DOM inspection. The explicit Detect
 * action may probe a non-.pdf current URL using a HEAD request.
 */
export async function probePdfContentType(
  raw: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!allowedPdfSource(raw) || !raw.startsWith("https:")) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    let head: Response | null = null;
    try {
      head = await fetcher(raw, {
        method: "HEAD", credentials: "omit", redirect: "follow", signal: controller.signal
      });
    } catch { /* Some download endpoints do not support HEAD. */ }
    if (head?.ok && isPdfResponseType(head.headers.get("content-type"))) return true;
    if (head?.ok && /text\/html/i.test(head.headers.get("content-type") || "")) return false;
    if (head && !head.ok && ![405, 501].includes(head.status)) return false;
    // Fetch only a small header window if HEAD is unsupported or inconclusive.
    // If the server ignores Range, cancel the reader after the first chunk.
    const response = await fetcher(raw, {
      method: "GET",
      headers: { Range: "bytes=0-4095" },
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) return false;
    const reader = response.body?.getReader();
    if (!reader) return false;
    try {
      const { value } = await reader.read();
      if (!value) return false;
      const prefix = new TextDecoder("ascii").decode(value.subarray(0, 1024));
      return prefix.includes("%PDF-");
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  } catch {
    return false;
  } finally { clearTimeout(timer); }
}
