"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord, ResourceAvailabilityState, ResourceVisibility } from "@/lib/exchange/contracts";
import { isResourceRecord, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import styles from "./resources.module.css";

export type ResourceWorkflow =
  | { mode: "offer" }
  | { mode: "edit"; recordId: string }
  | { mode: "request"; recordId: string }
  | { mode: "archive"; recordId: string };

export interface ResourcePersistenceResult { publicId?: string; organization?: string; status?: string; requestId?: string; }

const emptyDraft: ResourceDraft = { title: "", category: "Professional Services", summary: "", geography: "Isle of Wight, VA", availability: "available", availabilityLabel: "Available now", capacity: "", serviceArea: "Isle of Wight County", visibility: "public-location", terms: "" };

function draftFromRecord(record?: ExchangeRecord): ResourceDraft {
  if (!record || !isResourceRecord(record)) return emptyDraft;
  return { title: record.title, category: record.resource.category, summary: record.summary, geography: record.geography, availability: record.resource.availability, availabilityLabel: record.resource.availabilityLabel, capacity: record.resource.capacity ?? "", serviceArea: record.resource.serviceArea ?? "", visibility: record.resource.visibility, terms: record.resource.terms ?? "" };
}

function availabilityLabel(value: ResourceAvailabilityState) {
  if (value === "available") return "Available now";
  if (value === "limited") return "Limited availability";
  return "Scheduled access";
}

async function execute(command: "offer" | "edit" | "request" | "archive", recordId?: string, draft?: ResourceDraft, request?: ResourceRequestDraft) {
  const response = await fetch("/api/exchange/resources/workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command, recordId, draft, request }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Resources service rejected the request.");
  return body.result as ResourcePersistenceResult;
}

export function ResourceWorkflowSurface({ workflow, record, onClose, onCreate, onUpdate, onRequest, onArchive }: {
  workflow: ResourceWorkflow;
  record?: ExchangeRecord;
  onClose: () => void;
  onCreate: (draft: ResourceDraft, persisted: ResourcePersistenceResult) => void;
  onUpdate: (recordId: string, draft: ResourceDraft, persisted: ResourcePersistenceResult) => void;
  onRequest: (recordId: string, request: ResourceRequestDraft, persisted: ResourcePersistenceResult) => void;
  onArchive: (recordId: string, persisted: ResourcePersistenceResult) => void;
}) {
  const [draft, setDraft] = useState<ResourceDraft>(() => draftFromRecord(record));
  const [request, setRequest] = useState<ResourceRequestDraft>({ scope: "", neededBy: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setDraft(draftFromRecord(record)); setRequest({ scope: "", neededBy: "", message: "" }); setError(""); }, [record, workflow.mode]);

  const title = workflow.mode === "offer" ? "Offer a resource" : workflow.mode === "edit" ? "Edit resource" : workflow.mode === "request" ? "Request resource" : "Archive resource";

  async function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const normalized = { ...draft, availabilityLabel: availabilityLabel(draft.availability) };
    try {
      if (workflow.mode === "offer") onCreate(normalized, await execute("offer", undefined, normalized));
      if (workflow.mode === "edit") onUpdate(workflow.recordId, normalized, await execute("edit", workflow.recordId, normalized));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Resources workflow failed."); }
    finally { setBusy(false); }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (workflow.mode !== "request") return; setBusy(true); setError("");
    try { onRequest(workflow.recordId, request, await execute("request", workflow.recordId, undefined, request)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Resource request failed."); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (workflow.mode !== "archive") return; setBusy(true); setError("");
    try { onArchive(workflow.recordId, await execute("archive", workflow.recordId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Resource archive failed."); }
    finally { setBusy(false); }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.workflow} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><p>Resources lens workflow</p><h2>{title}</h2></div><button className={styles.close} type="button" onClick={onClose} aria-label="Close">×</button></header>
      {record ? <div className={styles.contextCard}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
      <div className={styles.detailCallout}><p>Resources actions persist through the authenticated PostgreSQL Resources service. Missing database or actor context fails closed rather than simulating success.</p></div>
      {error ? <div className={styles.detailCallout} role="alert"><p>{error}</p></div> : null}

      {workflow.mode === "offer" || workflow.mode === "edit" ? <form className={styles.form} onSubmit={submitResource}>
        <label>Resource title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <div className={styles.row}><label>Category<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label><label>Availability<select value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value as ResourceAvailabilityState })}><option value="available">Available now</option><option value="limited">Limited</option><option value="scheduled">Scheduled</option></select></label></div>
        <label>Description<textarea required value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
        <div className={styles.row}><label>Capacity<input value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} placeholder="Quantity, seats, hours…" /></label><label>Geography<input required value={draft.geography} onChange={(event) => setDraft({ ...draft, geography: event.target.value })} /></label></div>
        <div className={styles.row}><label>Service area<input value={draft.serviceArea} onChange={(event) => setDraft({ ...draft, serviceArea: event.target.value })} /></label><label>Map visibility<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as ResourceVisibility })}><option value="public-location">Public organization location</option><option value="service-area">Service area only</option><option value="off-map">Do not map</option></select></label></div>
        <label>Terms / notes<textarea value={draft.terms} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} /></label>
        <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : workflow.mode === "offer" ? "Publish offer" : "Save changes"}</button></div>
      </form> : null}

      {workflow.mode === "request" ? <form className={styles.form} onSubmit={submitRequest}>
        <label>Requested scope / amount<input required value={request.scope} onChange={(event) => setRequest({ ...request, scope: event.target.value })} placeholder="What do you need?" /></label>
        <label>Needed by<input type="date" value={request.neededBy} onChange={(event) => setRequest({ ...request, neededBy: event.target.value })} /></label>
        <label>Message<textarea required value={request.message} onChange={(event) => setRequest({ ...request, message: event.target.value })} placeholder="Add project context for the provider." /></label>
        <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Sending…" : "Send request"}</button></div>
      </form> : null}

      {workflow.mode === "archive" && record ? <div><div className={styles.detailCallout}><p>Archiving removes this resource from active Exchange discovery while retaining the record and audit history.</p></div><div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Keep active</button><button className={styles.danger} disabled={busy} type="button" onClick={() => void archive()}>{busy ? "Archiving…" : "Archive resource"}</button></div></div> : null}
    </section>
  </div>;
}
