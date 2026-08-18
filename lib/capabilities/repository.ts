import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CapabilityCommand, CapabilityGap, CapabilityOrganizationProfile } from "./contracts";
import { capabilityProfiles } from "./reference";

const dataDir = process.env.RFXCHANGE_DATA_DIR ?? path.join(process.cwd(), ".rfxchange-data");
const capabilityFile = path.join(dataDir, "capabilities.json");
let writeQueue: Promise<unknown> = Promise.resolve();

function cloneSeed(): CapabilityOrganizationProfile[] { return JSON.parse(JSON.stringify(capabilityProfiles)) as CapabilityOrganizationProfile[]; }
async function ensureDataDir() { await mkdir(dataDir, { recursive: true }); }
async function readProfiles(): Promise<CapabilityOrganizationProfile[]> {
  await ensureDataDir();
  try { return JSON.parse(await readFile(capabilityFile, "utf8")) as CapabilityOrganizationProfile[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; const seed = cloneSeed(); await writeProfiles(seed); return seed; }
}
async function writeProfiles(profiles: CapabilityOrganizationProfile[]) {
  await ensureDataDir();
  const temp = `${capabilityFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(profiles, null, 2), "utf8");
  await rename(temp, capabilityFile);
}
function queuedWrite<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work); writeQueue = next.then(() => undefined, () => undefined); return next;
}

function profileStrength(profile: CapabilityOrganizationProfile) {
  if (!profile.capabilities.length) return 0;
  const count = profile.capabilities.length;
  const mapped = profile.capabilities.filter((item) => item.mappingStatus === "accepted" && item.amacsNodeId).length / count;
  const evidenced = profile.capabilities.filter((item) => item.evidence.length > 0).length / count;
  const published = profile.capabilities.filter((item) => item.publicationStatus === "published").length / count;
  const discoverability = Math.min(profile.keywords.length / 4, 1);
  return Math.round(mapped * 30 + evidenced * 30 + published * 30 + discoverability * 10);
}
function profileGaps(profile: CapabilityOrganizationProfile): CapabilityGap[] {
  const gaps: CapabilityGap[] = [];
  for (const claim of profile.capabilities) {
    if (claim.mappingStatus !== "accepted" || !claim.amacsNodeId) gaps.push({ id: `${claim.id}-mapping-gap`, label: `${claim.name}: AMACS review`, reason: "This capability does not yet have a participant-confirmed AMACS mapping.", suggestedSearch: claim.name });
    if (!claim.evidence.length) gaps.push({ id: `${claim.id}-evidence-gap`, label: `${claim.name}: supporting evidence`, reason: "This capability does not yet have supporting evidence associated with the claim.", suggestedSearch: `${claim.name} evidence` });
    if (claim.publicationStatus !== "published") gaps.push({ id: `${claim.id}-publication-gap`, label: `${claim.name}: Exchange visibility`, reason: "This capability is not yet published to the Exchange.", suggestedSearch: claim.name });
  }
  return gaps;
}
function refreshProfile(profile: CapabilityOrganizationProfile) {
  profile.profileStrength = profileStrength(profile); profile.gaps = profileGaps(profile); profile.updatedAt = new Date().toISOString();
}

export async function listCapabilityProfiles() { return readProfiles(); }
export async function getCapabilityProfile(recordId: string) { return (await readProfiles()).find((profile) => profile.exchangeRecordId === recordId); }

export async function applyCapabilityCommand(recordId: string, command: CapabilityCommand): Promise<CapabilityOrganizationProfile> {
  return queuedWrite(async () => {
    const profiles = await readProfiles();
    const profile = profiles.find((candidate) => candidate.exchangeRecordId === recordId);
    if (!profile) throw new Error("Capability profile not found");
    if (!profile.ownedByViewer) throw new Error("Only the active organization capability profile can be modified");

    if (command.type === "add-claim") {
      profile.capabilities.push({ id: `capability-${randomUUID()}`, name: command.name.trim(), description: command.description.trim(), mappingStatus: "needs-review", publicationStatus: "draft", evidenceState: "claimed", evidence: [], specialties: command.specialties?.map((item) => item.trim()).filter(Boolean) ?? [] });
    }
    if (command.type === "update-claim") {
      const claim = profile.capabilities.find((item) => item.id === command.capabilityId); if (!claim) throw new Error("Capability claim not found");
      if (command.name !== undefined) claim.name = command.name.trim(); if (command.description !== undefined) claim.description = command.description.trim(); if (command.specialties !== undefined) claim.specialties = command.specialties.map((item) => item.trim()).filter(Boolean); if (command.publicationStatus !== undefined) claim.publicationStatus = command.publicationStatus;
    }
    if (command.type === "set-amacs-mapping") {
      const claim = profile.capabilities.find((item) => item.id === command.capabilityId); if (!claim) throw new Error("Capability claim not found");
      if (command.disposition === "reject") { claim.amacsNodeId = undefined; claim.amacsLabel = undefined; claim.mappingStatus = "needs-review"; }
      else { if (!command.amacsNodeId?.trim() || !command.amacsLabel?.trim()) throw new Error("AMACS concept ID and label are required"); claim.amacsNodeId = command.amacsNodeId.trim(); claim.amacsLabel = command.amacsLabel.trim(); claim.mappingStatus = "accepted"; }
    }
    if (command.type === "add-evidence") {
      const claim = profile.capabilities.find((item) => item.id === command.capabilityId); if (!claim) throw new Error("Capability claim not found");
      if (!command.label.trim()) throw new Error("Evidence label is required"); claim.evidence.push({ id: `evidence-${randomUUID()}`, kind: command.kind, label: command.label.trim(), issuer: command.issuer?.trim() || undefined, note: command.note?.trim() || undefined }); claim.evidenceState = "supported";
    }
    if (command.type === "remove-evidence") {
      const claim = profile.capabilities.find((item) => item.id === command.capabilityId); if (!claim) throw new Error("Capability claim not found"); claim.evidence = claim.evidence.filter((item) => item.id !== command.evidenceId); claim.evidenceState = claim.evidence.length ? "supported" : "claimed";
    }
    if (command.type === "publish-profile") {
      for (const claim of profile.capabilities) claim.publicationStatus = claim.mappingStatus === "accepted" && claim.amacsNodeId ? "published" : "ready"; profile.publishedAt = new Date().toISOString();
    }
    refreshProfile(profile); await writeProfiles(profiles); return profile;
  });
}
