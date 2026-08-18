"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { RfxWorkflowCommand } from "@/lib/exchange/drawer-workflows";
import styles from "./shared-workflow-surface.module.css";

type Result = { recordId: string; command: RfxWorkflowCommand; status: string; message: string; data?: Record<string, unknown> };
const referenceMode = process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE === "1";

export function RfxWorkflowSurface({ command, record, onClose, onComplete }: {
  command: RfxWorkflowCommand;
  record?: ExchangeRecord;
  onClose: () => void;
  onComplete: (result: Result) => void;
}) {
  const [title, setTitle] = useState(record?.title ?? "");
  const [summary, setSummary] = useState(record?.summary ?? "");
  const [rfxType, setRfxType] = useState("RFP");
  const [geography, setGeography] = useState(record?.geography ?? "");
  const [dueAt, setDueAt] = useState("");
  const [response, setResponse] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [collaborator, setCollaborator] = useState("");
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState<"evaluation" | "selected">("evaluation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedResult, setLoadedResult] = useState<Result>();

  const creation = command === "create" || command === "draft" || (!record && (command === "save" || command === "publish"));
  const editing = command === "manage" || command === "update" || (command === "save" && Boolean(record));

  async function callService(targetCommand: RfxWorkflowCommand, targetRecordId: string | undefined, payload: Record<string, unknown>) {
    const responseResult = await fetch("/api/exchange/rfx/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: targetCommand, recordId: targetRecordId, payload }),
    });
    const body = await responseResult.json().catch(() => ({})) as { error?: string; result?: Result };
    if (!responseResult.ok || !body.result) throw new Error(body.error ?? "RFx workflow failed.");
    return body.result;
  }

  async function execute(event?: FormEvent) {
    event?.preventDefault();
    if (referenceMode) { setError("The static GitHub Pages preview does not simulate RFx writes. Run the server-capable app with PostgreSQL and authenticated identity headers to execute this workflow."); return; }
    setBusy(true); setError("");
    try {
      const payload = { title, summary, rfxType, performanceGeography: geography, dueAt: dueAt || undefined, response, externalSubmissionReference: externalReference || undefined, collaboratorOrganization: collaborator, message, nextStatus };
      let result: Result;
      if (!record && (command === "save" || command === "publish")) {
        const created = await callService("create", undefined, payload);
        result = command === "publish" ? await callService("publish", created.recordId, payload) : created;
      } else {
        result = await callService(command, record?.id, payload);
      }
      setLoadedResult(result);
      if (command !== "responses") onComplete(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "RFx workflow failed.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (command === "responses" && !referenceMode) void execute();
    // command/record define a fresh mounted workflow instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, record?.id]);

  const titleCopy = command === "create" || command === "draft" ? "Create RFx / Opportunity"
    : command === "publish" ? "Publish RFx"
      : command === "invite" ? "Invite Team / Collaborators"
        : command === "responses" ? "Responses / Matches"
          : command === "respond" || command === "submit" ? "Respond / Submit"
            : command === "close" ? "Close RFx"
              : command === "award-advance" ? "Award / Advance"
                : "Manage RFx";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={titleCopy}>
        <header className={styles.header}><div><p className={styles.eyebrow}>RFx workflow</p><h2>{titleCopy}</h2></div><button className={styles.close} type="button" onClick={onClose} aria-label="Close workflow">×</button></header>
        {record ? <div className={styles.record}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
        {referenceMode ? <div className={styles.notice}><strong>Static preview:</strong> navigation remains inspectable, but RFx mutations are intentionally not mocked.</div> : null}

        {command === "responses" ? (
          <div className={styles.stack}>
            {busy ? <p className={styles.muted}>Loading responses…</p> : null}
            {Array.isArray(loadedResult?.data?.responses) ? (loadedResult!.data!.responses as Array<Record<string, unknown>>).map((item, index) => (
              <article className={styles.item} key={String(item.id ?? index)}><strong>{String(item.organization ?? "Responding organization")}</strong><small>{String(item.status ?? "status unavailable")}</small></article>
            )) : !busy ? <div className={styles.empty}>No responses are available.</div> : null}
          </div>
        ) : (
          <form className={styles.form} onSubmit={execute}>
            {creation ? <>
              <label className={styles.field}>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
              <label className={styles.field}>Summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} required /></label>
              <label className={styles.field}>RFx type<select value={rfxType} onChange={(event) => setRfxType(event.target.value)}><option>RFI</option><option>RFQ</option><option>RFP</option><option>Sources Sought</option><option>Supplier Request</option><option>Service Request</option></select></label>
              <label className={styles.field}>Performance geography<input value={geography} onChange={(event) => setGeography(event.target.value)} /></label>
              <label className={styles.field}>Due date / time<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            </> : null}
            {editing ? <><label className={styles.field}>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className={styles.field}>Summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label></> : null}
            {command === "invite" ? <><label className={styles.field}>Collaborator organization<input value={collaborator} onChange={(event) => setCollaborator(event.target.value)} required /></label><label className={styles.field}>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label></> : null}
            {command === "respond" || command === "submit" ? <><label className={styles.field}>Response<textarea value={response} onChange={(event) => setResponse(event.target.value)} required /></label><label className={styles.field}>External submission reference, when required<input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} /></label></> : null}
            {command === "award-advance" ? <label className={styles.field}>Advance status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as "evaluation" | "selected")}><option value="evaluation">Evaluation</option><option value="selected">Selected</option></select></label> : null}
            {command === "close" ? <div className={styles.notice}>This updates the RFx lifecycle to closed. It does not delete the Exchange record.</div> : null}
            {error ? <div className={styles.notice} role="alert">{error}</div> : null}
            <div className={styles.actions}><button className={styles.primary} type="submit" disabled={busy || referenceMode}>{busy ? "Working…" : titleCopy}</button><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button></div>
          </form>
        )}
        {command === "responses" && error ? <div className={styles.notice} role="alert">{error}</div> : null}
      </section>
    </div>
  );
}
