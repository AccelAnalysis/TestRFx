"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ExchangeRecord, ResourceAvailabilityState, ResourceVisibility } from "@/lib/exchange/contracts";
import { isResourceRecord, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import { getReferralPolicy, searchExchangeOrganizations } from "@/lib/exchange/resource-service-client";
import styles from "./resources.module.css";

export type ResourceWorkflow =
  | { mode: "offer" }
  | { mode: "edit"; recordId: string }
  | { mode: "request"; recordId: string }
  | { mode: "archive"; recordId: string }
  | { mode: "share"; recordId: string }
  | { mode: "save-follow"; recordId: string }
  | { mode: "save-archive"; recordId: string }
  | { mode: "referral"; recordId: string };

const emptyDraft: ResourceDraft = {
  title: "",
  category: "Professional Services",
  summary: "",
  geography: "Isle of Wight, VA",
  availability: "available",
  availabilityLabel: "Available now",
  capacity: "",
  serviceArea: "Isle of Wight County",
  visibility: "public-location",
  terms: "",
};

function draftFromRecord(record?: ExchangeRecord): ResourceDraft {
  if (!record || !isResourceRecord(record)) return emptyDraft;
  return {
    title: record.title,
    category: record.resource.category,
    summary: record.summary,
    geography: record.geography,
    availability: record.resource.availability === "unknown" ? "available" : record.resource.availability,
    availabilityLabel: record.resource.availabilityLabel,
    capacity: record.resource.capacity ?? "",
    serviceArea: record.resource.serviceArea ?? "",
    visibility: record.resource.visibility,
    terms: record.resource.terms ?? "",
  };
}

function availabilityLabel(value: ResourceAvailabilityState) {
  if (value === "available") return "Available now";
  if (value === "limited") return "Limited availability";
  if (value === "scheduled") return "Scheduled access";
  return "Availability not published";
}

export function ResourceWorkflowSurface({ workflow, record, onClose, onCreate, onUpdate, onRequest, onArchive, onRelationship, onShare, onRefer }: {
  workflow: ResourceWorkflow;
  record?: ExchangeRecord;
  onClose: () => void;
  onCreate: (draft: ResourceDraft) => void | Promise<void>;
  onUpdate: (recordId: string, draft: ResourceDraft) => void | Promise<void>;
  onRequest: (recordId: string, request: ResourceRequestDraft) => void | Promise<void>;
  onArchive: (recordId: string) => void | Promise<void>;
  onRelationship: (recordId: string, kind: "saved" | "following", active: boolean) => void | Promise<void>;
  onShare: (recordId: string, recipientOrganizationId: string, message: string) => void | Promise<void>;
  onRefer: (recordId: string, recipientOrganizationId: string, note: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<ResourceDraft>(() => draftFromRecord(record));
  const [request, setRequest] = useState<ResourceRequestDraft>({ scope: "", neededBy: "", message: "" });
  const [recipientQuery, setRecipientQuery] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [recipient, setRecipient] = useState<{ id: string; name: string }>();
  const [message, setMessage] = useState("");
  const [policy, setPolicy] = useState<{ published: boolean; active: boolean; policySummary: string | null; feeSummary: string | null }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(draftFromRecord(record));
    setRequest({ scope: "", neededBy: "", message: "" });
    setRecipientQuery("");
    setOrganizations([]);
    setRecipient(undefined);
    setMessage("");
    setPolicy(undefined);
    setError("");
  }, [record, workflow.mode]);

  useEffect(() => {
    if (workflow.mode !== "share" && workflow.mode !== "referral") return;
    if (recipient || recipientQuery.trim().length < 2) { setOrganizations([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchExchangeOrganizations(recipientQuery.trim())
        .then((result) => { if (active) setOrganizations(result.organizations); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Organization search failed."); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [recipientQuery, recipient, workflow.mode]);

  useEffect(() => {
    if (workflow.mode !== "referral" || !recipient) { setPolicy(undefined); return; }
    let active = true;
    void getReferralPolicy(recipient.id)
      .then((result) => { if (active) setPolicy(result.policy); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Referral policy could not be loaded."); });
    return () => { active = false; };
  }, [recipient, workflow.mode]);

  const title = workflow.mode === "offer" ? "Offer a resource"
    : workflow.mode === "edit" ? "Edit resource"
      : workflow.mode === "request" ? "Request resource"
        : workflow.mode === "archive" ? "Archive resource"
          : workflow.mode === "share" ? "Send resource"
            : workflow.mode === "save-follow" ? "Save or follow"
              : workflow.mode === "save-archive" ? "Save or archive"
                : "Refer resource";

  const relationships = useMemo(() => new Set(record?.card?.relationships ?? []), [record]);
  const saved = Boolean(record?.saved || relationships.has("saved"));
  const following = relationships.has("following");

  async function run(action: () => void | Promise<void>) {
    setPending(true); setError("");
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The Resource action could not be completed."); }
    finally { setPending(false); }
  }

  function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = { ...draft, availabilityLabel: availabilityLabel(draft.availability) };
    void run(async () => {
      if (workflow.mode === "offer") await onCreate(normalized);
      if (workflow.mode === "edit") await onUpdate(workflow.recordId, normalized);
    });
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (workflow.mode === "request") void run(() => onRequest(workflow.recordId, request));
  }

  function chooseRecipient(next: { id: string; name: string }) {
    setRecipient(next); setRecipientQuery(next.name); setOrganizations([]); setError("");
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <section className={styles.workflow} role="dialog" aria-modal="true" aria-label={title}>
        <header><div><p>Resources lens workflow</p><h2>{title}</h2></div><button className={styles.close} type="button" onClick={onClose} aria-label="Close" disabled={pending}>×</button></header>
        {record ? <div className={styles.contextCard}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}

        {workflow.mode === "offer" || workflow.mode === "edit" ? <form className={styles.form} onSubmit={submitResource}>
          <label>Resource title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <div className={styles.row}><label>Category<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label><label>Availability<select value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value as ResourceAvailabilityState })}><option value="available">Available now</option><option value="limited">Limited</option><option value="scheduled">Scheduled</option></select></label></div>
          <label>Description<textarea required value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
          <div className={styles.row}><label>Capacity<input value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} placeholder="Quantity, seats, hours…" /></label><label>Geography<input required value={draft.geography} onChange={(event) => setDraft({ ...draft, geography: event.target.value })} /></label></div>
          <div className={styles.row}><label>Service area<input value={draft.serviceArea} onChange={(event) => setDraft({ ...draft, serviceArea: event.target.value })} /></label><label>Map visibility<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as ResourceVisibility })}><option value="public-location">Public organization location</option><option value="service-area">Service area only</option><option value="off-map">Do not map</option></select></label></div>
          <label>Terms / notes<textarea value={draft.terms} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} /></label>
          <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button><button className={styles.primary} type="submit" disabled={pending}>{pending ? "Saving…" : workflow.mode === "offer" ? "Publish offer" : "Save changes"}</button></div>
        </form> : null}

        {workflow.mode === "request" ? <form className={styles.form} onSubmit={submitRequest}>
          <label>Requested scope / amount<input required value={request.scope} onChange={(event) => setRequest({ ...request, scope: event.target.value })} placeholder="What do you need?" /></label>
          <label>Needed by<input type="date" value={request.neededBy} onChange={(event) => setRequest({ ...request, neededBy: event.target.value })} /></label>
          <label>Message<textarea required value={request.message} onChange={(event) => setRequest({ ...request, message: event.target.value })} placeholder="Add project context for the provider." /></label>
          <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button><button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</button></div>
        </form> : null}

        {workflow.mode === "archive" && record ? <div><div className={styles.detailCallout}><p>Archiving removes this resource from active Exchange discovery while retaining the record for audit history.</p></div><div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Keep active</button><button className={styles.danger} type="button" disabled={pending} onClick={() => void run(() => onArchive(workflow.recordId))}>{pending ? "Archiving…" : "Archive resource"}</button></div></div> : null}

        {(workflow.mode === "share" || workflow.mode === "referral") ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (!recipient) { setError("Choose a receiving organization."); return; } void run(() => workflow.mode === "share" ? onShare(workflow.recordId, recipient.id, message) : onRefer(workflow.recordId, recipient.id, message)); }}>
          <label>Receiving organization<input value={recipientQuery} onChange={(event) => { setRecipient(undefined); setRecipientQuery(event.target.value); }} placeholder="Start typing an organization name…" autoComplete="off" /></label>
          {organizations.length ? <div className={styles.organizationOptions}>{organizations.map((organization) => <button type="button" key={organization.id} onClick={() => chooseRecipient(organization)}><strong>{organization.name}</strong><span>Select</span></button>)}</div> : null}
          {workflow.mode === "referral" && recipient ? <div className={styles.policyCard}><strong>Recipient referral policy</strong>{!policy ? <p>Loading published policy…</p> : policy.published ? <><p>{policy.policySummary || "No additional policy text published."}</p><dl><div><dt>Status</dt><dd>{policy.active ? "Accepting referrals" : "Not accepting referrals"}</dd></div><div><dt>Fee / payout</dt><dd>{policy.feeSummary || "No published fee terms"}</dd></div></dl></> : <p>No referral policy or fee has been published. RFxchange will not invent one.</p>}</div> : null}
          <label>{workflow.mode === "share" ? "Message (optional)" : "Referral note (optional)"}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={workflow.mode === "share" ? "Why are you sending this resource?" : "Add context for the referral."} /></label>
          <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button><button className={styles.primary} type="submit" disabled={pending || !recipient || (workflow.mode === "referral" && policy?.published === true && !policy.active)}>{pending ? "Sending…" : workflow.mode === "share" ? "Send resource" : "Create referral"}</button></div>
        </form> : null}

        {workflow.mode === "save-follow" && record ? <div className={styles.relationshipGrid}><button className={saved ? styles.relationshipActive : styles.relationshipButton} type="button" disabled={pending} onClick={() => void run(() => onRelationship(workflow.recordId, "saved", !saved))}><strong>{saved ? "Saved" : "Save"}</strong><span>{saved ? "Remove from Saved" : "Keep this Resource in Saved"}</span></button><button className={following ? styles.relationshipActive : styles.relationshipButton} type="button" disabled={pending} onClick={() => void run(() => onRelationship(workflow.recordId, "following", !following))}><strong>{following ? "Following" : "Follow"}</strong><span>{following ? "Stop following" : "Follow provider/resource updates"}</span></button></div> : null}

        {workflow.mode === "save-archive" && record ? <div className={styles.relationshipGrid}><button className={saved ? styles.relationshipActive : styles.relationshipButton} type="button" disabled={pending} onClick={() => void run(() => onRelationship(workflow.recordId, "saved", !saved))}><strong>{saved ? "Saved" : "Save"}</strong><span>{saved ? "Remove from Saved" : "Save this Resource"}</span></button><button className={styles.relationshipDanger} type="button" disabled={pending} onClick={() => void run(() => onArchive(workflow.recordId))}><strong>Archive</strong><span>Remove from active Exchange discovery</span></button></div> : null}

        {error ? <p className={styles.workflowError} role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
