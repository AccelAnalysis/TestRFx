import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const menuSource = readFileSync(join(process.cwd(), "components/exchange/menu-surface.tsx"), "utf8");

const internalPhrases = [
  "Cross-lens utilities",
  "Task surface",
  "Menu section",
  "Production integration point",
  "Service boundary:",
  "Connected handoff",
  ">Defined<",
  ">Operational<",
];

describe("Menu experience language", () => {
  it("keeps internal architecture metadata out of the visible Menu surface", () => {
    for (const phrase of internalPhrases) expect(menuSource).not.toContain(phrase);
  });

  it("uses Logo & Media as the organization-facing media destination", () => {
    expect(menuSource).toContain("Logo & Media");
  });
});
