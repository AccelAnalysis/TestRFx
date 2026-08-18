"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import {
  getReferenceMatches,
  sharedWorkflowDefinitions,
  type SharedWorkflowEvent,
  type SharedWorkflowLaunch,
} from "@/lib/exchange/shared-workflows";
import styles from "./shared-workflow-surface.module.css";

const referenceMode = process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE === "1";

type RecipientPolicy = {
  organizationId: string;
  organizationName: string;
  configured: boolean;
  policy: Record<string, unknown>;
  fee: Record<string, unknown>;
  publishedAt?: string;
};

function primitiveEntries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean");
}

export function SharedWorkflowSurface({ launch, records, active = false, onClose, onComplete }: {
  launch: SharedWorkflowLaunch;
  records: ExchangeRecord[];
  active?: boolean;
  onClose: () => void;
  onComplete: (event: SharedWorkflowEvent) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [recipientPolicy, setRecipientPolicy] = useState<RecipientPolicy>();
  const [policyReviewed, setPolicyReviewed] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [error, setError] = useState("");
  const definition = sharedWorkflowDefinitions[launch.workflow];
  const matches = useMemo(() => referenceMode && launch.workflow === "match" ? getReferenceMatches(launch.record, records) : [], [launch, records]);
  const deepLink = `/exchange/${launch.lens}/${launch.record.id}`;

  async function complete(payload: Record<string, unknown> = {}) {
    if (referenceMode) {
      setError("The static preview does not simulate durable shared-workflow writes. Run the server-capable app with PostgreSQL and the identity gateway to complete this action.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/exchange/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionId: launch.workflow, lens: launch.lens, recordId: launch.record.id, source: launch.source, payload }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; event?: SharedWorkflowEvent };
      if (!response.ok || !body.event) throw new Error(body.error ?? "Shared workflow failed.");
      onComplete(body.event);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Shared workflow failed.");
    } finally { setBusy(false); }
  }

  async function reviewRecipientPolicy() {
    if (!recipient.trim()) { setError("Enter the receiving organization before reviewing its referral policy."); return; }
    if (referenceMode) { setError("The static preview does not invent recipient policy or fee data."); return; }
    setPolicyBusy(true); setError(""); setPolicyReviewed(false); setRecipientPolicy(undefined);
    try {
      const response = await fetch(`/api/exchange/referrals/policy?organization=${encodeURIComponent(recipient.trim())}`, { headers: { accept: "application/json" } });
      const body = await response.json().catch(() => ({})) as { error?: string; policy?: RecipientPolicy };
      if (!response.ok || !body.policy) throw new Error(body.error ?? "Recipient policy could not be loaded.");
      setRecipientPolicy(body.policy);
      setPolicyReviewed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recipient policy could not be loaded.");
    } finally { setPolicyBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launch.workflow === "refer" && (!recipient.trim() || !policyReviewed)) return;
    void complete({ recipientOrganization: recipient.trim() || undefined, note: note.trim() || undefined, recipientPolicyReviewed: policyReviewed, recipientPolicyPublishedAt: recipientPolicy?.publishedAt });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${deepLink}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const relationshipWorkflow = definition.category === "relationship";
  const collaborationWorkflow = launch.workflow === "team" || launch.workflow === "connect";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={`${definition.label} workflow`}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>Shared Exchange workflow</p><h2>{definition.label}</h2></div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close workflow">×</button>
        </header>

        <div className={styles.record}><strong>{launch.record.title}</strong><span>{launch.record.organization} · {launch.record.geography}</span></div>
        <p>{definition.description}</p>
        {referenceMode ? <div className={styles.notice}><strong>Static preview:</strong> workflow navigation is visible, but persistence is intentionally not mocked.</div> : null}
        {error ? <div className={styles.notice} role="alert">{error}</div> : null}

        {relationshipWorkflow ? (
          <div className={styles.stack}>
            <p className={styles.muted}>This relationship is persisted by the shared Exchange relationship service and reused by Saved &amp; Watchlist management.</p>
            <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || referenceMode} onClick={() => void complete({ relationshipKind: definition.relationshipKind, active: !active })}>{active ? `Remove ${definition.label}` : definition.label}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}

        {launch.workflow === "share" ? (
          <div className={styles.stack}>
            <label className={styles.field}>Deep link<input readOnly value={deepLink} /></label>
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button><button className={styles.primary} type="button" disabled={busy || referenceMode} onClick={() => void complete({ deepLink })}>Record share</button></div>
          </div>
        ) : null}

        {launch.workflow === "refer" || collaborationWorkflow ? (
          <form className={styles.form} onSubmit={submit}>
            {launch.workflow === "refer" ? <>
              <label className={styles.field}>Receiving organization<input value={recipient} onChange={(event) => { setRecipient(event.target.value); setRecipientPolicy(undefined); setPolicyReviewed(false); }} placeholder="Organization name" required /></label>
              <button className={styles.secondary} type="button" disabled={policyBusy || referenceMode || !recipient.trim()} onClick={() => void reviewRecipientPolicy()}>{policyBusy ? "Loading policy…" : "Review recipient referral policy / fee"}</button>
              {recipientPolicy ? <div className={styles.item} role="status">
                <strong>{recipientPolicy.organizationName}</strong>
                {recipientPolicy.configured ? <>
                  <small>Published recipient policy</small>
                  {primitiveEntries(recipientPolicy.policy).map(([key, value]) => <small key={`policy-${key}`}>{key}: {String(value)}</small>)}
                  {primitiveEntries(recipientPolicy.fee).map(([key, value]) => <small key={`fee-${key}`}>fee {key}: {String(value)}</small>)}
                </> : <small>No published referral policy or fee is configured. RFxchange does not synthesize one.</small>}
              </div> : null}
            </> : null}
            <label className={styles.field}>{launch.workflow === "refer" ? "Referral note" : "Message"}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context for the recipient." /></label>
            <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy || referenceMode || (launch.workflow === "refer" && !policyReviewed)}>{busy ? "Working…" : launch.workflow === "refer" ? "Create referral" : launch.workflow === "team" ? "Request teaming" : "Request connection"}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </form>
        ) : null}

        {launch.workflow === "match" ? (
          <div className={styles.stack}>
            {referenceMode ? <div className={styles.matchGrid}>{matches.length ? matches.map((match) => <article className={styles.item} key={match.record.id}><strong>{match.record.title}</strong><small>{match.record.organization} · reference score {match.score}</small><div className={styles.badges}>{match.reasons.map((reason) => <span className={styles.badge} key={reason}>{reason}</span>)}</div></article>) : <div className={styles.empty}>No reference matches are available.</div>}</div> : <div className={styles.notice}>Production matching must be supplied by the AMACS-backed matching service; deterministic reference scoring is not used as production match truth.</div>}
            <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || referenceMode} onClick={() => void complete({ matchRecordIds: matches.map((match) => match.record.id) })}>Record match request</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
