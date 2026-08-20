import type { MapStyleId } from "./contracts";

export interface MapStyleDefinition {
  id: MapStyleId;
  label: string;
  description: string;
  provider: string;
  url: string;
}

const OPENFREEMAP_STYLE_BASE = "https://tiles.openfreemap.org/styles";

export const mapStyleOrder: MapStyleId[] = ["standard", "bright", "light", "dark", "muted"];

export const mapStyleDefinitions: Record<MapStyleId, MapStyleDefinition> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Balanced streets, buildings, places, and points of interest.",
    provider: "OpenFreeMap · Liberty",
    url: process.env.NEXT_PUBLIC_RFX_MAP_STYLE_URL || `${OPENFREEMAP_STYLE_BASE}/liberty`,
  },
  bright: {
    id: "bright",
    label: "Detailed",
    description: "Higher-contrast roads, boundaries, labels, and place detail.",
    provider: "OpenFreeMap · Bright",
    url: `${OPENFREEMAP_STYLE_BASE}/bright`,
  },
  light: {
    id: "light",
    label: "Light",
    description: "Minimal basemap that keeps dense Exchange records visually prominent.",
    provider: "OpenFreeMap · Positron",
    url: `${OPENFREEMAP_STYLE_BASE}/positron`,
  },
  dark: {
    id: "dark",
    label: "Dark",
    description: "Dark basemap for low-light viewing and bright record overlays.",
    provider: "OpenFreeMap · Dark",
    url: `${OPENFREEMAP_STYLE_BASE}/dark`,
  },
  muted: {
    id: "muted",
    label: "Muted",
    description: "Subdued land, water, roads, and labels for a softer geographic backdrop.",
    provider: "OpenFreeMap · Fiord",
    url: `${OPENFREEMAP_STYLE_BASE}/fiord`,
  },
};

export function mapStyleUrl(style: MapStyleId) {
  return mapStyleDefinitions[style].url;
}
