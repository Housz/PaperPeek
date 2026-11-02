const ARXIV_HOSTS = new Set(["arxiv.org", "export.arxiv.org"]);

export function candidatePdfUrl(raw?: string): string | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (ARXIV_HOSTS.has(url.hostname)) {
    if (/^\/abs\/[^/]+\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/^\/abs\//, "/pdf/").replace(/\/$/, "");
      url.hash = "";
      return url.href;
    }
    if (/^\/pdf\/[^/]+\/?$/.test(url.pathname)) {
      url.hash = "";
      return url.href;
    }
  }
  if (/\.pdf$/i.test(url.pathname)) {
    url.hash = "";
    return url.href;
  }
  return null;
}

export function isArxivUrl(raw: string): boolean {
  try { return ARXIV_HOSTS.has(new URL(raw).hostname); } catch { return false; }
}

export function permissionOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS PDF URLs are supported.");
  return url.origin + "/*";
}

export function sourcePageUrl(url: string, page: number): string {
  const parsed = new URL(url);
  parsed.hash = "page=" + Math.max(1, Math.floor(page));
  return parsed.toString();
}
