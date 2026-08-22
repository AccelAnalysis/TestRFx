import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", "node_modules", "out", "coverage"]);
const textExtensions = new Set([".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".svg", ".ts", ".tsx", ".txt", ".yml", ".yaml"]);
const legacyLensGlyphs = [0x2301, 0x25eb, 0x25c9, 0x25c7].map((codePoint) => String.fromCodePoint(codePoint));

function trackedTextFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (ignoredDirectories.has(name)) return [];
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return trackedTextFiles(path);
    return textExtensions.has(extname(name).toLowerCase()) ? [path] : [];
  });
}

describe("legacy lens glyph removal", () => {
  it("contains none of the retired RFx, Resources, Intelligence, or Capabilities font glyphs anywhere in the repository text sources", () => {
    const matches = trackedTextFiles(root).flatMap((path) => {
      const content = readFileSync(path, "utf8");
      return legacyLensGlyphs
        .filter((glyph) => content.includes(glyph))
        .map((glyph) => `${relative(root, path)} contains U+${glyph.codePointAt(0)?.toString(16).toUpperCase()}`);
    });

    expect(matches).toEqual([]);
  });
});
