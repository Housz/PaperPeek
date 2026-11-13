import MarkdownIt from "markdown-it";

/**
 * AI output, PDF excerpts and Markdown card titles are untrusted data.
 * markdown-it 15.0.3 is bundled locally (never loaded from a CDN).
 *
 * Security: raw HTML is escaped, executable / local links are rejected,
 * external images are disabled to avoid implicit tracking requests.
 */
const renderer = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
  typographer: false
});
// Keep image parsing so its nested link cannot become a clickable tracking URL.
// Render only escaped alternative text; never create an image or network request.
renderer.renderer.rules.image = (tokens, index) =>
  renderer.utils.escapeHtml(tokens[index].content);
renderer.validateLink = (href: string) => /^https?:\/\//i.test(href);
renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const link = tokens[index];
  link.attrSet("target", "_blank");
  link.attrSet("rel", "noopener noreferrer");
  link.attrSet("referrerpolicy", "no-referrer");
  return self.renderToken(tokens, index, options);
};

export const MAX_MARKDOWN_LENGTH = 120_000;

export function markdownToSafeHtml(source: string): string {
  const bounded = source.slice(0, MAX_MARKDOWN_LENGTH);
  return renderer.render(bounded);
}

/** Insert parser-produced markup, never model/PDF-authored HTML. */
export function renderMarkdownInto(element: HTMLElement, source: string): void {
  const html = markdownToSafeHtml(source);
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const nodes = [...documentFragment.body.childNodes].map(node =>
    document.importNode(node, true)
  );
  element.replaceChildren(...nodes);
}

/**
 * Turn model-suggested [PDF p.N] text into page *hints*. They are not
 * evidence-verified, unlike the overview's exact-quote page matches.
 * Never alter inline code or external URLs.
 */
export function attachPdfPageHints(
  element: HTMLElement,
  maxPage: number,
  navigate: (page: number) => void
): void {
  if (!Number.isSafeInteger(maxPage) || maxPage < 1) return;
  const walker = document.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */);
  const matches: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    if (!/\[PDF p\.\d+\]/.test(text.data)) continue;
    if (text.parentElement?.closest("a, code, pre, button")) continue;
    matches.push(text);
  }
  for (const text of matches) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const re = /\[PDF p\.(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text.data))) {
      fragment.append(document.createTextNode(text.data.slice(cursor, match.index)));
      const page = Number(match[1]);
      if (Number.isSafeInteger(page) && page >= 1 && page <= maxPage) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "page-link";
        button.textContent = "[PDF p." + page + "] ↗";
        button.title = "模型建议的页码；未经原文引用校验";
        button.setAttribute("aria-label", "跳转至 PDF 第 " + page + " 页（未验证）");
        button.addEventListener("click", () => navigate(page));
        fragment.append(button);
      } else {
        fragment.append(document.createTextNode(match[0]));
      }
      cursor = re.lastIndex;
    }
    fragment.append(document.createTextNode(text.data.slice(cursor)));
    text.replaceWith(fragment);
  }
}
