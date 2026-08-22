"use client";

import { useEffect, useMemo, useState } from "react";
import type { Coordinates, DrawerQueryState, DrawerState, ExchangeFilters, ExchangeLens, ExchangeRecord, ExchangeSearchState, ExchangeViewerContext, GeolocationStatus, LensAction, MapGeographyOption, MapViewState, RecentSearch, SavedSearch } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { deriveReferenceViewerContext } from "@/lib/exchange/action-registry";
import { applyExchangeFilters, createExchangeFilters } from "@/lib/exchange/filter";
import { applyDrawerQuery, createDefaultDrawerQuery } from "@/lib/exchange/drawer";
import { intelligenceSeed } from "@/lib/exchange/intelligence";
import type { IntelligenceWorkflow } from "@/lib/exchange/intelligence-runtime";
import { getIntelligenceNavigationPath } from "@/lib/exchange/intelligence-runtime";
import { listIntelligenceFromService, setIntelligenceTracking } from "@/lib/exchange/intelligence-client";
import { isCapabilityWorkflowMode, type CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import { capabilityProfileToExchangeRecord } from "@/lib/capabilities/contracts";
import { capabilityExchangeRecords, getCapabilityProfileByExchangeRecordId } from "@/lib/capabilities/reference";
import { loadCapabilityProfiles } from "@/lib/capabilities/service-client";
import { setSharedRelationship as setSharedRelationshipClient } from "@/lib/exchange/shared-workflow-client";
import { lensDefinitions, lensOrder } from "@/lib/exchange/lenses";
import { createDefaultMapView } from "@/lib/exchange/map-model";
import { deriveMapGeographies, mapBoundsEqual, scopeMapRecordsToBounds, viewForCurrentLocation, viewForGeography } from "@/lib/exchange/map-service";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import { archiveResourceThroughService, createResourceReferral, listResourcesFromService, offerResourceThroughService, requestResourceThroughService, sendResourceThroughService, setSharedRelationshipThroughService, updateResourceThroughService } from "@/lib/exchange/resource-service-client";
import { initialResourceNavigationState, type ResourceNavigationAction, type ResourceNavigationState } from "@/lib/exchange/resource-navigation";
import { activeFilterCount, defaultSearchState, getSearchSuggestions, searchExchangeRecords, searchStateFromParams, searchStateToParams, typeByLens } from "@/lib/exchange/search";
import { lensSearchFacetDefinitions } from "@/lib/exchange/search-navigation";
import { useUniversalSearchRuntime } from "@/lib/exchange/use-universal-search-runtime";
import type { RfxWorkflowEntry } from "@/lib/rfx/contracts";
import { loadRfxWorkspace, saveRfxWorkspace } from "@/lib/rfx/workspace-client";
import { setPursuitState, setWorkspaceValues } from "@/lib/rfx/workspace";
import { CapabilityWorkflowSurface } from "@/components/capabilities/capability-workflow-surface";
import { RfxWorkflowSurface } from "@/components/rfx/rfx-workflow-surface";
import { PersistentMap } from "./persistent-map";
import { SearchControls } from "./search-controls";
import { FloatingControls } from "./floating-controls";
import { ResultsDrawer } from "./results-drawer";
import { BottomNav } from "./bottom-nav";
import { DetailSurface } from "./detail-surface";
import { MenuSurface } from "./menu-surface";
import { IntelligenceWorkflowSurface } from "./intelligence-workflow-surface";
import { IntelligenceNavigationSurface } from "./intelligence-navigation-surface";
import { ResourceNotice } from "./resource-notice";
import { ResourceNavigationSurface } from "./resource-navigation-surface";
import { ResourceWorkflowSurface, type ResourceWorkflow } from "./resource-workflow-surface";
import styles from "./exchange-shell.module.css";

const recentStorageKey = "rfxchange:recent-searches";
const savedStorageKey = "rfxchange:saved-searches";
const rfxDraftStorageKey = "rfxchange:rfx-local-drafts";
const SELF_ORGANIZATION_ANCHOR_ID = "__viewer-organization-anchor__";
const initialRecords = [...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"), ...intelligenceSeed, ...capabilityExchangeRecords];
const initialSavedRecordIds = initialRecords.filter((record) => record.saved).map((record) => record.id);
const initialSearchStates = () => Object.fromEntries(lensOrder.map((lens) => [lens, defaultSearchState()])) as Record<ExchangeLens, ExchangeSearchState>;
const initialFloatingFilters = () => Object.fromEntries(lensOrder.map((lens) => [lens, createExchangeFilters()])) as Record<ExchangeLens, ExchangeFilters>;
const initialDrawerQueries = () => Object.fromEntries(lensOrder.map((lens) => [lens, createDefaultDrawerQuery()])) as Record<ExchangeLens, DrawerQueryState>;
type IntelligenceFlow = { mode: IntelligenceWorkflow; recordId?: string };
type CapabilityFlow = { mode: CapabilityWorkflowMode; recordId: string };
type RfxFlow = { entry: RfxWorkflowEntry; recordId: string };

function pagesPreview() { return typeof location !== "undefined" && location.hostname.endsWith("github.io"); }

export function ExchangeShell({ initialLens = "rfx", initialRecordId, viewerContext }: { initialLens?: ExchangeLens; initialRecordId?: string; viewerContext?: Partial<ExchangeViewerContext> }) {
  const [lens, setLens] = useState<ExchangeLens>(initialLens);
  const [recordsState, setRecordsState] = useState<ExchangeRecord[]>(initialRecords);
  const [searchByLens, setSearchByLens] = useState<Record<ExchangeLens, ExchangeSearchState>>(initialSearchStates);
  const [filtersByLens, setFiltersByLens] = useState<Record<ExchangeLens, ExchangeFilters>>(initialFloatingFilters);
  const [drawerQueries, setDrawerQueries] = useState<Record<ExchangeLens, DrawerQueryState>>(initialDrawerQueries);
  const [drawer, setDrawer] = useState<DrawerState>("mid");
  const [mapView, setMapView] = useState<MapViewState>(createDefaultMapView);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>(initialRecordId);
  const [detailRecordId, setDetailRecordId] = useState<string | undefined>(initialRecordId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialSection, setMenuInitialSection] = useState<"referrals" | undefined>();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedRecordIds, setSavedRecordIds] = useState<Set<string>>(() => new Set(initialSavedRecordIds));
  const [actionNotice, setActionNotice] = useState("");
  const [rfxWorkflow, setRfxWorkflow] = useState<RfxFlow>();
  const [resourceWorkflow, setResourceWorkflow] = useState<ResourceWorkflow>();
  const [resourceNavigationOpen, setResourceNavigationOpen] = useState(false);
  const [resourceNavigation, setResourceNavigation] = useState<ResourceNavigationState>(initialResourceNavigationState);
  const [resourceNotice, setResourceNotice] = useState<string>();
  const [intelligenceWorkflow, setIntelligenceWorkflow] = useState<IntelligenceFlow>();
  const [intelligenceNavigationNodeId, setIntelligenceNavigationNodeId] = useState<string>();
  const [intelligenceNotes, setIntelligenceNotes] = useState<Record<string, string[]>>({});
  const [capabilityWorkflow, setCapabilityWorkflow] = useState<CapabilityFlow>();
  const [capabilityProfiles, setCapabilityProfiles] = useState<Map<string, CapabilityOrganizationProfile>>(new Map());
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [viewerLocation, setViewerLocation] = useState<Coordinates>();
  const [viewportDirty, setViewportDirty] = useState(false);

  const allRecords = useMemo(() => recordsState.map((record) => ({ ...record, saved: savedRecordIds.has(record.id) })), [recordsState, savedRecordIds]);
  const referenceViewerContext = useMemo(() => deriveReferenceViewerContext(allRecords), [allRecords]);
  const resolvedViewerContext = useMemo<ExchangeViewerContext>(() => ({ ...referenceViewerContext, ...viewerContext }), [referenceViewerContext, viewerContext]);
  const organizationName = resolvedViewerContext.organization?.name ?? "Your Organization";
  const definition = lensDefinitions[lens];
  const searchState = searchByLens[lens];
  const floatingFilters = filtersByLens[lens];
  const drawerQuery = drawerQueries[lens];
  const effectiveSearchState = useMemo<ExchangeSearchState>(() => ({
    ...searchState,
    filters: {
      ...searchState.filters,
      geography: floatingFilters.geography ?? searchState.filters.geography,
      location: floatingFilters.mappedOnly ? "mapped" : searchState.filters.location,
      ownership: floatingFilters.relationship !== "all" ? floatingFilters.relationship : searchState.filters.ownership,
      metadata: searchState.filters.metadata,
      facets: {
        ...(searchState.filters.facets ?? {}),
        ...(floatingFilters.metadata.length ? { metadata: floatingFilters.metadata } : {}),
      },
    },
  }), [searchState, floatingFilters]);
  const searchRuntimeEnabled = !pagesPreview();
  const universalSearch = useUniversalSearchRuntime({ enabled: searchRuntimeEnabled, lens, state: effectiveSearchState });
  const localSearchResponse = useMemo(() => searchExchangeRecords(allRecords, lens, searchState), [allRecords, lens, searchState]);
  const searchRecords = searchRuntimeEnabled && universalSearch.runtime.initialized ? universalSearch.runtime.records : localSearchResponse.results.map((result) => result.record);
  const filteredRecords = useMemo(() => searchRuntimeEnabled && universalSearch.runtime.initialized ? (floatingFilters.featuredOnly ? searchRecords.filter((record) => record.featured) : searchRecords) : applyExchangeFilters(searchRecords, floatingFilters), [searchRuntimeEnabled, universalSearch.runtime.initialized, searchRecords, floatingFilters]);
  const viewportRecords = useMemo(() => searchRuntimeEnabled && universalSearch.runtime.initialized && searchState.filters.geographyMode === "viewport" ? filteredRecords : scopeMapRecordsToBounds(filteredRecords, mapView.queriedBounds), [searchRuntimeEnabled, universalSearch.runtime.initialized, searchState.filters.geographyMode, filteredRecords, mapView.queriedBounds]);
  const records = useMemo(() => applyDrawerQuery(viewportRecords, drawerQuery), [viewportRecords, drawerQuery]);
  const lensRecords = useMemo(() => allRecords.filter((record) => record.type === typeByLens[lens]), [allRecords, lens]);
  const suggestions = useMemo(() => getSearchSuggestions(allRecords, lens, searchState.query), [allRecords, lens, searchState.query]);
  const mapGeographies = useMemo(() => deriveMapGeographies(lensRecords.filter((record) => record.resource?.status !== "archived")), [lensRecords]);
  const detailRecord = allRecords.find((record) => record.id === detailRecordId) ?? searchRecords.find((record) => record.id === detailRecordId);
  const actions = definition.actions(resolvedViewerContext);
  const rfxWorkflowRecord = rfxWorkflow ? allRecords.find((record) => record.id === rfxWorkflow.recordId) : undefined;
  const resourceWorkflowRecord = resourceWorkflow && "recordId" in resourceWorkflow ? allRecords.find((record) => record.id === resourceWorkflow.recordId) ?? searchRecords.find((record) => record.id === resourceWorkflow.recordId) : undefined;
  const resourceNavigationRecord = [...allRecords, ...searchRecords].find((record) => record.id === (detailRecordId ?? selectedRecordId) && record.type === "resource");
  const intelligenceWorkflowRecord = intelligenceWorkflow?.recordId ? allRecords.find((record) => record.id === intelligenceWorkflow.recordId) ?? searchRecords.find((record) => record.id === intelligenceWorkflow.recordId) : undefined;
  const intelligenceNavigationRecord = [...allRecords, ...searchRecords].find((record) => record.id === (detailRecordId ?? selectedRecordId) && record.type === "intelligence");
  const rawCapabilityWorkflowProfile = capabilityWorkflow ? capabilityProfiles.get(capabilityWorkflow.recordId) ?? getCapabilityProfileByExchangeRecordId(capabilityWorkflow.recordId) : undefined;
  const capabilityWorkflowProfile = rawCapabilityWorkflowProfile?.ownedByViewer ? { ...rawCapabilityWorkflowProfile, organizationName } : rawCapabilityWorkflowProfile;

  useEffect(() => {
    try {
      const recent = localStorage.getItem(recentStorageKey); const saved = localStorage.getItem(savedStorageKey); const localDrafts = localStorage.getItem(rfxDraftStorageKey);
      if (recent) setRecentSearches(JSON.parse(recent)); if (saved) setSavedSearches(JSON.parse(saved));
      if (localDrafts) { const drafts = JSON.parse(localDrafts) as ExchangeRecord[]; setRecordsState((current) => [...drafts, ...current.filter((record) => !drafts.some((draft) => draft.id === record.id))]); }
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    void listResourcesFromService().then(({ records: live }) => { if (!active) return; replaceDomainRecords("resource", live); syncSaved(live); }).catch((error) => { if (active && !pagesPreview()) { replaceDomainRecords("resource", []); setResourceNotice(error instanceof Error ? error.message : "Resources runtime is unavailable."); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void listIntelligenceFromService("", 0, 100).then((result) => { if (!active) return; replaceDomainRecords("intelligence", result.records); syncSaved(result.records); }).catch((error) => { if (active && !pagesPreview()) { replaceDomainRecords("intelligence", []); setActionNotice(error instanceof Error ? error.message : "Intelligence runtime is unavailable."); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadCapabilityProfiles().then(({ profiles, records: live }) => { if (!active) return; setCapabilityProfiles(new Map(profiles.map((profile) => [profile.exchangeRecordId, profile]))); replaceDomainRecords("capability", live); syncSaved(live); }).catch((error) => { if (active && !pagesPreview()) { replaceDomainRecords("capability", []); setActionNotice(error instanceof Error ? error.message : "Capabilities runtime is unavailable."); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true; const candidates = initialRecords.filter((record) => record.type === "rfx");
    void Promise.all(candidates.map(async (record) => { const entry: RfxWorkflowEntry = record.ownedByViewer ? "manage-rfx" : "view"; const loaded = await loadRfxWorkspace(record.id, entry); return loaded.workspace.values["watch.active"] ? record.id : undefined; })).then((ids) => { if (!active) return; setSavedRecordIds((current) => { const next = new Set(current); ids.filter(Boolean).forEach((id) => next.add(id!)); return next; }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function syncFromUrl() { const parts = location.pathname.split("/").filter(Boolean); const urlLens = parts[1]; if (urlLens === "rfx" || urlLens === "resources" || urlLens === "intelligence" || urlLens === "capabilities") { const urlState = searchStateFromParams(new URLSearchParams(location.search)); setLens(urlLens); setSearchByLens((current) => ({ ...current, [urlLens]: urlState })); const recordId = parts[2]; setSelectedRecordId(recordId); setDetailRecordId(recordId); } }
    syncFromUrl(); addEventListener("popstate", syncFromUrl); return () => removeEventListener("popstate", syncFromUrl);
  }, []);
  useEffect(() => { if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) setSelectedRecordId(undefined); }, [records, selectedRecordId]);
  useEffect(() => { if (!actionNotice) return; const timeout = setTimeout(() => setActionNotice(""), 5200); return () => clearTimeout(timeout); }, [actionNotice]);
  useEffect(() => { if (!resourceNotice) return; const timeout = setTimeout(() => setResourceNotice(undefined), 5200); return () => clearTimeout(timeout); }, [resourceNotice]);

  function replaceDomainRecords(type: ExchangeRecord["type"], live: ExchangeRecord[]) { setRecordsState((current) => [...current.filter((record) => record.type !== type), ...live]); }
  function syncSaved(live: ExchangeRecord[]) { setSavedRecordIds((current) => { const next = new Set(current); for (const record of live) { if (record.saved) next.add(record.id); else next.delete(record.id); } return next; }); }
  function persistRecent(next: RecentSearch[]) { setRecentSearches(next); try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch {} }
  function persistSaved(next: SavedSearch[]) { setSavedSearches(next); try { localStorage.setItem(savedStorageKey, JSON.stringify(next)); } catch {} }
  function persistLocalRfxDraft(record: ExchangeRecord) { try { const raw = localStorage.getItem(rfxDraftStorageKey); const current = raw ? JSON.parse(raw) as ExchangeRecord[] : []; localStorage.setItem(rfxDraftStorageKey, JSON.stringify([record, ...current.filter((item) => item.id !== record.id)])); } catch {} }
  function setUrl(nextLens: ExchangeLens, recordId?: string, mode: "push" | "replace" = "replace", state = searchByLens[nextLens]) { const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`; const params = searchStateToParams(state).toString(); history[mode === "push" ? "pushState" : "replaceState"]({}, "", params ? `${path}?${params}` : path); }
  function updateSearchState(next: ExchangeSearchState) { setSearchByLens((current) => ({ ...current, [lens]: next })); setUrl(lens, detailRecordId, "replace", next); }
  function commitSearch(next: ExchangeSearchState) {
    updateSearchState(next); if (!next.query.trim() && activeFilterCount(next) === 0) return;
    if (searchRuntimeEnabled) { void universalSearch.recordRecent({ ...effectiveSearchState, query: next.query }, universalSearch.runtime.total).catch((error) => setActionNotice(error instanceof Error ? error.message : "Recent search could not be recorded.")); return; }
    const recent: RecentSearch = { id: `${lens}-${Date.now()}`, lens, state: next, createdAt: new Date().toISOString() }; persistRecent([recent, ...recentSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(next))].slice(0, 12));
  }
  async function saveCurrentSearch() {
    if (!searchState.query.trim() && activeFilterCount(searchState) === 0 && !floatingFilters.geography && !floatingFilters.metadata.length && floatingFilters.relationship === "all" && !floatingFilters.mappedOnly && !floatingFilters.featuredOnly) return;
    const descriptor = searchState.query.trim() || floatingFilters.geography || searchState.filters.geography.trim() || "Discovery"; const name = `${definition.label}: ${descriptor}`;
    if (searchRuntimeEnabled) { try { await universalSearch.saveSearch(name, effectiveSearchState); setActionNotice("Search saved."); } catch (error) { setActionNotice(error instanceof Error ? error.message : "Search could not be saved."); } return; }
    const saved: SavedSearch = { id: `${lens}-${Date.now()}`, name, lens, state: searchState, createdAt: new Date().toISOString() }; persistSaved([saved, ...savedSearches.filter((item) => item.lens !== lens || JSON.stringify(item.state) !== JSON.stringify(searchState))].slice(0, 20));
  }
  function updateSavedSearch(id: string, patch: { name?: string; state?: ExchangeSearchState; alertEnabled?: boolean }) { if (!searchRuntimeEnabled) { setSavedSearches((current) => current.map((saved) => saved.id === id ? { ...saved, ...patch, updatedAt: new Date().toISOString() } : saved)); return; } void universalSearch.updateSaved(id, patch).catch((error) => setActionNotice(error instanceof Error ? error.message : "Saved search could not be updated.")); }
  function deleteSavedSearch(id: string) { if (!searchRuntimeEnabled) { persistSaved(savedSearches.filter((saved) => saved.id !== id)); return; } void universalSearch.deleteSaved(id).catch((error) => setActionNotice(error instanceof Error ? error.message : "Saved search could not be deleted.")); }
  function runSearchAlerts() { if (!searchRuntimeEnabled) return; void universalSearch.runAlerts().then((evaluations) => { const changed = evaluations.filter((item) => item.changed).length; setActionNotice(changed ? `${changed} saved search${changed === 1 ? " has" : "es have"} new or changed results.` : "Saved search alerts are current."); }).catch((error) => setActionNotice(error instanceof Error ? error.message : "Saved search alerts could not be checked.")); }
  function changeLens(next: ExchangeLens) { const prior = searchByLens[next]; const carried = prior.query.trim() ? prior : { ...prior, query: searchState.query }; setLens(next); setSearchByLens((current) => ({ ...current, [next]: carried })); setSelectedRecordId(undefined); setDetailRecordId(undefined); setRfxWorkflow(undefined); setResourceWorkflow(undefined); setResourceNavigationOpen(false); setIntelligenceWorkflow(undefined); setIntelligenceNavigationNodeId(undefined); setCapabilityWorkflow(undefined); setActionNotice(""); setMapView((current) => ({ ...current, queriedBounds: undefined })); setViewportDirty(false); setUrl(next, undefined, "replace", carried); }
  function selectRecord(id: string) { if (id === SELF_ORGANIZATION_ANCHOR_ID) return; setSelectedRecordId(id); if (drawer === "peek") setDrawer("mid"); }
  function openDetail(id: string) { setSelectedRecordId(id); setDetailRecordId(id); setUrl(lens, id, "push", searchState); }
  function closeDetail() { setDetailRecordId(undefined); setUrl(lens, undefined, "replace", searchState); }
  function toggleSavedLocal(id: string) { setSavedRecordIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  function beginCreateRfx() { const id = `rfx-local-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`; const contextualGeography = floatingFilters.geography || mapView.geography.label || "Geography not yet defined"; const draft: ExchangeRecord = { id, type: "rfx", title: "New RFx draft", organization: organizationName, summary: "RFx draft created from the issuer workflow.", geography: contextualGeography, metadata: [], ownedByViewer: true, card: { eyebrow: "RFx", status: { label: "Draft", tone: "neutral" } } }; setRecordsState((current) => [draft, ...current]); persistLocalRfxDraft(draft); setSelectedRecordId(id); setDetailRecordId(undefined); setRfxWorkflow({ entry: "create-rfx", recordId: id }); }
  async function toggleRfxWatch(record: ExchangeRecord) { const currentlySaved = savedRecordIds.has(record.id); const entry: RfxWorkflowEntry = record.ownedByViewer ? "manage-rfx" : "view"; const loaded = await loadRfxWorkspace(record.id, entry); let next = setWorkspaceValues(loaded.workspace, { "watch.active": !currentlySaved }); if (!record.ownedByViewer) next = setPursuitState(next, currentlySaved ? "discovered" : "watching"); const saved = await saveRfxWorkspace(next, loaded.persistence); setSavedRecordIds((current) => { const updated = new Set(current); if (currentlySaved) updated.delete(record.id); else updated.add(record.id); return updated; }); setActionNotice(`${currentlySaved ? "Removed from watch" : record.ownedByViewer ? "Tracking" : "Watching"}: ${record.title} · ${saved.persistence === "postgres" ? "Postgres" : "this device"}`); }

  async function setResourceRelationship(recordId: string, kind: "saved" | "following", active: boolean) { await setSharedRelationshipThroughService(recordId, kind, active); if (kind === "saved") setSavedRecordIds((current) => { const next = new Set(current); if (active) next.add(recordId); else next.delete(recordId); return next; }); setRecordsState((current) => current.map((record) => { if (record.id !== recordId) return record; const relationships = new Set(record.card?.relationships ?? []); if (active) relationships.add(kind); else relationships.delete(kind); return { ...record, saved: kind === "saved" ? active : record.saved, card: { ...(record.card ?? {}), relationships: Array.from(relationships) } }; })); setResourceWorkflow(undefined); setResourceNotice(`${active ? kind === "saved" ? "Saved" : "Following" : kind === "saved" ? "Removed from Saved" : "No longer following"} Resource.`); }
  async function toggleIntelligenceRelationship(record: ExchangeRecord, requestedActive?: boolean) { const active = requestedActive ?? !savedRecordIds.has(record.id); const mode = record.ownedByViewer ? "track" : "follow"; await setIntelligenceTracking(record.id, mode, active); setSavedRecordIds((current) => { const next = new Set(current); if (active) next.add(record.id); else next.delete(record.id); return next; }); setActionNotice(active ? record.ownedByViewer ? "Tracking intelligence." : "Following intelligence." : "Intelligence tracking removed."); }
  async function toggleCapabilityFollow(record: ExchangeRecord) { if (record.id.startsWith("cap-draft-")) return; const active = !savedRecordIds.has(record.id); await setSharedRelationshipClient(record.id, "following", active, "card"); setSavedRecordIds((current) => { const next = new Set(current); if (active) next.add(record.id); else next.delete(record.id); return next; }); setActionNotice(active ? "Following capability profile." : "Stopped following capability profile."); }
  function handleCardSave(id: string) { const record = [...allRecords, ...searchRecords].find((item) => item.id === id); if (!record) return; if (record.type === "rfx") { void toggleRfxWatch(record); return; } if (record.type === "resource") { void setResourceRelationship(record.id, "saved", !savedRecordIds.has(record.id)).catch((error) => setResourceNotice(error instanceof Error ? error.message : "Resource could not be saved.")); return; } if (record.type === "intelligence") { void toggleIntelligenceRelationship(record).catch((error) => setActionNotice(error instanceof Error ? error.message : "Intelligence tracking failed.")); return; } if (record.type === "capability") { void toggleCapabilityFollow(record).catch((error) => setActionNotice(error instanceof Error ? error.message : "Capability follow failed.")); return; } toggleSavedLocal(id); }

  async function createResource(draft: ResourceDraft) { const { record } = await offerResourceThroughService(draft); setRecordsState((current) => [record, ...current.filter((item) => item.id !== record.id)]); if (record.saved) setSavedRecordIds((current) => new Set(current).add(record.id)); setSelectedRecordId(record.id); setResourceWorkflow(undefined); setResourceNotice(record.location ? "Resource offer published with its canonical organization location." : "Resource offer published as an off-map/service-area listing; no coordinate was fabricated."); }
  async function updateResource(recordId: string, draft: ResourceDraft) { const { record } = await updateResourceThroughService(recordId, draft); setRecordsState((current) => current.map((item) => item.id === record.id ? record : item)); setResourceWorkflow(undefined); setResourceNotice(record.location ? "Resource changes saved." : "Resource changes saved; the listing remains truthfully off-map."); }
  async function requestResource(recordId: string, request: ResourceRequestDraft) { await requestResourceThroughService(recordId, request); const record = [...allRecords, ...searchRecords].find((item) => item.id === recordId); setResourceWorkflow(undefined); setResourceNotice(`Request sent for ${record?.title ?? "Resource"}${request.neededBy ? ` · needed ${request.neededBy}` : ""}.`); }
  async function archiveResource(recordId: string) { await archiveResourceThroughService(recordId); setRecordsState((current) => current.map((record) => record.id === recordId && record.resource ? { ...record, resource: { ...record.resource, status: "archived" as const } } : record)); setSelectedRecordId(undefined); setDetailRecordId(undefined); setResourceWorkflow(undefined); setResourceNotice("Resource archived and removed from active discovery."); setUrl("resources"); }
  async function shareResource(recordId: string, recipientOrganizationId: string, message: string) { const { share } = await sendResourceThroughService(recordId, recipientOrganizationId, message); setResourceWorkflow(undefined); setResourceNotice(`Resource sent to ${share.recipientOrganization.name}.`); }
  async function referResource(recordId: string, recipientOrganizationId: string, note: string) { const { referral } = await createResourceReferral(recordId, recipientOrganizationId, note); setResourceWorkflow(undefined); setResourceNotice(`Referral ${referral.id} created. Track it in Menu → Referrals Management.`); }
  function handleResourceNavigationAction(action: ResourceNavigationAction) { const record = resourceNavigationRecord; if (action === "offer") { setResourceNavigationOpen(false); setResourceWorkflow({ mode: "offer" }); return; } if (action === "open-referrals-management") { setResourceNavigationOpen(false); setMenuInitialSection("referrals"); setMenuOpen(true); return; } if (!record) { setResourceNotice("Select a Resource to continue this workflow."); return; } setResourceNavigationOpen(false); if (action === "edit") setResourceWorkflow({ mode: "edit", recordId: record.id }); if (action === "share") setResourceWorkflow({ mode: "share", recordId: record.id }); if (action === "save-archive") setResourceWorkflow({ mode: "save-archive", recordId: record.id }); if (action === "request") setResourceWorkflow({ mode: "request", recordId: record.id }); if (action === "save-follow") setResourceWorkflow({ mode: "save-follow", recordId: record.id }); if (action === "referral") setResourceWorkflow({ mode: "referral", recordId: record.id }); if (action === "view") openDetail(record.id); }

  function createInsight(record: ExchangeRecord) { setRecordsState((current) => [record, ...current.filter((item) => item.id !== record.id)]); setSelectedRecordId(record.id); setActionNotice("Insight added to Intelligence."); }
  function updateInsight(record: ExchangeRecord) { setRecordsState((current) => current.map((item) => item.id === record.id ? record : item)); setActionNotice("Insight updated."); }
  function addIntelligenceNote(recordId: string, note: string) { setIntelligenceNotes((current) => ({ ...current, [recordId]: [...(current[recordId] ?? []), note] })); setActionNotice("Note saved to Intelligence."); }
  function runIntelligenceWorkflow(workflow: IntelligenceWorkflow, record?: ExchangeRecord) { setIntelligenceNavigationNodeId(undefined); setIntelligenceWorkflow({ mode: workflow, recordId: record?.id }); }

  function setLensScope(patch: Partial<DrawerQueryState>) { setDrawerQueries((current) => ({ ...current, [lens]: { ...createDefaultDrawerQuery(), sort: current[lens].sort, ...patch } })); }
  function applyLensControl(action: LensAction) { if (action.id === "show-mine") { setLensScope({ ownership: "mine" }); return true; } if (action.id === "show-saved") { setLensScope({ savedOnly: true }); return true; } if (action.id === "show-mapped") { setLensScope({ location: "mapped" }); return true; } if (action.id === "show-off-map") { setLensScope({ location: "off-map" }); return true; } if (action.id === "show-all") { setLensScope({}); return true; } return false; }
  function activeLensControlIds(resolved: LensAction[]) { const ids = new Set<string>(); if (drawerQuery.ownership === "mine") ids.add("show-mine"); if (drawerQuery.savedOnly) ids.add("show-saved"); if (drawerQuery.location === "mapped") ids.add("show-mapped"); if (drawerQuery.location === "off-map") ids.add("show-off-map"); if (drawerQuery.ownership === "all" && drawerQuery.location === "all" && !drawerQuery.savedOnly && !drawerQuery.featuredOnly) ids.add("show-all"); return resolved.filter((action) => ids.has(action.id)).map((action) => action.id); }

  async function handleAction(action: LensAction, record?: ExchangeRecord) {
    if (action.scope === "lens") { if (applyLensControl(action)) return; if (action.id === "create-rfx") { beginCreateRfx(); return; } if (action.id === "offer-resource") { setResourceWorkflow({ mode: "offer" }); return; } if (action.id === "add-insight") { setIntelligenceWorkflow({ mode: "add" }); return; } if (action.id === "manage-capability-profile") { const own = allRecords.find((item) => item.type === "capability" && item.ownedByViewer); if (own) setCapabilityWorkflow({ mode: "manage-capabilities", recordId: own.id }); else setActionNotice("No organization capability profile is available to manage yet."); return; } }
    if (action.requiresRecord && !record) return;
    if (lens === "rfx" && record) { if (action.id === "manage-rfx") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "manage-rfx", recordId: record.id }); return; } if (action.id === "invite-team") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "invite-team", recordId: record.id }); return; } if (action.id === "respond") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "respond", recordId: record.id }); return; } if (action.id === "team") { setDetailRecordId(undefined); setRfxWorkflow({ entry: "team", recordId: record.id }); return; } }
    if (lens === "resources" && record) { if (action.id === "edit-resource") { setResourceWorkflow({ mode: "edit", recordId: record.id }); return; } if (action.id === "request-resource") { setResourceWorkflow({ mode: "request", recordId: record.id }); return; } if (action.id === "archive-resource") { setResourceWorkflow({ mode: "archive", recordId: record.id }); return; } if (action.id === "share") { setResourceWorkflow({ mode: "share", recordId: record.id }); return; } if (action.id === "refer") { setResourceWorkflow({ mode: "referral", recordId: record.id }); return; } }
    if (lens === "intelligence" && record) { if (action.id === "edit-insight") { setIntelligenceWorkflow({ mode: "edit", recordId: record.id }); return; } if (action.id === "add-note") { setIntelligenceWorkflow({ mode: "note", recordId: record.id }); return; } if (action.id === "compare") { setIntelligenceWorkflow({ mode: "compare", recordId: record.id }); return; } if (action.id === "track" || action.id === "follow") { await toggleIntelligenceRelationship(record); return; } }
    if (lens === "capabilities" && record && isCapabilityWorkflowMode(action.id)) { setCapabilityWorkflow({ mode: action.id, recordId: record.id }); return; }
    if (action.id === "share" && record) { const url = `${location.origin}/exchange/${lens}/${record.id}`; try { if (navigator.share) await navigator.share({ title: record.title, text: record.summary, url }); else { await navigator.clipboard.writeText(url); setActionNotice("Record link copied."); } } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setActionNotice("Unable to share this record right now."); } }
  }

  function resetMapView() { setMapView((current) => ({ ...createDefaultMapView(), layers: current.layers })); setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: undefined } })); const mode = searchState.filters.geographyMode; if (mode === "viewport" || mode === "radius" || mode === "service-area" || mode === "performance-area") updateSearchState({ ...searchState, filters: { ...searchState.filters, geographyMode: "exchange", bounds: undefined, center: undefined, radiusMiles: undefined } }); setViewportDirty(false); }
  function handleMapViewChange(next: MapViewState) { setMapView(next); if (next.queriedBounds && next.currentBounds && !mapBoundsEqual(next.queriedBounds, next.currentBounds)) setViewportDirty(true); }
  function changeMapViewFromControls(next: MapViewState) { const moved = Math.abs(next.camera.zoom - mapView.camera.zoom) > .01 || Math.abs(next.camera.center.lat - mapView.camera.center.lat) > .00001 || Math.abs(next.camera.center.lng - mapView.camera.center.lng) > .00001; setMapView(next); if (moved) setViewportDirty(true); }
  function selectGeography(geography?: MapGeographyOption) { if (!geography) { resetMapView(); return; } setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: geography.label } })); updateSearchState({ ...searchState, filters: { ...searchState.filters, geography: geography.label, geographyMode: "exchange", bounds: undefined, center: undefined, radiusMiles: undefined } }); setMapView((current) => viewForGeography(current, geography)); setViewportDirty(false); }
  function searchCurrentArea() { if (!mapView.currentBounds) return; setMapView((current) => ({ ...current, queriedBounds: current.currentBounds })); updateSearchState({ ...searchState, filters: { ...searchState.filters, geographyMode: "viewport", bounds: mapView.currentBounds, center: undefined, radiusMiles: undefined } }); setViewportDirty(false); }
  function locateViewer() { if (!("geolocation" in navigator)) { setGeolocationStatus("unavailable"); return; } setGeolocationStatus("requesting"); navigator.geolocation.getCurrentPosition((position) => { const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude }; setViewerLocation(coordinate); setGeolocationStatus("located"); setFiltersByLens((current) => ({ ...current, [lens]: { ...current[lens], geography: undefined } })); setMapView((current) => viewForCurrentLocation(current, coordinate)); setViewportDirty(true); }, (error) => setGeolocationStatus(error.code === 1 ? "denied" : "unavailable"), { timeout: 8000, maximumAge: 60000 }); }

  const visibleRecords = records.filter((record) => record.resource?.status !== "archived");
  const lensRecent = searchRuntimeEnabled ? universalSearch.recent : recentSearches.filter((item) => item.lens === lens);
  const lensSaved = searchRuntimeEnabled ? universalSearch.saved : savedSearches.filter((item) => item.lens === lens);
  const localMapped = visibleRecords.filter((record) => record.location).length;
  const localOffMap = visibleRecords.length - localMapped;
  const mapped = searchRuntimeEnabled && universalSearch.runtime.initialized ? universalSearch.runtime.mapped : localMapped;
  const offMap = searchRuntimeEnabled && universalSearch.runtime.initialized ? universalSearch.runtime.offMap : localOffMap;
  const organizationAnchor = resolvedViewerContext.organization; const hasVisibleOwnMarker = visibleRecords.some((record) => record.ownedByViewer && record.location);
  const organizationAnchorRecord: ExchangeRecord | undefined = organizationAnchor?.location && !hasVisibleOwnMarker ? { id: SELF_ORGANIZATION_ANCHOR_ID, type: typeByLens[lens], title: organizationName, organization: organizationName, summary: "Signed-in organization map anchor.", geography: mapView.geography.label, metadata: [], location: organizationAnchor.location, ownedByViewer: true } : undefined;
  const mapRecords = organizationAnchorRecord ? [...visibleRecords, organizationAnchorRecord] : visibleRecords;
  const drawerActiveActionIds = activeLensControlIds(actions); const detailActions = detailRecord ? definition.recordActions(detailRecord, resolvedViewerContext) : [];

  return <main className="exchange-shell">
    <PersistentMap lens={lens} records={mapRecords} selectedRecordId={selectedRecordId} drawerState={drawer} view={mapView} viewerLocation={viewerLocation} onViewChange={handleMapViewChange} onViewportInteraction={() => setViewportDirty(true)} onSelect={selectRecord} />
    <SearchControls state={searchState} placeholder={definition.searchPlaceholder} lens={lens} lensLabel={definition.label} suggestions={suggestions} recentSearches={lensRecent} savedSearches={lensSaved} facets={universalSearch.runtime.facets} facetDefinitions={lensSearchFacetDefinitions[lens]} mapCenter={mapView.camera.center} mapBounds={mapView.currentBounds} onStateChange={updateSearchState} onCommit={commitSearch} onRunState={(next) => { updateSearchState(next); commitSearch(next); }} onSave={() => { void saveCurrentSearch(); }} onUpdateSaved={updateSavedSearch} onDeleteSaved={deleteSavedSearch} onRunAlerts={runSearchAlerts} />
    <FloatingControls lens={lens} records={lensRecords.filter((record) => record.resource?.status !== "archived")} search={searchState.query} filters={floatingFilters} onFiltersChange={(next) => setFiltersByLens((current) => ({ ...current, [lens]: next }))} mapView={mapView} mapGeographies={mapGeographies} onMapViewChange={changeMapViewFromControls} onSelectGeography={selectGeography} geolocationStatus={geolocationStatus} onLocate={locateViewer} onResetView={resetMapView} searchAreaAvailable={viewportDirty} onSearchArea={searchCurrentArea} />
    <ResultsDrawer state={drawer} onStateChange={setDrawer} lens={lens} lensLabel={definition.label} records={visibleRecords} totalAvailableCount={searchRuntimeEnabled && universalSearch.runtime.initialized ? universalSearch.runtime.total : viewportRecords.length} selectedRecordId={selectedRecordId} actions={actions} activeActionIds={drawerActiveActionIds} getRecordActions={(record) => definition.recordActions(record, resolvedViewerContext)} onAction={(action, record) => { void handleAction(action, record); }} emptyMessage={definition.emptyMessage} resultContext={`${mapped} mapped · ${offMap} off-map${searchState.filters.geographyMode === "viewport" ? " · map area applied" : ""}`} query={drawerQuery} onQueryChange={(next) => setDrawerQueries((current) => ({ ...current, [lens]: next }))} onSelect={selectRecord} onOpen={openDetail} onToggleSave={handleCardSave} resultStatus={searchRuntimeEnabled ? universalSearch.runtime.status : "ready"} hasMore={searchRuntimeEnabled ? universalSearch.runtime.hasMore : false} loadingMore={universalSearch.loadingMore} onLoadMore={searchRuntimeEnabled ? () => { void universalSearch.loadMore(); } : undefined} onRetry={searchRuntimeEnabled ? universalSearch.retry : undefined} onOpenWorkflowHierarchy={lens === "resources" ? () => setResourceNavigationOpen(true) : lens === "intelligence" ? () => setIntelligenceNavigationNodeId("intelligence") : undefined} />
    <BottomNav activeLens={lens} onLensChange={changeLens} onMenu={() => { setMenuInitialSection(undefined); setMenuOpen(true); }} />
    {detailRecord ? <DetailSurface record={detailRecord} actions={detailActions} notes={intelligenceNotes[detailRecord.id] ?? []} onAction={(action) => { void handleAction(action, detailRecord); }} onClose={closeDetail} /> : null}
    {menuOpen ? <MenuSurface initialSectionId={menuInitialSection} onClose={() => { setMenuOpen(false); setMenuInitialSection(undefined); }} /> : null}
    {rfxWorkflow && rfxWorkflowRecord ? <RfxWorkflowSurface record={rfxWorkflowRecord} entry={rfxWorkflow.entry} onClose={() => setRfxWorkflow(undefined)} onOpenDetail={() => { setRfxWorkflow(undefined); openDetail(rfxWorkflowRecord.id); }} onToggleWatch={() => { void toggleRfxWatch(rfxWorkflowRecord); }} onLensHandoff={(next) => { setRfxWorkflow(undefined); changeLens(next); }} onOpenMenu={() => { setRfxWorkflow(undefined); setMenuInitialSection(undefined); setMenuOpen(true); }} /> : null}
    {resourceNavigationOpen ? <ResourceNavigationSurface state={resourceNavigation} record={resourceNavigationRecord} onStateChange={setResourceNavigation} onAction={handleResourceNavigationAction} onClose={() => setResourceNavigationOpen(false)} /> : null}
    {resourceWorkflow ? <ResourceWorkflowSurface workflow={resourceWorkflow} record={resourceWorkflowRecord} onClose={() => setResourceWorkflow(undefined)} onCreate={createResource} onUpdate={updateResource} onRequest={requestResource} onArchive={archiveResource} onRelationship={setResourceRelationship} onShare={shareResource} onRefer={referResource} /> : null}
    {intelligenceNavigationNodeId ? <IntelligenceNavigationSurface nodeId={intelligenceNavigationNodeId} record={intelligenceNavigationRecord} onNavigate={setIntelligenceNavigationNodeId} onBack={() => { const path = getIntelligenceNavigationPath(intelligenceNavigationNodeId); setIntelligenceNavigationNodeId(path.at(-2)?.id); }} onClose={() => setIntelligenceNavigationNodeId(undefined)} onRunWorkflow={runIntelligenceWorkflow} /> : null}
    {intelligenceWorkflow ? <IntelligenceWorkflowSurface workflow={intelligenceWorkflow.mode} record={intelligenceWorkflowRecord} records={allRecords} onClose={() => setIntelligenceWorkflow(undefined)} onCreate={createInsight} onUpdate={updateInsight} onAddNote={addIntelligenceNote} /> : null}
    {capabilityWorkflow && capabilityWorkflowProfile ? <CapabilityWorkflowSurface profile={capabilityWorkflowProfile} mode={capabilityWorkflow.mode} onClose={() => setCapabilityWorkflow(undefined)} onProfileChange={(profile) => { setCapabilityProfiles((current) => new Map(current).set(profile.exchangeRecordId, profile)); const projected = capabilityProfileToExchangeRecord(profile); setRecordsState((current) => [projected, ...current.filter((item) => item.id !== projected.id)]); }} /> : null}
    <ResourceNotice message={resourceNotice} />{actionNotice ? <div className={styles.actionNotice} role="status" aria-live="polite">{actionNotice}</div> : null}
  </main>;
}
