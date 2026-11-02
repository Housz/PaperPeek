export type Provider = "gemini" | "openai" | "deepseek";

export interface PaperPage { page: number; text: string }
export interface Paper {
  id: string;
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
  gemini: "gemini-2.5-flash",
  openai: "gpt-4.1-mini",
  deepseek: "deepseek-chat"
};
