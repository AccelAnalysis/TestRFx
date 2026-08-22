import { describe, expect, it } from "vitest";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { buildCardPresentation } from "@/lib/exchange/card-presentation";

function record(overrides: Partial<ExchangeRecord> = {}): ExchangeRecord {
  return {
    id: "test-1", type: "resource", title: "Mobile Welding Unit", organization: "Hampton Roads Fabrication",
    summary: "A deliberately long summary that should never be rendered by the collapsed media-first card.", geography: "Suffolk, VA",
    metadata: ["Equipment", "Available now", "20 kW", "Secondary metadata"],
    card: { classifications: ["Equipment", "Field Support", "Extra classification"], distance: "8 mi" },
    resource: { category: "Equipment", availability: "available", availabilityLabel: "Available now", visibility: "public-location", status: "active" },
    ...overrides,
  };
}

describe("buildCardPresentation", () => {
  it("resolves featured record images before organization media", () => {
    const presentation = buildCardPresentation(record({ card: { media: { kind: "image", label: "Record image", src: "/record.svg", alt: "Record media" }, organizationMedia: { hero: { kind: "image", label: "Hero", src: "/hero.svg" } } } }));
    expect(presentation.media.src).toBe("/record.svg"); expect(presentation.media.kind).toBe("image"); expect(presentation.media.fallback).toBe(false);
  });

  it("supports a video poster without asserting a production video source", () => {
    const presentation = buildCardPresentation(record({ card: { media: { kind: "video", label: "Short video", poster: "/poster.svg", alt: "Video poster" } } }));
    expect(presentation.media.kind).toBe("video"); expect(presentation.media.poster).toBe("/poster.svg"); expect(presentation.media.videoSrc).toBeUndefined();
  });

  it("uses an approved organization intro video when record media is absent", () => {
    const presentation = buildCardPresentation(record({
      type: "capability",
      resource: undefined,
      card: {
        organizationMedia: {
          hero: {
            kind: "video",
            label: "Organization introduction",
            poster: "/intro.jpg",
            videoProvider: "youtube",
            providerVideoId: "abcDEF_1234",
          },
        },
      },
    }));
    expect(presentation.media.kind).toBe("video");
    expect(presentation.media.videoProvider).toBe("youtube");
    expect(presentation.media.providerVideoId).toBe("abcDEF_1234");
    expect(presentation.media.fallback).toBe(false);
  });

  it("keeps RFx or Resource media ahead of organization intro media", () => {
    const presentation = buildCardPresentation(record({
      card: {
        media: { kind: "image", label: "Resource photo", src: "/resource.jpg" },
        organizationMedia: {
          hero: {
            kind: "video",
            label: "Organization introduction",
            poster: "/intro.jpg",
            videoProvider: "vimeo",
            providerVideoId: "123456789",
          },
        },
      },
    }));
    expect(presentation.media.kind).toBe("image");
    expect(presentation.media.src).toBe("/resource.jpg");
  });

  it("falls back to an organization logo after record and organization hero media", () => {
    const presentation = buildCardPresentation(record({ card: { organizationMedia: { logo: { kind: "logo", label: "Organization logo", src: "/logo.svg" } } } }));
    expect(presentation.media.kind).toBe("logo"); expect(presentation.media.src).toBe("/logo.svg");
  });

  it("skips source-less featured media so an available organization visual can render", () => {
    const presentation = buildCardPresentation(record({ card: { media: { kind: "visualization", label: "Signal" }, organizationMedia: { logo: { kind: "logo", label: "Organization logo", src: "/logo.svg" } } } }));
    expect(presentation.media.kind).toBe("logo"); expect(presentation.media.src).toBe("/logo.svg"); expect(presentation.media.fallback).toBe(false);
  });

  it("uses a governed category fallback when no media exists", () => {
    const presentation = buildCardPresentation(record({ card: undefined }));
    expect(presentation.media.kind).toBe("category"); expect(presentation.media.fallback).toBe(true); expect(presentation.media.label).toBe("Resource listing");
  });

  it("reduces Resources to identity, availability/geography, and at most two classifications", () => {
    const presentation = buildCardPresentation(record());
    expect(presentation.title).toBe("Mobile Welding Unit"); expect(presentation.subtitle).toBe("Hampton Roads Fabrication");
    expect(presentation.contextLine).toBe("Available now · Suffolk, VA · 8 mi"); expect(presentation.classifications).toEqual(["Equipment", "Field Support"]); expect(presentation).not.toHaveProperty("summary");
  });

  it("uses organization identity first for Capabilities and suppresses AMACS decoration", () => {
    const presentation = buildCardPresentation(record({ type: "capability", title: "Industrial Electrical Installation", organization: "Tidewater Technical Services", geography: "Portsmouth, VA", metadata: ["AMACS mapped", "Electrical", "Field service"], resource: undefined, card: { classifications: ["AMACS Mapped", "Electrical", "Field Service"], distance: "33 mi" } }));
    expect(presentation.title).toBe("Tidewater Technical Services"); expect(presentation.subtitle).toBe("Industrial Electrical Installation"); expect(presentation.contextLine).toBe("Portsmouth, VA · 33 mi"); expect(presentation.classifications).toEqual(["Electrical", "Field Service"]); expect(presentation.detailLabel).toBe("Profile");
  });

  it("omits empty geography/context cleanly", () => {
    const presentation = buildCardPresentation(record({ geography: "", card: { classifications: ["Equipment"] }, resource: undefined }));
    expect(presentation.contextLine).toBeUndefined(); expect(JSON.stringify(presentation)).not.toContain("undefined");
  });
});
