import type { ChatMessage, Digest, Paper } from "../types";
import { candidatePdfUrl } from "./urls";

/**
 * Per-tab *ephemeral* working state. Never store API keys, request headers,
 * raw PDF binary or external model response metadata in this record.
 * The PDF text is kept so questions can continue without re-parsing.
 */
export type ReadingView = "overview" | "ask" | "card";

export interface TabWorkspace {
  version: 1;
  tabId: number;
  tabUrl: string; // the browser tab URL with its fragment stripped
  selectedPdfUrl: string | null;
  candidates: string[];
  scanPerformed: boolean;
  paper: Paper | null;
  digest: Digest | null;
  conversation: ChatMessage[];
  draft: string;
  selections?: import("./reading-loop").ReadingSelection[];
  selection?: import("./reading-loop").ReadingSelection;
  view: ReadingView;
}

const KEY_PREFIX = "paperpeek.tabWorkspace.v1.";
const queue = new Map<number, Promise<void>>();

export function workspaceKey(tabId: number): string {
  if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Invalid tab ID.");
  return KEY_PREFIX + tabId;
}

export function documentIdentity(raw: string): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.href;
  } catch {
    return raw;
  }
}

export function blankWorkspace(tabId: number, tabUrl: string): TabWorkspace {
  return {
    version: 1,
    tabId,
    tabUrl: documentIdentity(tabUrl),
    selectedPdfUrl: candidatePdfUrl(tabUrl),
    candidates: [],
    scanPerformed: false,
    paper: null,
    digest: null,
    conversation: [],
    draft: "",
    view: "overview"
  };
}

/** Explicitly allow native page #fragments and arXiv abs -> PDF navigation. */
export function workspaceMatchesTab(state: TabWorkspace, tabUrl: string): boolean {
  const current = documentIdentity(tabUrl);
  if (state.tabUrl === current) return true;
  // A verified PDF page-link may move an arXiv abstract to its PDF URL.
  return !!state.selectedPdfUrl && candidatePdfUrl(current) === state.selectedPdfUrl;
}

interface PackedWorkspace {
  version: 1;
  format: "gzip-base64" | "json";
  data: string;
}
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function packWorkspace(state: TabWorkspace): Promise<PackedWorkspace> {
  const json = JSON.stringify(state);
  // PDF page text compresses well. Avoid exhausting storage.session's 10 MiB
  // extension-wide budget when several papers are open at once.
  if (typeof CompressionStream === "undefined") {
    return { version: 1, format: "json", data: json };
  }
  const compressed = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))
  ).arrayBuffer();
  return { version: 1, format: "gzip-base64", data: toBase64(new Uint8Array(compressed)) };
}

export async function unpackWorkspace(value: unknown): Promise<TabWorkspace | null> {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PackedWorkspace>;
  if (record.version !== 1 || typeof record.data !== "string") return null;
  let json: string;
  if (record.format === "json") {
    json = record.data;
  } else if (record.format === "gzip-base64") {
    if (typeof DecompressionStream === "undefined") return null;
    const bytes = fromBase64(record.data);
    // Copy into a concrete ArrayBuffer; BlobPart rejects ArrayBufferLike
    // (which may include SharedArrayBuffer) under strict TypeScript.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    json = await new Response(
      new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).text();
  } else return null;
  try {
    const parsed = JSON.parse(json) as Partial<TabWorkspace>;
    if (
      parsed.version !== 1 || !Number.isSafeInteger(parsed.tabId) ||
      typeof parsed.tabUrl !== "string" ||
      !Array.isArray(parsed.conversation) || !Array.isArray(parsed.candidates)
    ) return null;
    return {
      ...blankWorkspace(parsed.tabId!, parsed.tabUrl),
      ...parsed,
      tabId: parsed.tabId!,
      view: parsed.view === "ask" || parsed.view === "card" ? parsed.view : "overview",
      draft: typeof parsed.draft === "string" ? parsed.draft.slice(0, 3000) : ""
    };
  } catch { return null; }
}

/**
 * Serialize writes *per tab*. A delayed save of an old draft must never
 * overwrite a newer analysis/answer. Other tabs can write concurrently.
 */
export function saveTabWorkspace(state: TabWorkspace): Promise<void> {
  const tabId = state.tabId;
  const frozen = structuredClone(state);
  const prior = queue.get(tabId) || Promise.resolve();
  const operation = prior.catch(() => undefined).then(async () => {
    const data = await packWorkspace(frozen);
    await chrome.storage.session.set({ [workspaceKey(tabId)]: data });
  });
  queue.set(tabId, operation);
  void operation.finally(() => {
    if (queue.get(tabId) === operation) queue.delete(tabId);
  }).catch(() => undefined);
  return operation;
}

export async function loadTabWorkspace(tabId: number, currentUrl: string): Promise<TabWorkspace | null> {
  await queue.get(tabId)?.catch(() => undefined);
  const key = workspaceKey(tabId);
  const result = await chrome.storage.session.get(key);
  const workspace = await unpackWorkspace(result[key]);
  if (!workspace || workspace.tabId !== tabId) return null;
  if (workspaceMatchesTab(workspace, currentUrl)) {
    workspace.tabUrl = documentIdentity(currentUrl);
    return workspace;
  }
  await removeTabWorkspace(tabId);
  return null;
}

export async function removeTabWorkspace(tabId: number): Promise<void> {
  // Wait for any pending write before deleting. Background onRemoved also
  // removes the key in case Side Panel is already closed.
  await queue.get(tabId)?.catch(() => undefined);
  await chrome.storage.session.remove(workspaceKey(tabId));
}


/** Per-Side-Panel memory map. The backing store outlives panel closure. */
export class TabWorkspaceManager {
  private readonly cache = new Map<number, TabWorkspace>();

  async open(tabId: number, url: string): Promise<TabWorkspace> {
    const stored = this.cache.get(tabId) || await loadTabWorkspace(tabId, url);
    let workspace: TabWorkspace;
    if (stored && workspaceMatchesTab(stored, url)) {
      workspace = stored;
      workspace.tabUrl = documentIdentity(url);
    } else {
      if (stored) await removeTabWorkspace(tabId);
      workspace = blankWorkspace(tabId, url);
    }
    this.cache.set(tabId, workspace);
    return workspace;
  }

  get(tabId: number): TabWorkspace | undefined {
    return this.cache.get(tabId);
  }

  /**
   * Returns the save promise so tests and callers can await a durable checkpoint.
   * Cached workspace is available immediately for tab switching.
   */
  save(workspace: TabWorkspace): Promise<void> {
    this.cache.set(workspace.tabId, workspace);
    return saveTabWorkspace(workspace);
  }

  /** Apply results to the originating paper even if another tab is now active. */
  updatePaper(
    tabId: number,
    paperId: string,
    update: (workspace: TabWorkspace) => void
  ): Promise<boolean> {
    const workspace = this.cache.get(tabId);
    if (!workspace || workspace.paper?.id !== paperId) return Promise.resolve(false);
    update(workspace);
    return this.save(workspace).then(() => true);
  }

  async close(tabId: number): Promise<void> {
    this.cache.delete(tabId);
    await removeTabWorkspace(tabId);
  }
}
