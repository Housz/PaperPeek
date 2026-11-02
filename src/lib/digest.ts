import type { Claim, Digest, PaperPage } from "../types";

export function normalizedQuote(input: string): string {
  return input.normalize("NFKC").replace(/-\s*\n\s*/g, "").replace(/\s+/g, "").toLowerCase();
}
function arrayStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && !!v.trim())
    .slice(0, max).map(v => v.trim().slice(0, 700));
}
export function parseDigest(raw: string, pages: PaperPage[]): Digest {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model did not return a JSON paper digest.");
  let result: Record<string, unknown>;
  try { result = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>; }
  catch { throw new Error("Could not parse the paper digest JSON. Retry generation."); }
  if (typeof result.tldr !== "string" || typeof result.problem !== "string" ||
      !Array.isArray(result.approach) || !Array.isArray(result.findings))
    throw new Error("Incomplete paper digest returned. Retry generation.");
  const findings: Claim[] = result.findings.slice(0, 5).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    if (typeof value.text !== "string" || !value.text.trim()) return [];
    const pageNumber = typeof value.page === "number" && Number.isInteger(value.page) ? value.page : undefined;
    const quote = typeof value.quote === "string" ? value.quote.trim() : undefined;
    const page = pages.find(p => p.page === pageNumber);
    const verified = !!page && !!quote && normalizedQuote(quote).length >= 12 &&
      normalizedQuote(page.text).includes(normalizedQuote(quote));
    return [{ text: value.text.trim().slice(0, 800), page: verified ? pageNumber : undefined,
      quote: verified ? quote : undefined, verified }];
  });
  return {
    tldr: result.tldr.trim().slice(0, 1300),
    problem: result.problem.trim().slice(0, 1500),
    approach: arrayStrings(result.approach, 5),
    findings,
    limitations: arrayStrings(result.limitations, 4),
    keywords: arrayStrings(result.keywords, 8)
  };
}
