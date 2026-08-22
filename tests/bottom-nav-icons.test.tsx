import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/exchange/bottom-nav";
import { lensDefinitions } from "@/lib/exchange/lenses";
import type { ExchangeLens, ExchangeLensIconId } from "@/lib/exchange/contracts";

const expectedIcons: Record<ExchangeLens, ExchangeLensIconId> = {
  rfx: "opportunity-document",
  resources: "resource-ecosystem",
  intelligence: "intelligence-signal",
  capabilities: "capability-stack",
};

describe("Exchange lens navigation icons", () => {
  it("keeps semantic lens identity in the registry instead of raw glyph or SVG details", () => {
    expect(Object.fromEntries(Object.entries(lensDefinitions).map(([lens, definition]) => [lens, definition.icon]))).toEqual(expectedIcons);
    expect(JSON.stringify(lensDefinitions)).not.toMatch(/[⌁◫◉◇]/);
  });

  it("renders one Lucide SVG language while preserving navigation semantics and interaction", () => {
    const onLensChange = vi.fn();
    const onMenu = vi.fn();
    const { container } = render(<BottomNav activeLens="intelligence" menuOpen={false} onLensChange={onLensChange} onMenu={onMenu} />);

    const icons = Array.from(container.querySelectorAll("svg[data-exchange-nav-icon]"));
    expect(icons).toHaveLength(5);
    expect(icons.map((icon) => icon.getAttribute("data-exchange-nav-icon"))).toEqual([
      "opportunity-document",
      "resource-ecosystem",
      "intelligence-signal",
      "capability-stack",
      "menu",
    ]);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));

    expect(screen.getByRole("button", { name: "Intelligence" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "RFx" })).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: "Resources" }));
    expect(onLensChange).toHaveBeenCalledWith("resources");

    fireEvent.click(screen.getByRole("button", { name: "Open Menu utilities" }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
