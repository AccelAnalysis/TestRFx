import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExchangeLens, ExchangeRecord } from "./contracts";
import type { ExchangeActorContext, RelationshipKind, SharedWorkflowEvent, SharedWorkflowId, WorkflowSource } from "./shared-workflows";
import { buildReferenceWorkflowEvent, relationshipKindForWorkflow } from "./shared-workflows";

export interface StoredRelationship { id: string; userId: string; organizationId: string; recordId: string; recordTitle: string; recordOrganization: string; lens: ExchangeLens; kind: RelationshipKind; createdAt: string; updatedAt: string; }
export interface StoredReferral { id: string; senderOrganizationId: string; recipientOrganizationName: string; recordId: string; recordTitle: string; sourceLens: ExchangeLens; note?: string; status: "proposed" | "accepted" | "completed" | "declined"; createdAt: string; updatedAt: string; }
interface WorkflowStore { relationships: StoredRelationship[]; referrals: StoredReferral[]; events: SharedWorkflowEvent[]; }

const dataDir = process.env.RFXCHANGE_DATA_DIR ?? path.join(process.cwd(), ".rfxchange-data");
const storeFile = path.join(dataDir, "shared-workflows.json");
let writeQueue: Promise<unknown> = Promise.resolve();
const emptyStore = (): WorkflowStore => ({ relationships: [], referrals: [], events: [] });
async function ensureDataDir() { await mkdir(dataDir, { recursive: true }); }
async function readStore(): Promise<WorkflowStore> { await ensureDataDir(); try { return JSON.parse(await readFile(storeFile, "utf8")) as WorkflowStore; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return emptyStore(); } }
async function writeStore(store: WorkflowStore) { await ensureDataDir(); const temp = `${storeFile}.${process.pid}.${Date.now()}.tmp`; await writeFile(temp, JSON.stringify(store, null, 2), "utf8"); await rename(temp, storeFile); }
function queuedWrite<T>(work: () => Promise<T>): Promise<T> { const next = writeQueue.then(work, work); writeQueue = next.then(() => undefined, () => undefined); return next; }

export async function readSavedRelationships(actor: ExchangeActorContext) { const store = await readStore(); return store.relationships.filter((item) => item.userId === actor.userId); }
export async function readReferrals(actor: ExchangeActorContext) { const store = await readStore(); return store.referrals.filter((item) => item.senderOrganizationId === actor.organizationId); }

export async function executeSharedWorkflow(input: { workflow: SharedWorkflowId; lens: ExchangeLens; record: ExchangeRecord; actor: ExchangeActorContext; source: WorkflowSource; payload?: Record<string, unknown> }) {
  return queuedWrite(async () => {
    const store = await readStore(); const event = buildReferenceWorkflowEvent(input, input.payload ?? {}); const now = new Date().toISOString();
    const relationshipKind = relationshipKindForWorkflow(input.workflow);
    let relationship: StoredRelationship | undefined; let relationshipActive: boolean | undefined; let referral: StoredReferral | undefined;
    if (relationshipKind) {
      const index = store.relationships.findIndex((item) => item.userId === input.actor.userId && item.recordId === input.record.id && item.kind === relationshipKind);
      if (index >= 0) { relationship = store.relationships[index]; store.relationships.splice(index, 1); relationshipActive = false; }
      else { relationship = { id: randomUUID(), userId: input.actor.userId, organizationId: input.actor.organizationId, recordId: input.record.id, recordTitle: input.record.title, recordOrganization: input.record.organization, lens: input.lens, kind: relationshipKind, createdAt: now, updatedAt: now }; store.relationships.push(relationship); relationshipActive = true; }
    }
    if (input.workflow === "refer") {
      referral = { id: randomUUID(), senderOrganizationId: input.actor.organizationId, recipientOrganizationName: input.record.organization, recordId: input.record.id, recordTitle: input.record.title, sourceLens: input.lens, note: typeof input.payload?.note === "string" ? input.payload.note : undefined, status: "proposed", createdAt: now, updatedAt: now }; store.referrals.push(referral);
    }
    store.events.unshift(event); store.events = store.events.slice(0, 500); await writeStore(store);
    return { event, relationship, relationshipActive, referral };
  });
}
