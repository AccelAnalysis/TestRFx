import type {
  DrawerQueryState,
  DrawerState,
  ExchangeRecord,
} from "./contracts";

export const DEFAULT_DRAWER_QUERY: DrawerQueryState = {
  sort: "relevance",
  location: "all",
  ownership: "all",
  savedOnly: false,
  featuredOnly: false,
};

export function createDefaultDrawerQuery(): DrawerQueryState {
  return { ...DEFAULT_DRAWER_QUERY };
}

export function applyDrawerQuery(records: ExchangeRecord[], query: DrawerQueryState): ExchangeRecord[] {
  const filtered = records.filter((record) => {
    if (query.location === "mapped" && !record.location) return false;
    if (query.location === "off-map" && record.location) return false;
    if (query.ownership === "mine" && !record.ownedByViewer) return false;
    if (query.ownership === "others" && record.ownedByViewer) return false;
    if (query.savedOnly && !record.saved) return false;
    if (query.featuredOnly && !record.featured) return false;
    return true;
  });

  if (query.sort === "relevance") return filtered;

  return [...filtered].sort((left, right) => {
    if (query.sort === "title") return left.title.localeCompare(right.title);
    if (query.sort === "organization") {
      return left.organization.localeCompare(right.organization) || left.title.localeCompare(right.title);
    }
    return left.geography.localeCompare(right.geography) || left.title.localeCompare(right.title);
  });
}

export function getDrawerResultBreakdown(records: ExchangeRecord[]) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.location) summary.mapped += 1;
      else summary.offMap += 1;
      if (record.saved) summary.saved += 1;
      if (record.ownedByViewer) summary.owned += 1;
      return summary;
    },
    { total: 0, mapped: 0, offMap: 0, saved: 0, owned: 0 },
  );
}

export function hasActiveDrawerFilters(query: DrawerQueryState): boolean {
  return query.location !== "all" || query.ownership !== "all" || query.savedOnly || query.featuredOnly;
}

export const nextDrawerState: Record<DrawerState, DrawerState> = {
  peek: "mid",
  mid: "expanded",
  expanded: "peek",
};

export const higherDrawerState: Record<DrawerState, DrawerState> = {
  peek: "mid",
  mid: "expanded",
  expanded: "expanded",
};

export const lowerDrawerState: Record<DrawerState, DrawerState> = {
  peek: "peek",
  mid: "peek",
  expanded: "mid",
};
