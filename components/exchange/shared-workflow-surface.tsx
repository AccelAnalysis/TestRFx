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

export function SharedWorkflowSurface({ launch, records, active = false, onClose, onComplete }: {
  launch: SharedWorkflowLaunch;
  records: ExchangeRecord[];
  active?: boolean;
  onClose: () => void;
  onComplete: (event: SharedWorkflowEvent) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launch.workflow === "refer" && !recipient.trim()) return;
    void complete({ recipientOrganization: recipient.trim() || undefined, note: note.trim() || undefined });
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
            {launch.workflow === "refer" ? <label className={styles.field}>Receiving organization<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Organization name" required /></label> : null}
            <label className={styles.field}>{launch.workflow === "refer" ? "Referral note" : "Message"}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context for the recipient." /></label>
            <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy || referenceMode}>{busy ? "Working…" : launch.workflow === "refer" ? "Create referral" : launch.workflow === "team" ? "Request teaming" : "Request connection"}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </form>
        ) : null}

        {launch.workflow === "match" ? (
          <div className={styles.stack}>
            {referenceMode ? <div className={styles.matchGrid}>{matches.length ? matches.map((match) => <article className={styles.item} key={match.record.id}><strong>{match.record.title}</strong><small>{match.record.organization} · reference score {match.score}</small><div className={styles.badges}>{match.reasons.map((reason) => <span className={styles.badge} key={reason}>{reason}</span>)}</div></article>) : <div className={styles.empty}>No reference matches are available.</div>}</div> : <div className={styles.notice}>Production matching must be supplied by the AMACS-backed matching service; deterministic reference scoring is not used as production match truth.</div>}
            <div className={styles.actions}><button className={styles.primary} type="button" disabled={!referenceMode || busy} onClick={() => void complete({ matchRecordIds: matches.map((match) => match.record.id) })}>Record match request</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
