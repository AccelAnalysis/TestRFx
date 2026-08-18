"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import {
  buildReferenceWorkflowEvent,
  getReferenceMatches,
  sharedWorkflowDefinitions,
  type SharedWorkflowEvent,
  type SharedWorkflowLaunch,
} from "@/lib/exchange/shared-workflows";
import styles from "./shared-workflow-surface.module.css";

export function SharedWorkflowSurface({ launch, records, onClose, onComplete }: {
  launch: SharedWorkflowLaunch;
  records: ExchangeRecord[];
  onClose: () => void;
  onComplete: (event: SharedWorkflowEvent) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const definition = sharedWorkflowDefinitions[launch.workflow];
  const matches = useMemo(() => launch.workflow === "match" ? getReferenceMatches(launch.record, records) : [], [launch, records]);
  const deepLink = `/exchange/${launch.lens}/${launch.record.id}`;

  function complete(payload: Record<string, unknown> = {}) {
    onComplete(buildReferenceWorkflowEvent(launch, payload));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launch.workflow === "refer" && !recipient.trim()) return;
    complete({ recipientOrganization: recipient.trim() || undefined, note: note.trim() || undefined });
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

        <div className={styles.record}>
          <strong>{launch.record.title}</strong>
          <span>{launch.record.organization} · {launch.record.geography}</span>
        </div>

        <p>{definition.description}</p>
        <div className={styles.notice}><strong>Reference boundary:</strong> this chassis proves shared workflow dispatch and state continuity. Production durability belongs behind the {definition.productionAdapter}.</div>

        {relationshipWorkflow ? (
          <div className={styles.stack}>
            <p className={styles.muted}>The relationship is stored in mounted Exchange state for this reference session and emitted as one normalized workflow event.</p>
            <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => complete({ relationshipKind: definition.relationshipKind })}>{definition.label} record</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}

        {launch.workflow === "share" ? (
          <div className={styles.stack}>
            <label className={styles.field}>Deep link<input readOnly value={deepLink} /></label>
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button><button className={styles.primary} type="button" onClick={() => complete({ deepLink })}>Record share</button></div>
          </div>
        ) : null}

        {launch.workflow === "refer" || collaborationWorkflow ? (
          <form className={styles.form} onSubmit={submit}>
            {launch.workflow === "refer" ? <label className={styles.field}>Receiving organization<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Organization name" required /></label> : null}
            <label className={styles.field}>{launch.workflow === "refer" ? "Referral note" : "Message"}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context for the recipient." /></label>
            <div className={styles.actions}><button className={styles.primary} type="submit">{launch.workflow === "refer" ? "Create referral" : launch.workflow === "team" ? "Request teaming" : "Request connection"}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </form>
        ) : null}

        {launch.workflow === "match" ? (
          <div className={styles.stack}>
            <div className={styles.matchGrid}>
              {matches.length ? matches.map((match) => (
                <article className={styles.item} key={match.record.id}>
                  <strong>{match.record.title}</strong>
                  <small>{match.record.organization} · score {match.score}</small>
                  <div className={styles.badges}>{match.reasons.map((reason) => <span className={styles.badge} key={reason}>{reason}</span>)}</div>
                </article>
              )) : <div className={styles.empty}>No reference matches are available for this record.</div>}
            </div>
            <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => complete({ matchRecordIds: matches.map((match) => match.record.id) })}>Record match request</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
