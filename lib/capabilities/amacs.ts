import type { AmacsCandidateResponse, AmacsInterpretationCandidate, CapabilityClaim } from "./contracts";

export const AMACS_RUNTIME_VERSION = "0.5.0";

function tokens(value: string) { return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((item) => item.length > 2)); }
function scoreCandidate(query: Set<string>, candidate: Set<string>) { if (!query.size) return 0; let hits = 0; query.forEach((token) => { if (candidate.has(token)) hits += 1; }); return hits / query.size; }
function asCandidate(record: Record<string, unknown>, query: Set<string>): AmacsInterpretationCandidate | undefined {
  const conceptId = [record.id, record.concept_id, record.capability_id].find((value) => typeof value === "string") as string | undefined;
  const label = [record.label, record.name, record.preferred_label].find((value) => typeof value === "string") as string | undefined;
  if (!conceptId || !label) return undefined;
  const aliases = Array.isArray(record.aliases) ? record.aliases.filter((item): item is string => typeof item === "string") : [];
  const definition = typeof record.definition === "string" ? record.definition : typeof record.description === "string" ? record.description : undefined;
  const score = scoreCandidate(query, tokens([label, definition ?? "", ...aliases].join(" ")));
  if (!score) return undefined;
  return { conceptId, label, definition, score, source: "amacs-release" };
}
function parseCatalog(text: string): Record<string, unknown>[] {
  const trimmed = text.trim(); if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed) as Record<string, unknown>[];
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

/**
 * AMACS is a governed versioned data standard, not an AI provider. RFxchange can
 * point this adapter at a release artifact with AMACS_CATALOG_URL. Candidate
 * generation remains non-authoritative; the participant must accept/edit/reject.
 */
export async function getAmacsCandidates(claim: CapabilityClaim): Promise<AmacsCandidateResponse> {
  const catalogUrl = process.env.AMACS_CATALOG_URL;
  if (!catalogUrl) return { available: false, manualPath: true, amacsVersion: AMACS_RUNTIME_VERSION, candidates: [], reason: "AMACS_CATALOG_URL is not configured. Manual AMACS mapping remains available." };
  try {
    const response = await fetch(catalogUrl, { headers: { accept: "application/json, application/x-ndjson, text/plain" }, cache: "no-store" });
    if (!response.ok) throw new Error(`AMACS release returned ${response.status}`);
    const query = tokens([claim.name, claim.description, ...claim.specialties].join(" "));
    const candidates = parseCatalog(await response.text()).map((record) => asCandidate(record, query)).filter((item): item is AmacsInterpretationCandidate => Boolean(item)).sort((a, b) => b.score - a.score).slice(0, 8);
    return { available: true, manualPath: true, amacsVersion: AMACS_RUNTIME_VERSION, candidates };
  } catch (error) {
    return { available: false, manualPath: true, amacsVersion: AMACS_RUNTIME_VERSION, candidates: [], reason: error instanceof Error ? error.message : "AMACS catalog could not be loaded." };
  }
}
