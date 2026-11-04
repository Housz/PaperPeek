import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Digest, Paper } from "../src/types";
import {
  blankWorkspace, documentIdentity, loadTabWorkspace, packWorkspace, TabWorkspaceManager,
  removeTabWorkspace, saveTabWorkspace, unpackWorkspace, workspaceKey,
  workspaceMatchesTab
} from "../src/lib/tab-workspace";

type Store = Record<string, unknown>;
let session: Store;
beforeEach(() => {
  session = {};
  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: async (key: string) => key in session ? { [key]: session[key] } : {},
        set: async (entries: Store) => Object.assign(session, entries),
        remove: async (key: string) => { delete session[key]; }
      }
    }
  });
});
const samplePaper: Paper = {
  id: "p1", title: "Paper One", authors: "A. Author",
  sourceUrl: "https://arxiv.org/pdf/2601.12345",
  totalPages: 2, truncated: false,
  pages: [
    { page: 1, text: "Scientific paper method and title" },
    { page: 2, text: "Experiment results" }
  ]
};
const sampleDigest: Digest = {
  tldr: "研究概览", problem: "研究问题", approach: ["方法 A"],
  findings: [{ text: "结果", verified: false }],
  limitations: ["限制"], keywords: ["算法"]
};

describe("per-tab reading workspace", () => {
  it("restores a complete paper, digest, Q&A, draft and reading view after panel reopens", async () => {
    const one = blankWorkspace(42, "https://arxiv.org/pdf/2601.12345#page=4");
    one.paper = samplePaper; one.digest = sampleDigest; one.view = "ask";
    one.conversation = [
      { role: "user", text: "论文的主要方法是什么？" },
      { role: "assistant", text: "核心方法 A" }
    ];
    one.draft = "继续提问……";
    await saveTabWorkspace(one);
    const restored = await loadTabWorkspace(42, "https://arxiv.org/pdf/2601.12345#page=9");
    expect(restored).toMatchObject({
      tabId: 42, view: "ask", draft: "继续提问……",
      paper: { id: "p1" }, digest: { tldr: "研究概览" }
    });
    expect(restored?.conversation).toHaveLength(2);
    expect(restored?.paper?.pages[1].text).toBe("Experiment results");
  });

  it("isolates two tabs showing identical PDF URLs", async () => {
    const a = blankWorkspace(10, "https://arxiv.org/pdf/2601.12345");
    const b = blankWorkspace(11, "https://arxiv.org/pdf/2601.12345");
    a.paper = samplePaper; a.digest = sampleDigest;
    b.draft = "未分析的另一标签页";
    await Promise.all([saveTabWorkspace(a), saveTabWorkspace(b)]);
    expect((await loadTabWorkspace(10, a.tabUrl))?.digest?.tldr).toBe("研究概览");
    expect((await loadTabWorkspace(11, b.tabUrl))?.digest).toBeNull();
    expect((await loadTabWorkspace(11, b.tabUrl))?.draft).toBe("未分析的另一标签页");
  });

  it("preserves same-tab PDF navigation, rejects unrelated navigation", async () => {
    const first = blankWorkspace(13, "https://arxiv.org/abs/2601.12345");
    first.paper = samplePaper; first.selectedPdfUrl = samplePaper.sourceUrl;
    await saveTabWorkspace(first);
    expect(workspaceMatchesTab(first, "https://arxiv.org/pdf/2601.12345#page=7")).toBe(true);
    expect((await loadTabWorkspace(13, "https://arxiv.org/pdf/2601.12345#page=7"))?.paper?.id).toBe("p1");
    expect(await loadTabWorkspace(13, "https://example.org/unrelated")).toBeNull();
    expect(session[workspaceKey(13)]).toBeUndefined();
  });

  it("supports a manually uploaded PDF on an unchanged HTML tab", async () => {
    const work = blankWorkspace(21, "https://publisher.org/article/123");
    work.selectedPdfUrl = null;
    work.paper = { ...samplePaper, sourceUrl: null, title: "Local handpicked paper" };
    work.digest = sampleDigest;
    await saveTabWorkspace(work);
    expect((await loadTabWorkspace(21, "https://publisher.org/article/123#section-2"))?.paper?.title)
      .toBe("Local handpicked paper");
    expect(await loadTabWorkspace(21, "https://publisher.org/article/456")).toBeNull();
  });

  it("removes only the closed tab's saved work", async () => {
    const a = blankWorkspace(22, "https://example.org/a.pdf");
    const b = blankWorkspace(23, "https://example.org/b.pdf");
    await Promise.all([saveTabWorkspace(a), saveTabWorkspace(b)]);
    await removeTabWorkspace(22);
    expect(session[workspaceKey(22)]).toBeUndefined();
    expect(session[workspaceKey(23)]).toBeDefined();
  });

  it("compresses large paper text and restores without external uploads", async () => {
    const work = blankWorkspace(38, "https://example.org/a.pdf");
    work.paper = { ...samplePaper, pages: [{ page: 1, text: "repeated scientific paper ".repeat(7000) }] };
    const packed = await packWorkspace(work);
    if (typeof CompressionStream !== "undefined") {
      expect(packed.format).toBe("gzip-base64");
      expect(packed.data.length).toBeLessThan(JSON.stringify(work).length / 3);
    }
    const decoded = await unpackWorkspace(packed);
    expect(decoded?.paper?.pages[0].text).toBe(work.paper.pages[0].text);
  });

  it("supports scoped storage keys and normalizes navigation fragments", () => {
    expect(workspaceKey(4)).toBe("paperpeek.tabWorkspace.v1.4");
    expect(() => workspaceKey(-1)).toThrow();
    expect(documentIdentity("file:///tmp/paper.pdf#page=5")).toBe("file:///tmp/paper.pdf");
  });

  it("serializes concurrent writes for a single tab in the correct order", async () => {
    const first = blankWorkspace(77, "https://example.org/a.pdf");
    first.draft = "old";
    const second = { ...first, draft: "latest" };
    await Promise.all([saveTabWorkspace(first), saveTabWorkspace(second)]);
    expect((await loadTabWorkspace(77, first.tabUrl))?.draft).toBe("latest");
  });
});

describe("realistic tab reading workflows", () => {
  it("switches A→B→A without losing A analysis or unfinished input", async () => {
    const manager = new TabWorkspaceManager();
    const a = await manager.open(101, "https://arxiv.org/pdf/2601.12345");
    a.paper = samplePaper;
    a.digest = sampleDigest;
    a.conversation.push({ role: "user", text: "What is the baseline?" });
    a.draft = "Explain table 2";
    a.view = "ask";
    await manager.save(a);
    const b = await manager.open(102, "https://example.org/another.pdf");
    expect(b.paper).toBeNull();
    b.paper = { ...samplePaper, id: "p2", title: "Second paper", sourceUrl: "https://example.org/another.pdf" };
    await manager.save(b);
    const back = await manager.open(101, "https://arxiv.org/pdf/2601.12345#page=3");
    expect(back).toMatchObject({
      view: "ask", draft: "Explain table 2",
      paper: { id: "p1" }, digest: { tldr: "研究概览" }
    });
    expect(back.conversation[0].text).toContain("baseline");
    expect((await manager.open(102, b.tabUrl)).paper?.id).toBe("p2");
  });

  it("keeps A's delayed answer on A while B is active", async () => {
    const manager = new TabWorkspaceManager();
    const a = await manager.open(201, "https://arxiv.org/pdf/2601.12345");
    a.paper = samplePaper;
    a.conversation = [{ role: "user", text: "What was evaluated?" }];
    await manager.save(a);
    const b = await manager.open(202, "https://example.org/paper-b.pdf");
    b.paper = { ...samplePaper, id: "p2", sourceUrl: "https://example.org/paper-b.pdf" };
    await manager.save(b);
    const updated = await manager.updatePaper(201, "p1", work => {
      work.conversation.push({ role: "assistant", text: "Three experiments were evaluated." });
      work.digest = sampleDigest;
    });
    expect(updated).toBe(true);
    expect((await manager.open(201, a.tabUrl)).conversation).toHaveLength(2);
    expect((await manager.open(202, b.tabUrl)).conversation).toHaveLength(0);
    expect((await manager.open(202, b.tabUrl)).digest).toBeNull();
  });

  it("rejects delayed writes after the source changed in the same tab", async () => {
    const manager = new TabWorkspaceManager();
    const a = await manager.open(303, "https://example.org/a.pdf");
    a.paper = { ...samplePaper, id: "old", sourceUrl: "https://example.org/a.pdf" };
    await manager.save(a);
    const navigated = await manager.open(303, "https://example.org/b.pdf");
    expect(navigated.paper).toBeNull();
    const result = await manager.updatePaper(303, "old", ws => { ws.digest = sampleDigest; });
    expect(result).toBe(false);
    expect((await manager.open(303, "https://example.org/b.pdf")).digest).toBeNull();
  });

  it("tab closure clears the workspace and not the other paper", async () => {
    const manager = new TabWorkspaceManager();
    const one = await manager.open(401, "https://example.org/one.pdf");
    const two = await manager.open(402, "https://example.org/two.pdf");
    one.paper = samplePaper; two.paper = { ...samplePaper, id: "two" };
    await Promise.all([manager.save(one), manager.save(two)]);
    await manager.close(401);
    expect(await loadTabWorkspace(401, one.tabUrl)).toBeNull();
    expect((await loadTabWorkspace(402, two.tabUrl))?.paper?.id).toBe("two");
  });
});
