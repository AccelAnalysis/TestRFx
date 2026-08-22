import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionRail } from "@/components/exchange/action-rail";
import { MenuSurface } from "@/components/exchange/menu-surface";
import { RecordActionRow } from "@/components/exchange/record-actions";
import type { LensAction } from "@/lib/exchange/contracts";

function action(overrides: Partial<LensAction>): LensAction {
  return {
    id: "show-mine",
    position: 1,
    label: "My RFx",
    icon: "◉",
    trigger: "direct",
    scope: "lens",
    ownership: "any",
    visible: true,
    applicable: true,
    authorized: true,
    operational: true,
    prerequisitesSatisfied: true,
    ...overrides,
  };
}

function clickText(label: string) {
  const target = screen.getByText(label).closest("button");
  if (!target) throw new Error(`No button found for ${label}`);
  fireEvent.click(target);
}

describe("governed Exchange icon consistency", () => {
  it("replaces the legacy mine glyph in the persistent lens action rail", () => {
    const { container } = render(<ActionRail actions={[action({})]} />);
    expect(container.querySelector('[data-exchange-icon="my-records"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/[⌁◫◉◇]/);
  });

  it("replaces the legacy capability glyph in record-specific Match RFx actions", () => {
    const { container } = render(
      <RecordActionRow
        actions={[action({ id: "match-rfx", label: "Match RFx", icon: "◇", scope: "record", ownership: "other", requiresRecord: true })]}
        onAction={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-exchange-icon="match-rfx"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/[⌁◫◉◇]/);
  });

  it("uses the governed capability icon for the Menu handoff instead of the old diamond glyph", () => {
    const { container } = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Organization Profile");
    expect(container.querySelector('[data-exchange-icon="capability-stack"]')).toBeTruthy();
    expect(container.textContent).not.toContain("◇");
  });

  it("replaces every other reused legacy lens glyph when those Menu destinations render", () => {
    const first = render(<MenuSurface onClose={vi.fn()} />);
    clickText("My Profile");
    clickText("Edit profile");
    expect(first.container.querySelector('[data-exchange-icon="personal-profile"]')).toBeTruthy();
    expect(first.container.textContent).not.toContain("◉");
    first.unmount();

    const second = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Security & Account");
    expect(second.container.querySelector('[data-exchange-icon="security-key"]')).toBeTruthy();
    expect(second.container.textContent).not.toContain("⌁");
    second.unmount();

    const third = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Settings");
    expect(third.container.querySelector('[data-exchange-icon="application-preferences"]')).toBeTruthy();
    expect(third.container.textContent).not.toContain("◫");
    third.unmount();

    const fourth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Saved & Watchlist");
    expect(fourth.container.querySelectorAll('[data-exchange-icon="watching"]')).toHaveLength(2);
    expect(fourth.container.textContent).not.toContain("◉");
    fourth.unmount();

    const fifth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Referrals Management");
    clickText("Referral details");
    expect(fifth.container.querySelector('[data-exchange-icon="timeline"]')).toBeTruthy();
    expect(fifth.container.textContent).not.toContain("⌁");
    fifth.unmount();

    const sixth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Billing & Membership");
    expect(sixth.container.querySelector('[data-exchange-icon="membership-lifecycle"]')).toBeTruthy();
    expect(sixth.container.textContent).not.toContain("⌁");
    sixth.unmount();
  });
});
