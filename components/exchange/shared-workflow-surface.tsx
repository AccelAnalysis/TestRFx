"use client";

import { useState, type FormEvent } from "react";
import { sharedWorkflowDefinitions, type SharedWorkflowLaunch } from "@/lib/exchange/shared-workflows";
import styles from "./shared-workflow-surface.module.css";

export interface SharedWorkflowCompletion {
  executionId: string;
  eventName: string;
  workflow: string;
  recordId: string;
  result: Record<string, unknown>;
}

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "RFxchange workflow service rejected the request.");
  return body;
}

export function SharedWorkflowSurface({ launch, onClose, onComplete }: {
  launch: SharedWorkflowLaunch;
  onClose: () => void;
  onComplete: (execution: SharedWorkflowCompletion) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<Record<string, unknown> | null | undefined>();
  const [matches, setMatches] = useState<Array<{ public_id: string; title: string; score: number }>>([]);
  const [shareLink, setShareLink] = useState("");
  const definition = sharedWorkflowDefinitions[launch.workflow];

  async function execute(payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const body = await parseResponse(await fetch("/api/exchange/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionId: launch.workflow, lens: launch.lens, recordId: launch.record.id, source: launch.source, payload }),
      }));
      const execution = body.execution as SharedWorkflowCompletion;
      const result = execution.result ?? {};
      if (launch.workflow === "match") setMatches((result.matches as Array<{ public_id: string; title: string; score: number }> | undefined) ?? []);
      if (launch.workflow === "share") setShareLink(typeof result.deepLink === "string" ? result.deepLink : "");
      onComplete(execution);
      if (launch.workflow !== "match" && launch.workflow !== "share") onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RFxchange workflow service failed.");
    } finally { setBusy(false); }
  }

  async function reviewReferralPolicy() {
    if (!recipient.trim()) return;
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ recipientOrganization: recipient.trim() });
      const body = await parseResponse(await fetch(`/api/exchange/workflows?${params}`));
      setPolicy(body.recipientPolicy ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load recipient referral policy / fee.");
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launch.workflow === "refer" && (!recipient.trim() || policy === undefined)) return;
    void execute({ recipientOrganization: recipient.trim() || undefined, note: note.trim() || undefined });
  }

  const relationshipWorkflow = definition.category === "relationship";
  const collaborationWorkflow = launch.workflow === "team" || launch.workflow === "connect";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={`${definition.label} workflow`}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>Shared Exchange service</p><h2>{definition.label}</h2></div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close workflow">×</button>
        </header>

        <div className={styles.record}><strong>{launch.record.title}</strong><span>{launch.record.organization} · {launch.record.geography}</span></div>
        <p>{definition.description}</p>
        <div className={styles.notice}><strong>Server-authoritative execution.</strong> This surface writes through the RFxchange workflow API and PostgreSQL repository. If persistence or authenticated actor context is not configured, it fails closed instead of simulating success.</div>
        {error ? <div className={styles.notice} role="alert"><strong>Workflow unavailable:</strong> {error}</div> : null}

        {relationshipWorkflow ? (
          <div className={styles.stack}>
            <p className={styles.muted}>The service toggles this relationship in the canonical cross-lens relationship repository and emits an activity event.</p>
            <div className={styles.actions}><button className={styles.primary} disabled={busy} type="button" onClick={() => void execute()}>{busy ? "Saving…" : `${definition.label} record`}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}

        {launch.workflow === "share" ? (
          <div className={styles.stack}>
            {shareLink ? <label className={styles.field}>Permission-aware deep link<input readOnly value={shareLink} /></label> : <p className={styles.muted}>Create a durable share-link record. The returned token is shown only after the server accepts the request.</p>}
            <div className={styles.actions}>
              {shareLink ? <button className={styles.secondary} type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${shareLink}`)}>Copy link</button> : null}
              <button className={styles.primary} disabled={busy} type="button" onClick={() => void execute()}>{busy ? "Creating…" : shareLink ? "Create another link" : "Create share link"}</button>
              <button className={styles.secondary} type="button" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : null}

        {launch.workflow === "refer" || collaborationWorkflow ? (
          <form className={styles.form} onSubmit={submit}>
            {launch.workflow === "refer" ? (
              <>
                <label className={styles.field}>Receiving organization<input value={recipient} onChange={(event) => { setRecipient(event.target.value); setPolicy(undefined); }} placeholder="Organization name" required /></label>
                <button className={styles.secondary} disabled={busy || !recipient.trim()} type="button" onClick={() => void reviewReferralPolicy()}>Review recipient referral policy / fee</button>
                {policy !== undefined ? <div className={styles.notice}>{policy ? <><strong>{String(policy.organization ?? recipient)}</strong><div>Policy: {policy.policy ? JSON.stringify(policy.policy) : "No policy configured"}</div><div>Fee: {policy.fee ? JSON.stringify(policy.fee) : "No fee configured"}</div></> : "No recipient policy / fee record is configured."}</div> : null}
              </>
            ) : null}
            <label className={styles.field}>{launch.workflow === "refer" ? "Referral note" : "Message"}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context for the recipient." /></label>
            <div className={styles.actions}><button className={styles.primary} disabled={busy || (launch.workflow === "refer" && policy === undefined)} type="submit">{busy ? "Submitting…" : launch.workflow === "refer" ? "Create referral" : launch.workflow === "team" ? "Request teaming" : "Request connection"}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </form>
        ) : null}

        {launch.workflow === "match" ? (
          <div className={styles.stack}>
            <p className={styles.muted}>Matching runs against canonical Exchange search documents and persists match decisions for provenance.</p>
            <div className={styles.actions}><button className={styles.primary} disabled={busy} type="button" onClick={() => void execute()}>{busy ? "Matching…" : "Run match"}</button><button className={styles.secondary} type="button" onClick={onClose}>Done</button></div>
            {matches.length ? <div className={styles.matchGrid}>{matches.map((match) => <article className={styles.item} key={match.public_id}><strong>{match.title}</strong><small>{match.public_id} · score {Number(match.score).toFixed(3)}</small></article>)}</div> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
