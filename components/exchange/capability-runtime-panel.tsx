"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import styles from "./resources.module.css";

export type CapabilityRuntimeMode = "evidence" | "publish";

type EvidenceItem = { id: string; kind: string; label: string; issuer?: string; note?: string };
type CapabilityDetail = {
  recordId: string;
  title: string;
  summary: string;
  organizationName: string;
  status: string;
  amacsNodeId?: string | null;
  evidenceState: string;
  evidence: EvidenceItem[];
  ownedByViewer: boolean;
};

export function CapabilityRuntimePanel({ record, mode, onModeChange, onChanged }: {
  record: ExchangeRecord;
  mode?: CapabilityRuntimeMode;
  onModeChange: (mode?: CapabilityRuntimeMode) => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<CapabilityDetail>();
  const [editing, setEditing] = useState<EvidenceItem>();
  const [form, setForm] = useState({ kind: "document", label: "", issuer: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/exchange/capability-workflows?recordId=${encodeURIComponent(record.id)}`, { cache: "no-store" });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load capability detail.");
      setDetail(body.detail as CapabilityDetail);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load capability detail.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [record.id]);
  useEffect(() => {
    if (mode === "evidence" && !editing) setForm({ kind: "document", label: "", issuer: "", note: "" });
  }, [mode, editing]);

  async function command(action: "upsert-evidence" | "remove-evidence" | "publish", payload: Record<string, unknown> = {}) {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/exchange/capability-workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, recordId: record.id, payload }) });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Capability workflow failed.");
      await load();
      onChanged?.();
      if (action === "publish") onModeChange(undefined);
      if (action === "upsert-evidence" || action === "remove-evidence") { setEditing(undefined); setForm({ kind: "document", label: "", issuer: "", note: "" }); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Capability workflow failed.");
    } finally { setSubmitting(false); }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await command("upsert-evidence", { id: editing?.id, ...form });
  }

  if (loading) return <section className="rfx-detail-section"><p className="muted">Loading capability evidence…</p></section>;
  if (!detail) return <section className="rfx-detail-section"><p className="muted">{error || "Capability detail is unavailable."}</p></section>;

  return (
    <section className="rfx-detail-section" aria-label="Capability supporting evidence">
      <p className="eyebrow">Supporting evidence</p>
      <p className="muted">Evidence state: <strong>{detail.evidenceState}</strong>{detail.amacsNodeId ? ` · AMACS ${detail.amacsNodeId}` : " · No accepted AMACS mapping"}</p>
      {error ? <p className={styles.detailCallout} role="alert">{error}</p> : null}
      {detail.evidence.length ? <div>{detail.evidence.map((item) => <div key={item.id} className={styles.contextCard}><strong>{item.label}</strong><span>{item.kind}{item.issuer ? ` · ${item.issuer}` : ""}{item.note ? ` · ${item.note}` : ""}</span>{detail.ownedByViewer ? <span><button type="button" onClick={() => { setEditing(item); setForm({ kind: item.kind, label: item.label, issuer: item.issuer ?? "", note: item.note ?? "" }); onModeChange("evidence"); }}>Edit</button> <button type="button" onClick={() => { void command("remove-evidence", { evidenceId: item.id }); }}>Remove</button></span> : null}</div>)}</div> : <p>No supporting evidence has been published for this capability.</p>}

      {detail.ownedByViewer && mode === "evidence" ? (
        <form className={styles.form} onSubmit={submitEvidence}>
          <div className={styles.row}>
            <label>Evidence type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="certification">Certification</option><option value="license">License</option><option value="past-performance">Past performance</option><option value="case-study">Case study</option><option value="document">Document</option><option value="link">Link</option></select></label>
            <label>Label<input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></label>
          </div>
          <label>Issuer / source<input value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} /></label>
          <label>Note<textarea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
          <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={() => { setEditing(undefined); onModeChange(undefined); }}>Cancel</button><button className={styles.primary} type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save evidence" : "Add evidence"}</button></div>
        </form>
      ) : null}

      {detail.ownedByViewer && mode === "publish" ? <div><p className={styles.detailCallout}>Publishing makes the current capability record active in Exchange. Existing AMACS and evidence state are preserved exactly as stored; no inferred mapping is added.</p><div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={() => onModeChange(undefined)}>Cancel</button><button className={styles.primary} type="button" disabled={submitting} onClick={() => { void command("publish"); }}>{submitting ? "Publishing…" : "Publish capability updates"}</button></div></div> : null}

      {detail.ownedByViewer && !mode ? <div className={styles.workflowActions}><button className={styles.secondary} type="button" onClick={() => onModeChange("evidence")}>Add / Edit Evidence</button><button className={styles.primary} type="button" onClick={() => onModeChange("publish")}>Publish updates</button></div> : null}
      <p className={styles.detailCallout}>AI → AMACS Mapping and Capability Gaps remain unavailable until governed providers exist. This surface does not synthesize mapping candidates or gap scores.</p>
    </section>
  );
}
