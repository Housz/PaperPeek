export type Provider = "gemini" | "openai" | "deepseek";

export interface PaperPage { page: number; text: string }
export interface Paper {
  id: string;
  documentId?: string; // SHA-256 of original PDF bytes, never a source URL
  title: string;
  authors?: string;
  sourceUrl: string | null;
  pages: PaperPage[];
  totalPages: number;
  truncated: boolean;
}
export interface Claim {
  text: string;
  page?: number;
  quote?: string;
  verified: boolean;
}
export interface Digest {
  tldr: string;
  problem: string;
  approach: string[];
  findings: Claim[];
  limitations: string[];
  keywords: string[];
}
export interface ChatMessage { role: "user" | "assistant"; text: string }
export interface Settings {
  provider: Provider;
  model: string;
  rememberKey: boolean;
}
export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash", // Gemini refinement is separate from this release.
  openai: "gpt-4.1-mini", // Fallback only: live model catalog takes precedence.
  deepseek: "deepseek-flash"
};
export const PROVIDERS: Provider[] = ["deepseek", "openai", "gemini"];
