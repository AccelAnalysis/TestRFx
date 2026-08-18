"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import styles from "./rfx-workflow-surface.module.css";

export type RfxWorkflowCommand = "draft" | "save" | "publish" | "respond-submit" | "responses-matches" | "update" | "close" | "award-advance";
export interface RfxWorkflowLaunch { command: RfxWorkflowCommand; record?: ExchangeRecord; }

interface ReviewData {
  responses: Array<{ id: string; organization: string; status: string; submitted_at: string | null }>;
  matches: Array<{ public_id: string; title: string; score: number; status: string }>;
}

const titleFor: Record<RfxWorkflowCommand, string> = {
  draft: "Draft RFx / Opportunity",
  save: "Save RFx / Opportunity",
  publish: "Publish RFx / Opportunity",
  "respond-submit": "Respond / Submit",
  "responses-matches": "View Responses / Matches",
  update: "Update RFx",
  close: "Close RFx",
  "award-advance": "Award / Advance",
};

async function post(command: RfxWorkflowCommand, recordId: string | undefined, payload: Record<string, unknown>) {
  const response = await fetch("/api/exchange/rfx/workflows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command, recordId, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "RFx service rejected the request.");
  return body.result as Record<string, unknown>;
}

export function RfxWorkflowSurface({ launch, onClose, onComplete }: {
  launch: RfxWorkflowLaunch;
  onClose: () => void;
  onComplete: (message: string, result?: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(launch.record?.title ?? "");
  const [summary, setSummary] = useState(launch.record?.summary ?? "");
  const [solicitationType, setSolicitationType] = useState("RFP");
  const [responseText, setResponseText] = useState("");
  const [review, setReview] = useState<ReviewData>();
  const [responseId, setResponseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(launch.record?.title ?? ""); setSummary(launch.record?.summary ?? ""); setReview(undefined); setResponseId(""); setError("");
  }, [launch]);

  async function execute(payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const result = await post(launch.command, launch.record?.id, payload);
      if (launch.command === "responses-matches") {
        setReview(result as unknown as ReviewData);
        return;
      }
      if (launch.command === "award-advance") {
        onComplete("RFx response advanced / awarded.", result); onClose(); return;
      }
      if (launch.command === "close") { onComplete("RFx closed.", result); onClose(); return; }
      if (launch.command === "respond-submit") { onComplete("RFx response submitted.", result); onClose(); return; }
      onComplete(launch.command === "publish" ? "RFx published." : launch.command === "update" ? "RFx updated." : "RFx saved.", result);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RFx workflow failed.");
    } finally { setBusy(false); }
  }

  async function loadReview() {
    if (!launch.record) return;
    setBusy(true); setError("");
    try {
      const result = await post("responses-matches", launch.record.id, {});
      const data = result as unknown as ReviewData;
      setReview(data);
      if (!responseId && data.responses[0]?.id) setResponseId(data.responses[0].id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load responses / matches."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (launch.command === "responses-matches" || launch.command === "award-advance") void loadReview();
    // launch changes define a new task; record identity is stable within that task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch.command, launch.record?.id]);

  function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void execute({ title, summary, solicitationType });
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.surface} role="dialog" aria-modal="true" aria-label={titleFor[launch.command]}>
        <header className={styles.header}><div><p>RFx lens workflow</p><h2>{titleFor[launch.command]}</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        {launch.record ? <div className={styles.context}><strong>{launch.record.title}</strong><span>{launch.record.organization} · {launch.record.geography}</span></div> : null}
        <div className={styles.serviceNote}><strong>Canonical RFx service:</strong> writes are server-authoritative and persist through `exchange_records`, `rfx_records`, `rfx_responses`, activity events, and the authenticated organization context. Missing database/auth configuration returns an error rather than a simulated result.</div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}

        {(["draft", "save", "publish", "update"] as RfxWorkflowCommand[]).includes(launch.command) ? (
          <form className={styles.form} onSubmit={submitRecord}>
            <label>RFx / Opportunity title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Summary<textarea required rows={5} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
            <label>Solicitation type<select value={solicitationType} onChange={(event) => setSolicitationType(event.target.value)}><option>RFP</option><option>RFQ</option><option>RFI</option><option>Sources Sought</option><option>Supplier Request</option><option>Service Request</option></select></label>
            <div className={styles.actions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : titleFor[launch.command]}</button></div>
          </form>
        ) : null}

        {launch.command === "respond-submit" ? (
          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void execute({ response: responseText }); }}>
            <label>Response<textarea required rows={8} value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Enter the response content required for this RFx." /></label>
            <div className={styles.actions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Submitting…" : "Submit response"}</button></div>
          </form>
        ) : null}

        {launch.command === "responses-matches" ? (
          <div className={styles.stack}>
            <section><h3>Responses</h3>{review?.responses.length ? review.responses.map((item) => <article className={styles.item} key={item.id}><strong>{item.organization}</strong><span>{item.status}{item.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleString()}` : ""}</span></article>) : <p>No submitted responses are available.</p>}</section>
            <section><h3>Matches</h3>{review?.matches.length ? review.matches.map((item) => <article className={styles.item} key={item.public_id}><strong>{item.title}</strong><span>{item.public_id} · score {Number(item.score).toFixed(3)} · {item.status}</span></article>) : <p>No persisted match decisions are available.</p>}</section>
            <div className={styles.actions}><button className={styles.primary} disabled={busy} type="button" onClick={() => void loadReview()}>{busy ? "Loading…" : "Refresh"}</button><button type="button" onClick={onClose}>Done</button></div>
          </div>
        ) : null}

        {launch.command === "close" ? (
          <div className={styles.stack}><p>Close this RFx / Opportunity and remove it from the active lifecycle.</p><div className={styles.actions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.danger} disabled={busy} type="button" onClick={() => void execute()}>{busy ? "Closing…" : "Close RFx"}</button></div></div>
        ) : null}

        {launch.command === "award-advance" ? (
          <div className={styles.stack}>
            <label>Select response<select value={responseId} onChange={(event) => setResponseId(event.target.value)}><option value="">Select…</option>{review?.responses.map((item) => <option key={item.id} value={item.id}>{item.organization} · {item.status}</option>)}</select></label>
            <div className={styles.actions}><button type="button" onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy || !responseId} type="button" onClick={() => void execute({ responseId })}>{busy ? "Advancing…" : "Award / Advance"}</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
