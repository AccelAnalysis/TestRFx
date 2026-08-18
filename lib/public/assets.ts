export interface PublicImageAsset {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly creditLabel: string;
  readonly sourceUrl: string;
  readonly evidenceUse: "atmosphere-only";
}

export const PUBLIC_IMAGE_ASSETS = Object.freeze({
  construction: Object.freeze({
    id: "unsplash-construction-iveyfb-3b70",
    src: "https://images.unsplash.com/photo-1742112125567-3e8967bad60f?auto=format&fit=crop&w=2400&q=82",
    alt: "Construction professionals reviewing plans at an active job site",
    creditLabel: "RONNAKORN TRIRAGANON · Unsplash",
    sourceUrl: "https://unsplash.com/photos/construction-workers-review-plans-at-a-job-site-IvEYfb-3B70",
    evidenceUse: "atmosphere-only",
  }),
  manufacturing: Object.freeze({
    id: "unsplash-manufacturing-a52ub25ud8a",
    src: "https://images.unsplash.com/photo-1742934028777-4d283a3233cc?auto=format&fit=crop&w=1800&q=80",
    alt: "Worker operating equipment on a manufacturing production line",
    creditLabel: "EqualStock · Unsplash",
    sourceUrl: "https://unsplash.com/photos/factory-worker-sews-with-a-machine-on-a-production-line-a52uB25uD8A",
    evidenceUse: "atmosphere-only",
  }),
  workshop: Object.freeze({
    id: "unsplash-workshop-fhl-y01fsvg",
    src: "https://images.unsplash.com/photo-1770386291809-dfbd371046c9?auto=format&fit=crop&w=1600&q=80",
    alt: "Small-business craftspeople working in a workshop",
    creditLabel: "Zhen Yao · Unsplash",
    sourceUrl: "https://unsplash.com/photos/two-men-working-in-a-workshop-with-shelves-of-supplies-Fhl-y01fSvg",
    evidenceUse: "atmosphere-only",
  }),
  professional: Object.freeze({
    id: "unsplash-business-vrt8k7bj7wk",
    src: "https://images.unsplash.com/photo-1758518729711-1cbacd55efdb?auto=format&fit=crop&w=1600&q=80",
    alt: "Professionals discussing operational work around a table",
    creditLabel: "Vitaly Gariev · Unsplash",
    sourceUrl: "https://unsplash.com/photos/business-people-collaborating-in-a-modern-office-meeting-VRT8k7BJ7wk",
    evidenceUse: "atmosphere-only",
  }),
  collaboration: Object.freeze({
    id: "unsplash-collaboration-yhc8ov7tcdm",
    src: "https://images.unsplash.com/photo-1758518727929-4506fc031e1c?auto=format&fit=crop&w=1600&q=80",
    alt: "Four professionals collaborating around business documents",
    creditLabel: "Vitaly Gariev · Unsplash",
    sourceUrl: "https://unsplash.com/photos/four-business-people-in-a-meeting-discussing-documents-YHC8oV7tcdM",
    evidenceUse: "atmosphere-only",
  }),
  warehouse: Object.freeze({
    id: "unsplash-warehouse-gjztdr6e4vq",
    src: "https://images.unsplash.com/photo-1777026321659-64941fb943dd?auto=format&fit=crop&w=1800&q=80",
    alt: "Warehouse aisles filled with inventory",
    creditLabel: "Phillip Flores · Unsplash",
    sourceUrl: "https://unsplash.com/photos/warehouse-storage-aisles-with-shelves-full-of-boxes-gjZTDr6E4vQ",
    evidenceUse: "atmosphere-only",
  }),
  region: Object.freeze({
    id: "unsplash-region-l4de9vwfkew",
    src: "https://images.unsplash.com/photo-1633536584998-2d71cbd95d37?auto=format&fit=crop&w=2400&q=82",
    alt: "Aerial view of a city, region, and waterways",
    creditLabel: "McGill Productions · Unsplash",
    sourceUrl: "https://unsplash.com/photos/an-aerial-view-of-a-large-city-in-the-middle-of-the-ocean-L4dE9VWfkEw",
    evidenceUse: "atmosphere-only",
  }),
} satisfies Readonly<Record<string, PublicImageAsset>>);

export const PUBLIC_IMAGE_ASSET_LIST = Object.freeze(Object.values(PUBLIC_IMAGE_ASSETS));

export const PUBLIC_ASSET_POLICY = Object.freeze({
  stockPhotographyIsProductEvidence: false,
  fabricatedScreensAllowed: false,
  fabricatedOrganizationsAllowed: false,
  fabricatedStatisticsAllowed: false,
  fabricatedTestimonialsAllowed: false,
  finalCommercialLicenseReviewRequired: true,
} as const);
