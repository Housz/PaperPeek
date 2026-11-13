import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceKey } from "../src/lib/tab-workspace";
import { selectionKey, positionKey, anchorKey } from "../src/lib/reader-bridge";
import { attachReader, detachSessionTab, ensureReadingSession, getReadingSession, sessionForTab, validateSelection, type ReadingSelection } from "../src/lib/reading-loop";
let entries: Record<string, unknown>;
beforeEach(() => {
  entries = {};
  vi.stubGlobal("chrome", { storage: { session: {
    get: async (key: string | null) => key === null ? { ...entries } : { [key]: entries[key] },
    set: async (values: Record<string, unknown>) => { Object.assign(entries, structuredClone(values)); },
    remove: async (key: string) => { delete entries[key]; }
  } } });
});
describe("reading sessions", () => {
  it("shares source/Reader but not independent tabs with identical documents", async () => {
    const a = await ensureReadingSession(1, "doc", "https://host/a.pdf", "https://host/article");
    const b = await ensureReadingSession(2, "doc", "https://host/a.pdf", "https://host/article");
    expect(a.sessionId).not.toBe(b.sessionId);
    await attachReader(a.sessionId, 3);
    expect((await sessionForTab(3))?.workspaceTabId).toBe(a.workspaceTabId);
    expect((await sessionForTab(1))?.sessionId).toBe(a.sessionId);
  });
  it("deduplicates racing creates for one source document", async () => {
    const result = await Promise.all([ensureReadingSession(1, "doc", null, ""), ensureReadingSession(1, "doc", null, "")]);
    expect(result[0].sessionId).toBe(result[1].sessionId);
  });
  it("retains workspace until last associated tab closes", async () => {
    const s = await ensureReadingSession(1, "doc", null, "");
    await attachReader(s.sessionId, 2);
    expect((await detachSessionTab(1)).deleteWorkspaceTabId).toBeUndefined();
    expect((await getReadingSession(s.sessionId))?.readerTabId).toBe(2);
    expect((await detachSessionTab(2)).deleteWorkspaceTabId).toBe(s.workspaceTabId);
    expect(await getReadingSession(s.sessionId)).toBeNull();
  });
  it("closing Reader first keeps source and allows a fresh Reader", async () => {
    const s = await ensureReadingSession(1, "doc", null, "");
    await attachReader(s.sessionId, 2); await detachSessionTab(2);
    expect((await sessionForTab(1))?.readerTabId).toBeUndefined();
    await attachReader(s.sessionId, 3);
    expect((await sessionForTab(3))?.sourceTabId).toBe(1);
  });
  it("changes content identity despite same URL", async () => {
    const before = await ensureReadingSession(1, "old", "https://x/p.pdf", "https://x/p.pdf");
    for (const key of [workspaceKey(before.workspaceTabId), selectionKey(before.sessionId), positionKey(before.sessionId), anchorKey(before.sessionId)]) entries[key] = { old: true };
    const after = await ensureReadingSession(1, "new", "https://x/p.pdf", "https://x/p.pdf");
    expect(before.sessionId).not.toBe(after.sessionId);
    expect(await getReadingSession(before.sessionId)).toBeNull();
    for (const key of [workspaceKey(before.workspaceTabId), selectionKey(before.sessionId), positionKey(before.sessionId), anchorKey(before.sessionId)]) expect(entries[key]).toBeUndefined();
  });
  it("rejects wrong identity, oversized and invalid-page selections", async () => {
    const s = await ensureReadingSession(1, "doc", null, "");
    const selection: ReadingSelection = { sessionId: s.sessionId, documentId: "doc", text: "some scientific text", pageStart: 1, pageEnd: 2, at: Date.now(), anchor: { sessionId: s.sessionId, documentId: "doc", pageNumber: 1, verification: "quote-verified" } };
    expect(validateSelection(selection, s, 3)).toBeNull();
    expect(validateSelection({ ...selection, documentId: "other" }, s, 3)).toBeTruthy();
    expect(validateSelection({ ...selection, text: "x".repeat(6001) }, s, 3)).toBeTruthy();
    expect(validateSelection({ ...selection, pageEnd: 4 }, s, 3)).toBeTruthy();
  });
  it("replacing a same-tab document removes the previous identity", async () => {
    const a = await ensureReadingSession(1, "old", "https://x/p.pdf", "https://x/p.pdf");
    await attachReader(a.sessionId, 1, "current-tab");
    const b = await ensureReadingSession(1, "new", "https://x/p.pdf", "https://x/p.pdf");
    expect(await getReadingSession(a.sessionId)).toBeNull();
    expect((await sessionForTab(1))?.sessionId).toBe(b.sessionId);
  });

});
