"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord, ResourceAvailabilityState, ResourceVisibility } from "@/lib/exchange/contracts";
import { isResourceRecord, type ResourceDraft, type ResourceRequestDraft } from "@/lib/exchange/resources";
import type { ReferralPolicySnapshot, ResourceRelationshipKind } from "@/lib/server/exchange/resource-service";
import {
  archiveResourceThroughService,
  createResourceReferralThroughService,
  getResourceReferralPolicy,
  offerResourceThroughService,
  requestResourceThroughService,
  setResourceRelationshipThroughService,
  shareResourceThroughService,
  updateResourceThroughService,
} from "@/lib/exchange/resource-service-client";
import styles from "./resources.module.css";

export type ResourceWorkflow =
  | { mode: "offer" }
  | { mode: "edit"; recordId: string }
  | { mode: "request"; recordId: string }
  | { mode: "share"; recordId: string }
  | { mode: "save-archive"; recordId: string }
  | { mode: "save-follow"; recordId: string }
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
    availability: record.resource.availability,
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
  return "Scheduled access";
}

function workflowTitle(mode: ResourceWorkflow["mode"]) {
  if (mode === "offer") return "Offer Resource";
  if (mode === "edit") return "Manage / Edit Resource";
  if (mode === "request") return "Request Resource";
  if (mode === "share") return "Share / send resource";
  if (mode === "save-archive") return "Save or Archive";
  if (mode === "save-follow") return "Save / follow";
  return "Refer resource";
}

export function ResourceWorkflowSurface({
  workflow,
  record,
  onClose,
  onRecordCommitted,
  onRecordArchived,
  onRelationshipChanged,
  onComplete,
  onOpenReferralsManagement,
}: {
  workflow: ResourceWorkflow;
  record?: ExchangeRecord;
  onClose: () => void;
  onRecordCommitted: (record: ExchangeRecord) => void;
  onRecordArchived: (recordId: string) => void;
  onRelationshipChanged: (recordId: string, kind: ResourceRelationshipKind, active: boolean) => void;
  onComplete: (message: string) => void;
  onOpenReferralsManagement: () => void;
}) {
  const [draft, setDraft] = useState<ResourceDraft>(() => draftFromRecord(record));
  const [request, setRequest] = useState<ResourceRequestDraft>({ scope: "", neededBy: "", message: "" });
  const [recipientOrganization, setRecipientOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [referralPolicy, setReferralPolicy] = useState<ReferralPolicySnapshot>();
  const [referralCreated, setReferralCreated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(draftFromRecord(record));
    setRequest({ scope: "", neededBy: "", message: "" });
    setRecipientOrganization("");
    setMessage("");
    setReferralPolicy(undefined);
    setReferralCreated(false);
    setPending(false);
    setError("");
  }, [record, workflow.mode]);

  const title = workflowTitle(workflow.mode);
  const saved = Boolean(record?.saved);
  const following = Boolean(record?.card?.relationships?.includes("following"));

  async function run(task: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The Resources service could not complete this request.");
    } finally {
      setPending(false);
    }
  }

  function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = { ...draft, availabilityLabel: availabilityLabel(draft.availability) };
    void run(async () => {
      const response = workflow.mode === "offer"
        ? await offerResourceThroughService(normalized)
        : workflow.mode === "edit"
          ? await updateResourceThroughService(workflow.recordId, normalized)
          : undefined;
      if (!response) return;
      onRecordCommitted(response.record);
      onComplete(workflow.mode === "offer" ? "Resource offer published." : "Resource changes saved.");
      onClose();
    });
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (workflow.mode !== "request") return;
    void run(async () => {
      await requestResourceThroughService(workflow.recordId, request);
      onComplete(`Resource request submitted${request.neededBy ? ` · needed ${request.neededBy}` : ""}.`);
      onClose();
    });
  }

  function submitShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (workflow.mode !== "share") return;
    void run(async () => {
      const response = await shareResourceThroughService(workflow.recordId, recipientOrganization, message);
      onComplete(`Resource sent to ${response.share.recipientOrganization}.`);
      onClose();
    });
  }

  function setRelationship(kind: ResourceRelationshipKind, active: boolean) {
    if (!("recordId" in workflow)) return;
    void run(async () => {
      await setResourceRelationshipThroughService(workflow.recordId, kind, active);
      onRelationshipChanged(workflow.recordId, kind, active);
      onComplete(`${kind === "saved" ? "Save" : "Follow"} ${active ? "added" : "removed"}.`);
    });
  }

  function archive() {
    if (workflow.mode !== "save-archive") return;
    void run(async () => {
      await archiveResourceThroughService(workflow.recordId);
      onRecordArchived(workflow.recordId);
      onComplete("Resource archived and removed from active discovery.");
      onClose();
    });
  }

  function reviewReferralPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const response = await getResourceReferralPolicy(recipientOrganization);
      setReferralPolicy(response.policy);
    });
  }

  function createReferral() {
    if (workflow.mode !== "referral" || !referralPolicy) return;
    void run(async () => {
      await createResourceReferralThroughService(workflow.recordId, referralPolicy.recipientOrganizationName, message);
      setReferralCreated(true);
      onComplete("Referral created. Track it in Menu → Referrals Management.");
    });
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.workflow} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><p>Resources lens workflow</p><h2>{title}</h2></div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {record ? <div className={styles.contextCard}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
        {error ? <div className={styles.error} role="alert"><strong>Resources service</strong><span>{error}</span></div> : null}

        {workflow.mode === "offer" || workflow.mode === "edit" ? (
          <form className={styles.form} onSubmit={submitResource}>
            <label>Resource title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <div className={styles.row}>
              <label>Category<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label>Availability
                <select value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value as ResourceAvailabilityState })}>
                  <option value="available">Available now</option>
                  <option value="limited">Limited</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </label>
            </div>
            <label>Description<textarea required value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
            <div className={styles.row}>
              <label>Capacity<input value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} placeholder="Quantity, seats, hours…" /></label>
              <label>Geography<input required value={draft.geography} onChange={(event) => setDraft({ ...draft, geography: event.target.value })} /></label>
            </div>
            <div className={styles.row}>
              <label>Service area<input value={draft.serviceArea} onChange={(event) => setDraft({ ...draft, serviceArea: event.target.value })} /></label>
              <label>Map visibility
                <select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as ResourceVisibility })}>
                  <option value="public-location">Public organization location</option>
                  <option value="service-area">Service area only</option>
                  <option value="off-map">Do not map</option>
                </select>
              </label>
            </div>
            <label>Terms / notes<textarea value={draft.terms} onChange={(event) => setDraft({ ...draft, terms: event.target.value })} /></label>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Saving…" : workflow.mode === "offer" ? "Publish offer" : "Save changes"}</button>
            </div>
          </form>
        ) : null}

        {workflow.mode === "request" ? (
          <form className={styles.form} onSubmit={submitRequest}>
            <label>Requested scope / amount<input required value={request.scope} onChange={(event) => setRequest({ ...request, scope: event.target.value })} placeholder="What do you need?" /></label>
            <label>Needed by<input type="date" value={request.neededBy} onChange={(event) => setRequest({ ...request, neededBy: event.target.value })} /></label>
            <label>Message<textarea required value={request.message} onChange={(event) => setRequest({ ...request, message: event.target.value })} placeholder="Add project context for the provider." /></label>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
            </div>
          </form>
        ) : null}

        {workflow.mode === "share" ? (
          <form className={styles.form} onSubmit={submitShare}>
            <label>Receiving organization<input required value={recipientOrganization} onChange={(event) => setRecipientOrganization(event.target.value)} placeholder="Organization name" /></label>
            <label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional context for the receiving organization." /></label>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Sending…" : "Send resource"}</button>
            </div>
          </form>
        ) : null}

        {workflow.mode === "save-archive" && record ? (
          <div className={styles.choiceStack}>
            <div className={styles.choiceCard}>
              <strong>Save</strong><p>Keep this Resource in your Saved collection.</p>
              <button className={styles.secondary} type="button" disabled={pending} onClick={() => setRelationship("saved", !saved)}>{saved ? "Remove from saved" : "Save resource"}</button>
            </div>
            <div className={styles.choiceCard}>
              <strong>Archive</strong><p>Remove this owned Resource from active Exchange discovery while retaining its history.</p>
              <button className={styles.danger} type="button" disabled={pending} onClick={archive}>Archive resource</button>
            </div>
          </div>
        ) : null}

        {workflow.mode === "save-follow" && record ? (
          <div className={styles.choiceStack}>
            <div className={styles.choiceCard}>
              <strong>Save</strong><p>Keep the Resource in your Saved collection.</p>
              <button className={styles.secondary} type="button" disabled={pending} onClick={() => setRelationship("saved", !saved)}>{saved ? "Remove from saved" : "Save resource"}</button>
            </div>
            <div className={styles.choiceCard}>
              <strong>Follow</strong><p>Keep a durable follow relationship with this Resource.</p>
              <button className={styles.secondary} type="button" disabled={pending} onClick={() => setRelationship("following", !following)}>{following ? "Stop following" : "Follow resource"}</button>
            </div>
          </div>
        ) : null}

        {workflow.mode === "referral" && !referralPolicy && !referralCreated ? (
          <form className={styles.form} onSubmit={reviewReferralPolicy}>
            <label>Receiving organization<input required value={recipientOrganization} onChange={(event) => setRecipientOrganization(event.target.value)} placeholder="Organization name" /></label>
            <label>Referral note<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add context for the recipient." /></label>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" onClick={onClose} disabled={pending}>Cancel</button>
              <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Checking…" : "Review recipient policy / fee"}</button>
            </div>
          </form>
        ) : null}

        {workflow.mode === "referral" && referralPolicy && !referralCreated ? (
          <div className={styles.choiceStack}>
            <div className={styles.policyCard}>
              <span>Receiving organization</span><strong>{referralPolicy.recipientOrganizationName}</strong>
              <span>Referral policy</span><p>{referralPolicy.policySummary ?? "No active referral policy is published."}</p>
              <span>Referral fee</span><p>{referralPolicy.feeSummary ?? "No referral fee is published."}</p>
            </div>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" disabled={pending} onClick={() => setReferralPolicy(undefined)}>Back</button>
              <button className={styles.primary} type="button" disabled={pending} onClick={createReferral}>{pending ? "Creating…" : "Create referral"}</button>
            </div>
          </div>
        ) : null}

        {workflow.mode === "referral" && referralCreated ? (
          <div className={styles.choiceStack}>
            <div className={styles.successCard}><strong>Referral created</strong><p>The referral is now tracked through the shared cross-lens referral service.</p></div>
            <button className={styles.primary} type="button" onClick={onOpenReferralsManagement}>Open Menu → Referrals Management</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
