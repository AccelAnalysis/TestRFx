"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import styles from "./resources.module.css";

export type RfxWorkflow =
  | { mode: "create" }
  | { mode: "update"; recordId: string }
  | { mode: "publish"; recordId: string }
  | { mode: "close"; recordId: string }
  | { mode: "respond"; recordId: string }
  | { mode: "responses"; recordId: string }
  | { mode: "award"; recordId: string };

export type RfxCommand = "create" | "update" | "publish" | "close" | "respond" | "award";

interface RfxDetailPayload {
  recordId: string;
  title: string;
  summary: string;
  organizationName: string;
  solicitationType: string;
  solicitationNumber: string;
  status: string;
  dueAt: string;
  geography: string;
  scope: string;
  deliverables: string[];
  responseRequirements: string[];
  evaluationMethod: string;
  externalSubmissionRequired: boolean;
  ownedByViewer: boolean;
}

interface RfxResponseRow {
  id: string;
  organization_id: string;
  organization_name: string;
  status: string;
  submitted_at: string | null;
  response_data: unknown;
  external_submission_reference: string | null;
}

const emptyDraft = {
  title: "",
  summary: "",
  solicitationType: "RFP",
  solicitationNumber: "",
  dueAt: "",
  geography: "",
  scope: "",
  deliverables: "",
  responseRequirements: "",
  evaluationMethod: "",
  externalSubmissionRequired: false,
};

export function RfxWorkflowSurface({
  workflow,
  record,
  onClose,
  onCommand,
}: {
  workflow: RfxWorkflow;
  record?: ExchangeRecord;
  onClose: () => void;
  onCommand: (action: RfxCommand, recordId: string | undefined, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [detail, setDetail] = useState<RfxDetailPayload>();
  const [responses, setResponses] = useState<RfxResponseRow[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState("");
  const [responseSummary, setResponseSummary] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const recordId = "recordId" in workflow ? workflow.recordId : undefined;

  useEffect(() => {
    setError("");
    setResponseSummary("");
    setExternalReference("");
    setSelectedResponseId("");
    if (!recordId) { setDetail(undefined); setResponses([]); setDraft(emptyDraft); return; }
    const controller = new AbortController();
    setLoading(true);
    const view = workflow.mode === "responses" || workflow.mode === "award" ? "responses" : "detail";
    fetch(`/api/exchange/rfx-workflows?recordId=${encodeURIComponent(recordId)}&view=${view}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load RFx workflow data.");
        if (view === "responses") {
          const rows = Array.isArray(body.responses) ? body.responses as RfxResponseRow[] : [];
          setResponses(rows);
          setSelectedResponseId(rows.find((item) => item.status === "submitted")?.id ?? "");
        } else {
          const next = body.detail as RfxDetailPayload;
          setDetail(next);
          setDraft({
            title: next.title,
            summary: next.summary,
            solicitationType: next.solicitationType,
            solicitationNumber: next.solicitationNumber,
            dueAt: next.dueAt,
            geography: next.geography,
            scope: next.scope,
            deliverables: next.deliverables.join("\n"),
            responseRequirements: next.responseRequirements.join("\n"),
            evaluationMethod: next.evaluationMethod,
            externalSubmissionRequired: next.externalSubmissionRequired,
          });
        }
      })
      .catch((failure) => { if (failure instanceof DOMException && failure.name === "AbortError") return; setError(failure instanceof Error ? failure.message : "Unable to load RFx workflow data."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [recordId, workflow.mode]);

  async function command(action: RfxCommand, payload: Record<string, unknown> = {}) {
    setSubmitting(true); setError("");
    try { await onCommand(action, recordId, payload); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "RFx workflow failed."); }
    finally { setSubmitting(false); }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (workflow.mode === "create") await command("create", { ...draft, publish: false });
    if (workflow.mode === "update") await command("update", draft);
  }

  async function submitResponse(event: FormEvent<HTMLFormElement>, submit: boolean) {
    event.preventDefault();
    await command("respond", { responseSummary, externalSubmissionReference: externalReference, submit });
  }

  const title = workflow.mode === "create" ? "Create RFx / Opportunity"
    : workflow.mode === "update" ? "Update RFx"
      : workflow.mode === "publish" ? "Publish RFx"
        : workflow.mode === "close" ? "Close RFx"
          : workflow.mode === "respond" ? "Respond / Submit"
            : workflow.mode === "responses" ? "Responses / Matches"
              : "Award / Advance";

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.workflow} role="dialog" aria-modal="true" aria-label={title}>
        <header><div><p>RFx lens workflow</p><h2>{title}</h2></div><button className={styles.close} type="button" onClick={onClose} aria-label="Close">×</button></header>
        {record ? <div className={styles.contextCard}><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
        {loading ? <p className={styles.detailCallout}>Loading authoritative RFx data…</p> : null}
        {error ? <p className={styles.detailCallout} role="alert">{error}</p> : null}

        {(workflow.mode === "create" || workflow.mode === "update") && !loading ? (
          <form className={styles.form} onSubmit={submitUpdate}>
            <label>RFx title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <div className={styles.row}>
              <label>Solicitation type<select value={draft.solicitationType} onChange={(event) => setDraft({ ...draft, solicitationType: event.target.value })}><option>RFI</option><option>RFQ</option><option>RFP</option><option>Sources Sought</option><option>Supplier Request</option><option>Service Request</option></select></label>
              <label>Solicitation number<input value={draft.solicitationNumber} onChange={(event) => setDraft({ ...draft, solicitationNumber: event.target.value })} /></label>
            </div>
            <label>Summary<textarea required rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
            <label>Scope<textarea required rows={4} value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} /></label>
            <div className={styles.row}>
              <label>Performance geography<input required value={draft.geography} onChange={(event) => setDraft({ ...draft, geography: event.target.value })} /></label>
              <label>Due date/time<input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} /></label>
            </div>
            <label>Deliverables — one per line<textarea rows={3} value={draft.deliverables} onChange={(event) => setDraft({ ...draft, deliverables: event.target.value })} /></label>
            <label>Response requirements — one per line<textarea rows={3} value={draft.responseRequirements} onChange={(event) => setDraft({ ...draft, responseRequirements: event.target.value })} /></label>
            <label>Evaluation method<textarea rows={2} value={draft.evaluationMethod} onChange={(event) => setDraft({ ...draft, evaluationMethod: event.target.value })} /></label>
            <label><input type="checkbox" checked={draft.externalSubmissionRequired} onChange={(event) => setDraft({ ...draft, externalSubmissionRequired: event.target.checked })} /> Formal submission occurs on an external issuer channel</label>
            <div className={styles.workflowActions}>
              <button className={styles.secondary} type="button" onClick={onClose}>Cancel</button>
              {workflow.mode === "create" ? <button className={styles.secondary} type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save draft"}</button> : null}
              {workflow.mode === "create" ? <button className={styles.primary} type="button" disabled={submitting} onClick={() => { void command("create", { ...draft, publish: true }); }}>{submitting ? "Publishing…" : "Publish"}</button> : <button className={styles.primary} type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</button>}
            </div>
          </form>
        ) : null}

        {workflow.mode === "publish" && !loading ? <div><p className={styles.detailCallout}>Publishing makes this RFx active in Exchange discovery and records its issue time.</p><div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.primary} type="button" disabled={submitting} onClick={() => { void command("publish"); }}>{submitting ? "Publishing…" : "Publish RFx"}</button></div></div> : null}
        {workflow.mode === "close" && !loading ? <div><p className={styles.detailCallout}>Closing the RFx removes it from active lifecycle status while retaining its responses and audit history.</p><div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.danger} type="button" disabled={submitting} onClick={() => { void command("close"); }}>{submitting ? "Closing…" : "Close RFx"}</button></div></div> : null}

        {workflow.mode === "respond" && !loading ? (
          <form className={styles.form} onSubmit={(event) => { void submitResponse(event, true); }}>
            {detail?.externalSubmissionRequired ? <p className={styles.detailCallout}>The authoritative issuer requires external submission. RFxchange will only record “Submitted” when you provide the external submission reference.</p> : null}
            <label>Response summary<textarea required rows={6} value={responseSummary} onChange={(event) => setResponseSummary(event.target.value)} /></label>
            {detail?.externalSubmissionRequired ? <label>External submission reference<input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="Confirmation, receipt, or issuer reference" /></label> : null}
            <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.secondary} type="button" disabled={submitting || !responseSummary.trim()} onClick={() => { void command("respond", { responseSummary, externalSubmissionReference: externalReference, submit: false }); }}>Save draft</button><button className={styles.primary} type="submit" disabled={submitting || !responseSummary.trim()}>{submitting ? "Submitting…" : "Submit response"}</button></div>
          </form>
        ) : null}

        {workflow.mode === "responses" && !loading ? (
          <div>
            <p className={styles.detailCallout}>Responses below are canonical RFx response records. Capability matching is intentionally not fabricated; it remains unavailable until the governed AMACS/matching service is configured.</p>
            {responses.length ? <div>{responses.map((item) => <div key={item.id} className={styles.contextCard}><strong>{item.organization_name}</strong><span>{item.status}{item.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleString()}` : ""}</span></div>)}</div> : <p>No responses have been recorded.</p>}
            <div className={styles.workflowActions}><button className={styles.primary} type="button" onClick={onClose}>Done</button></div>
          </div>
        ) : null}

        {workflow.mode === "award" && !loading ? (
          <div>
            <p className={styles.detailCallout}>Select a recorded response to advance. The selected response and pursuit are updated together with the RFx lifecycle.</p>
            {responses.filter((item) => item.status === "submitted" || item.status === "selected").map((item) => <label key={item.id} className={styles.contextCard}><input type="radio" name="award-response" value={item.id} checked={selectedResponseId === item.id} onChange={() => setSelectedResponseId(item.id)} /><strong>{item.organization_name}</strong><span>{item.status}</span></label>)}
            <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={onClose}>Cancel</button><button className={styles.primary} type="button" disabled={submitting || !selectedResponseId} onClick={() => { void command("award", { responseId: selectedResponseId }); }}>{submitting ? "Advancing…" : "Award / Advance"}</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
