const ARXIV_HOSTS = new Set(["arxiv.org", "export.arxiv.org"]);

export function allowedPdfSource(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "file:";
  } catch { return false; }
}

export function candidatePdfUrl(raw?: string): string | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (!allowedPdfSource(url.href)) return null;
  url.hash = "";
  if (url.protocol === "file:") return /\.pdf$/i.test(url.pathname) ? url.href : null;
  if (ARXIV_HOSTS.has(url.hostname)) {
    if (/^\/abs\/[^?#]+\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/^\/abs\//, "/pdf/").replace(/\/$/, "");
      return url.href;
    }
    if (/^\/pdf\/[^?#]+\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/$/, "");
      return url.href;
    }
  }
  if (/\.pdf$/i.test(url.pathname)) return url.href;
  return null;
}

export function isArxivUrl(raw: string): boolean {
  try { return ARXIV_HOSTS.has(new URL(raw).hostname); } catch { return false; }
}

export function permissionOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol === "file:") return "file:///*";
  if (url.protocol !== "https:") throw new Error("Only HTTPS and explicitly permitted local PDF URLs are supported.");
  return url.origin + "/*";
}

export function sourcePageUrl(raw: string, page: number): string {
  const url = new URL(raw);
  url.hash = "page=" + Math.max(1, Math.floor(page));
  return url.href;
}

/** Heuristics for PDF anchors on publisher/article pages. Never auto-pick when several exist. */
export function looksLikePdfLink(raw: string, label = "", mediaType = ""): boolean {
  if (!allowedPdfSource(raw)) return false;
  if (candidatePdfUrl(raw)) return true;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:") return false;
  return /application\/pdf/i.test(mediaType)
    || /^(?:download\s*)?pdf(?:\s*(?:full[\s-]*text|全文|下载))?$/i.test(label.trim())
    || /\b(?:format|type|download|output)=pdf\b/i.test(url.search.slice(1))
    || /\/(?:pdf|download-pdf)(?:\/|$)/i.test(url.pathname);
}

/** Remove hashes and duplicates, ignore unsupported/unsafe schemes and limit on-page lists. */
export function cleanPdfCandidates(raw: string[]): string[] {
  return [...new Set(raw.filter(allowedPdfSource).map(url => {
    try { const parsed = new URL(url); parsed.hash = ""; return parsed.href; }
    catch { return ""; }
  }).filter(Boolean))].slice(0, 24);
}
