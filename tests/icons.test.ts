import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8"));

describe("PaperPeek supplied Chrome PNG icons (issue #11)", () => {
  it("wires the original four PNG files in Chrome Manifest V3", () => {
    expect(manifest.version).toBe("0.1.5");
    for (const size of [16, 32, 48, 128]) {
      expect(manifest.icons[String(size)]).toBe("icons/icon" + size + ".png");
    }
    expect(manifest.action.default_icon).toEqual({
      "16": "icons/icon16.png", "32": "icons/icon32.png"
    });
  });

  it.each([16, 32, 48, 128])("ships a valid %ipx transparent PNG", size => {
    const png = readFileSync(resolve("public/icons/icon" + size + ".png"));
    expect(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))).toBe(true);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
    const colorType = png[25]; // 3: indexed; 6: true-color RGBA
    expect([3, 6]).toContain(colorType);
    if (colorType === 3) expect(png.includes(Buffer.from("tRNS"))).toBe(true);
    expect(png.length).toBeGreaterThan(80);
  });
});
