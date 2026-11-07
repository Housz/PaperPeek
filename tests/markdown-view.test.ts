// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  attachPdfPageHints, markdownToSafeHtml, renderMarkdownInto
} from "../src/lib/markdown-view";

describe("safe scientific Markdown presentation (issue #7)", () => {
  it("renders headings, emphasis, lists, tables and fenced code", () => {
    const container = document.createElement("div");
    renderMarkdownInto(container,
      "## 研究结论\n\n**重要结果**\n\n- 论文问题\n- 核心方法\n\n" +
      "| 方法 | 结果 |\n|---|---|\n| Baseline | 72% |\n\n" +
      "~~~python\nprint('hello')\n~~~");
    expect(container.querySelector("h2")?.textContent).toBe("研究结论");
    expect(container.querySelector("strong")?.textContent).toBe("重要结果");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("table th")?.textContent).toBe("方法");
    expect(container.querySelector("pre code")?.textContent).toContain("print");
    expect(container.textContent).not.toContain("## 研究结论");
    expect(container.textContent).not.toContain("**重要结果**");
  });

  it("blocks HTML injection, unsafe URLs and automatic remote images", () => {
    const container = document.createElement("div");
    renderMarkdownInto(container,
      '<script>alert("xss")</script>\n\n' +
      '<img src=x onerror="alert(1)">\n\n' +
      '[evil](javascript:alert(1)) [local](file:///etc/passwd) ' +
      '[data](data:text/html;base64,AAA)\n\n' +
      '![tracking pixel](https://tracker.example/pixel.png)\n\n' +
      '[safe](https://example.com/paper.pdf)');
    expect(container.querySelector("script, img, iframe, svg, object")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    const safe = container.querySelector<HTMLAnchorElement>("a");
    expect(safe?.getAttribute("href")).toBe("https://example.com/paper.pdf");
    expect(safe?.getAttribute("rel")).toContain("noopener");
    expect(safe?.getAttribute("target")).toBe("_blank");
    expect(container.textContent).toContain('<script>alert("xss")</script>');
  });

  it("limits untrusted Markdown input", () => {
    expect(markdownToSafeHtml("a".repeat(120_100)).length).toBeLessThan(120_100);
  });

  it("makes bounded PDF page hints clickable without losing Markdown formatting", () => {
    const target = document.createElement("div");
    renderMarkdownInto(target, "## 结果\n\n**显著改善** [PDF p.3]，参考 [PDF p.88]。");
    const nav = vi.fn();
    attachPdfPageHints(target, 5, nav);
    const button = target.querySelector<HTMLButtonElement>("button.page-link");
    expect(button?.textContent).toContain("PDF p.3");
    expect(button?.getAttribute("title")).toContain("未经原文");
    button?.click();
    expect(nav).toHaveBeenCalledWith(3);
    expect(target.textContent).toContain("[PDF p.88]");
    expect(target.querySelector("strong")?.textContent).toBe("显著改善");
  });

  it("does not change citations in code or external links", () => {
    const target = document.createElement("div");
    const tick = String.fromCharCode(96);
    renderMarkdownInto(target, tick + "[PDF p.2]" + tick + " [PDF p.3] [Read](https://example.com)");
    attachPdfPageHints(target, 4, vi.fn());
    expect(target.querySelector("code")?.textContent).toBe("[PDF p.2]");
    expect(target.querySelectorAll("button.page-link")).toHaveLength(1);
    expect(target.querySelector("a")?.textContent).toBe("Read");
  });
});
