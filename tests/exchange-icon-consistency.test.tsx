import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionRail } from "@/components/exchange/action-rail";
import { MenuSurface } from "@/components/exchange/menu-surface";
import { RecordActionRow } from "@/components/exchange/record-actions";
import { resolveLensActions, resolveRecordActions } from "@/lib/exchange/action-registry";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { menuSections, menuSignOutNode } from "@/lib/exchange/menu";
import type { ExchangeRecord, ExchangeViewerContext, LensAction } from "@/lib/exchange/contracts";

const legacyLensGlyphs = /[\u2301\u25eb\u25c9\u25c7]/;

function action(overrides: Partial<LensAction>): LensAction {
  return {
    id: "show-mine",
    position: 1,
    label: "My RFx",
    icon: "my-records",
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

const viewer: ExchangeViewerContext = {
  canIssueRfx: true,
  canRespondRfx: true,
  canOfferResources: true,
  canRequestResources: true,
  canContributeIntelligence: true,
  canManageCapabilities: true,
};

const records: Record<(typeof lensOrder)[number], ExchangeRecord> = {
  rfx: { id: "rfx", type: "rfx", title: "RFx", organization: "Issuer", summary: "", geography: "", metadata: [] },
  resources: { id: "resource", type: "resource", title: "Resource", organization: "Provider", summary: "", geography: "", metadata: [] },
  intelligence: { id: "intelligence", type: "intelligence", title: "Insight", organization: "Source", summary: "", geography: "", metadata: [] },
  capabilities: { id: "capability", type: "capability", title: "Capability", organization: "Company", summary: "", geography: "", metadata: [] },
};

describe("governed Exchange icon consistency", () => {
  it("contains no legacy lens glyphs in the lens, action, or Menu data models", () => {
    const actions = lensOrder.flatMap((lens) => [
      ...resolveLensActions(lens, viewer),
      ...resolveRecordActions(lens, records[lens], viewer),
    ]);
    expect(JSON.stringify(lensDefinitions)).not.toMatch(legacyLensGlyphs);
    expect(JSON.stringify(actions)).not.toMatch(legacyLensGlyphs);
    expect(JSON.stringify([...menuSections, menuSignOutNode])).not.toMatch(legacyLensGlyphs);
  });

  it("renders the semantic mine identity in the persistent lens action rail", () => {
    const { container } = render(<ActionRail actions={[action({})]} />);
    expect(container.querySelector('[data-exchange-icon="my-records"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(legacyLensGlyphs);
  });

  it("renders the semantic RFx-match identity in record-specific actions", () => {
    const { container } = render(
      <RecordActionRow
        actions={[action({ id: "match-rfx", label: "Match RFx", icon: "match-rfx", scope: "record", ownership: "other", requiresRecord: true })]}
        onAction={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-exchange-icon="match-rfx"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(legacyLensGlyphs);
  });

  it("uses the governed capability icon for the Menu handoff", () => {
    const { container } = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Organization Profile");
    expect(container.querySelector('[data-exchange-icon="capability-stack"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(legacyLensGlyphs);
  });

  it("renders semantic SVG replacements for every prior Menu reuse of a lens glyph", () => {
    const first = render(<MenuSurface onClose={vi.fn()} />);
    clickText("My Profile");
    clickText("Edit profile");
    expect(first.container.querySelector('[data-exchange-icon="personal-profile"]')).toBeTruthy();
    expect(first.container.textContent).not.toMatch(legacyLensGlyphs);
    first.unmount();

    const second = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Security & Account");
    expect(second.container.querySelector('[data-exchange-icon="security-key"]')).toBeTruthy();
    expect(second.container.textContent).not.toMatch(legacyLensGlyphs);
    second.unmount();

    const third = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Settings");
    expect(third.container.querySelector('[data-exchange-icon="application-preferences"]')).toBeTruthy();
    expect(third.container.textContent).not.toMatch(legacyLensGlyphs);
    third.unmount();

    const fourth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Saved & Watchlist");
    expect(fourth.container.querySelectorAll('[data-exchange-icon="watching"]')).toHaveLength(2);
    expect(fourth.container.textContent).not.toMatch(legacyLensGlyphs);
    fourth.unmount();

    const fifth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Referrals Management");
    clickText("Referral details");
    expect(fifth.container.querySelector('[data-exchange-icon="timeline"]')).toBeTruthy();
    expect(fifth.container.textContent).not.toMatch(legacyLensGlyphs);
    fifth.unmount();

    const sixth = render(<MenuSurface onClose={vi.fn()} />);
    clickText("Billing & Membership");
    expect(sixth.container.querySelector('[data-exchange-icon="membership-lifecycle"]')).toBeTruthy();
    expect(sixth.container.textContent).not.toMatch(legacyLensGlyphs);
    sixth.unmount();
  });
});
