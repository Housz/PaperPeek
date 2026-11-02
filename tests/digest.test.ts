import { describe, expect, it } from "vitest";
import { normalizedQuote, parseDigest } from "../src/lib/digest";

const pages = [{ page: 1, text: "We evaluate this approach with three public datasets." }, { page: 2, text: "Results improve by 10 percent over baseline." }];
const raw = JSON.stringify({
  tldr: "提出一种方法", problem: "如何改进基线",
  approach: ["数据处理", "模型训练"],
  findings: [
    { text: "进行了数据集实验", page: 1, quote: "evaluate this approach with three public datasets" },
    { text: "伪造引文", page: 2, quote: "completely unrelated quotation" }
  ],
  limitations: ["仅三个数据集"], keywords: ["model", "dataset"]
});

describe("digest parsing and evidence", () => {
  it("verifies exact quote only on matching PDF page", () => {
    const digest = parseDigest(raw, pages);
    expect(digest.findings[0]).toMatchObject({ page: 1, verified: true });
    expect(digest.findings[1]).toMatchObject({ verified: false });
    expect(digest.findings[1].page).toBeUndefined();
  });
  it("accepts fenced JSON and rejects invalid data", () => {
    expect(parseDigest("```json\n" + raw + "\n```", pages).tldr).toBe("提出一种方法");
    expect(() => parseDigest("not json", pages)).toThrow(/JSON/);
  });
  it("normalizes whitespace and NFKC", () => {
    expect(normalizedQuote("A  B\nC")).toBe("abc");
  });
});
