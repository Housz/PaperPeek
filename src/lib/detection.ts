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
      || /^(?:download\s*)?pdf(?:\s*full[\s-]*text)?$/i.test(label)
      || /\/(?:pdf|download-pdf)(?:\/|$)/i.test(path)
      || /\b(?:format|download|type)=pdf\b/i.test(url)) add(url);
  };

  if (document.contentType?.toLowerCase() === "application/pdf") add(location.href);
  for (const item of document.querySelectorAll<HTMLIFrameElement | HTMLEmbedElement | HTMLObjectElement>(
    "iframe[src], embed[src], object[data]"
  )) {
    const value = item instanceof HTMLObjectElement ? item.data : item.src;
    test(value, "", item.type || "");
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href], link[href]")) {
    const text = (link.textContent || link.getAttribute("aria-label") || "").trim().slice(0, 100);
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
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(raw, {
      method: "HEAD",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal
    });
    return response.ok && isPdfResponseType(response.headers.get("content-type"));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
