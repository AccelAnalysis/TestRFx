import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { resolveRecordActions } from "@/lib/exchange/action-registry";
import { RecordCard } from "@/components/exchange/record-card";

const legacyLensGlyphs = /[\u2301\u25eb\u25c9\u25c7]/;

function action(overrides: Partial<LensAction> = {}): LensAction {
  return { id: "share", position: 1, label: "Share", icon: "↗", trigger: "direct", scope: "record", ownership: "other", visible: true, applicable: true, authorized: true, operational: true, prerequisitesSatisfied: true, requiresRecord: true, ...overrides };
}

function baseRecord(overrides: Partial<ExchangeRecord> = {}): ExchangeRecord {
  return {
    id: "res-test", type: "resource", title: "Mobile Welding Unit", organization: "Hampton Roads Fabrication",
    summary: "This long paragraph belongs in Detail and must not appear on the collapsed card.", geography: "Suffolk, VA",
    metadata: ["Equipment", "Available now", "Secondary detail"], saved: false,
    card: { media: { kind: "image", label: "Resource preview", src: "/exchange-media/resource-mobile-classroom.svg", alt: "Reference resource preview" }, classifications: ["Equipment", "Field Support"], status: { label: "Available", tone: "success" }, distance: "8 mi" },
    resource: { category: "Equipment", availability: "available", availabilityLabel: "Available now", visibility: "public-location", status: "active" },
    ...overrides,
  };
}

function renderCard(record: ExchangeRecord, actions: LensAction[] = [action()]) {
  return render(<RecordCard record={record} selected={false} actions={actions} onSelect={vi.fn()} onOpen={vi.fn()} onToggleSave={vi.fn()} onAction={vi.fn()} />);
}

afterEach(() => { vi.restoreAllMocks(); });

describe("RecordCard media-first rendering", () => {
  it("renders image media while removing paragraph summary and metadata walls", () => {
    renderCard(baseRecord());
    expect(screen.getByAltText("Reference resource preview")).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Mobile Welding Unit")).toBeTruthy(); expect(screen.getByText("Hampton Roads Fabrication")).toBeTruthy();
    expect(screen.getByText("Available now · Suffolk, VA · 8 mi")).toBeTruthy(); expect(screen.getByText("Equipment · Field Support")).toBeTruthy();
    expect(screen.queryByText(/This long paragraph belongs in Detail/)).toBeNull(); expect(screen.queryByText("Secondary detail")).toBeNull();
  });

  it("keeps lifecycle status and sponsored placement exposed to assistive technology", () => {
    const { container } = renderCard(baseRecord({ featured: true, card: { media: { kind: "image", label: "Resource preview", src: "/preview.svg", alt: "Preview" }, classifications: ["Equipment"], status: { label: "Available", tone: "success" }, placement: "sponsored" } }));
    expect(screen.getByText("Available")).toBeTruthy(); expect(screen.getByText("Sponsored")).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).not.toContain("Available");
    expect(container.textContent).toContain("Sponsored");
  });

  it("renders a video poster without a play control when no governed video source exists", () => {
    renderCard(baseRecord({ card: { media: { kind: "video", label: "Short video", poster: "/poster.svg", alt: "Video poster" }, classifications: ["Equipment"] } }));
    expect(screen.getByAltText("Video poster")).toHaveAttribute("src", "/poster.svg"); expect(screen.queryByRole("button", { name: /Play video preview/ })).toBeNull(); expect(screen.getByText("Video preview")).toBeTruthy();
  });

  it("renders organization logo fallback before category fallback", () => {
    renderCard(baseRecord({ card: { organizationMedia: { logo: { kind: "logo", label: "Provider logo", src: "/logo.svg", alt: "Provider logo" } }, classifications: ["Equipment"] } }));
    expect(screen.getByAltText("Provider logo")).toHaveAttribute("src", "/logo.svg");
  });

  it("renders the governed type fallback with the shared SVG identity and recovers from image errors", () => {
    renderCard(baseRecord({ card: { media: { kind: "image", label: "Broken preview", src: "/missing.svg", alt: "Broken image" }, classifications: ["Equipment"] } }));
    fireEvent.error(screen.getByAltText("Broken image"));
    expect(screen.getByText("Broken preview")).toBeTruthy();
    expect(document.querySelector('[data-media-fallback="true"]')).toBeTruthy();
    expect(document.querySelector('[data-exchange-icon="resource-ecosystem"]')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(legacyLensGlyphs);
  });

  it("keeps long titles in the identity region without adding more explanatory copy", () => {
    const longTitle = "Regional Multi-Agency Cybersecurity Assessment and Continuous Remediation Advisory Services";
    renderCard(baseRecord({ title: longTitle })); expect(screen.getByText(longTitle).tagName).toBe("H3"); expect(screen.queryByText(/This long paragraph belongs in Detail/)).toBeNull();
  });

  it("announces selected and saved state without verbose ownership labels", () => {
    const owned = baseRecord({ saved: true, ownedByViewer: true });
    render(<RecordCard record={owned} selected actions={[action({ ownership: "own" })]} onSelect={vi.fn()} onOpen={vi.fn()} onToggleSave={vi.fn()} onAction={vi.fn()} />);
    const article = document.querySelector('[data-record-id="res-test"]'); expect(article?.getAttribute("data-selected")).toBe("true"); expect(article?.getAttribute("data-owned")).toBe("true");
    expect(screen.getByRole("button", { name: /Remove Mobile Welding Unit from saved records/ })).toHaveAttribute("aria-pressed", "true"); expect(screen.queryByText(/Owned by you|Your organization/i)).toBeNull();
  });

  it("preserves governed unavailable actions as disabled instead of simulating functionality", () => {
    renderCard(baseRecord(), [action({ id: "connect", label: "Connect", operational: false, unavailableReason: "Connection workflow is not operational yet." })]);
    expect(screen.getByRole("button", { name: /Connect.*not operational/i })).toBeDisabled();
  });

  it("resolves different governed record actions for own versus other organizations", () => {
    const viewer = { canIssueRfx: true, canRespondRfx: true, canOfferResources: true, canRequestResources: true, canContributeIntelligence: true, canManageCapabilities: true };
    expect(resolveRecordActions("resources", baseRecord(), viewer).map((item) => item.label)).toEqual(["Request", "Refer", "Share"]);
    expect(resolveRecordActions("resources", baseRecord({ id: "res-own", ownedByViewer: true }), viewer).map((item) => item.label)).toEqual(["Edit", "Archive", "Refer", "Share"]);
  });

  it("keeps only one card video playing at a time and restores the prior card to Play state", async () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined); const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const first = baseRecord({ id: "video-1", title: "First video", card: { media: { kind: "video", label: "Video", poster: "/one.svg", videoSrc: "/one.mp4", alt: "First poster" }, classifications: ["Equipment"] } });
    const second = baseRecord({ id: "video-2", title: "Second video", card: { media: { kind: "video", label: "Video", poster: "/two.svg", videoSrc: "/two.mp4", alt: "Second poster" }, classifications: ["Equipment"] } });
    const { container } = render(<><RecordCard record={first} selected={false} actions={[]} onSelect={vi.fn()} onOpen={vi.fn()} onToggleSave={vi.fn()} onAction={vi.fn()} /><RecordCard record={second} selected={false} actions={[]} onSelect={vi.fn()} onOpen={vi.fn()} onToggleSave={vi.fn()} onAction={vi.fn()} /></>);
    fireEvent.click(screen.getByRole("button", { name: "Play video preview for First video" })); await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    const firstVideo = container.querySelector('video[src="/one.mp4"]') as HTMLVideoElement;
    fireEvent.click(screen.getByRole("button", { name: "Play video preview for Second video" })); await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2)); expect(pauseSpy.mock.instances).toContain(firstVideo);
    const firstCard = container.querySelector('[data-record-id="video-1"]') as HTMLElement;
    await waitFor(() => expect(within(firstCard).getByRole("button", { name: "Play video preview for First video" })).toBeTruthy());
    expect(within(firstCard).queryByRole("button", { name: "Pause video preview for First video" })).toBeNull();
  });
});
