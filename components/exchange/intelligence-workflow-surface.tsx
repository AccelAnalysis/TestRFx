"use client";

import { useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { IntelligenceInsightInput, IntelligenceWorkflow } from "@/lib/exchange/intelligence";

function sourceFrom(record?: ExchangeRecord) {
  return record?.metadata.find((item) => item.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "Participant observation";
}

export function IntelligenceWorkflowSurface({
  workflow,
  record,
  onClose,
  onCreate,
  onUpdate,
  onAddNote,
}: {
  workflow: IntelligenceWorkflow;
  record?: ExchangeRecord;
  records?: ExchangeRecord[];
  onClose: () => void;
  onCreate: (input: IntelligenceInsightInput) => Promise<void> | void;
  onUpdate: (recordId: string, input: IntelligenceInsightInput) => Promise<void> | void;
  onAddNote: (recordId: string, note: string) => Promise<void> | void;
}) {
  const [input, setInput] = useState<IntelligenceInsightInput>({
    title: record?.title ?? "",
    summary: record?.summary ?? "",
    geography: record?.geography ?? "",
    signalType: record?.metadata[0] ?? "Participant insight",
    observedPeriod: record?.metadata[1] ?? "Current view",
    sourceLabel: sourceFrom(record),
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof IntelligenceInsightInput>(key: K, value: IntelligenceInsightInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function submitInsight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.title.trim() || !input.summary.trim() || !input.geography.trim()) return;
    setSubmitting(true); setError("");
    try {
      if (workflow === "add") await onCreate(input);
      if (workflow === "edit" && record) await onUpdate(record.id, input);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save this insight.");
    } finally { setSubmitting(false); }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !note.trim()) return;
    setSubmitting(true); setError("");
    try { await onAddNote(record.id, note.trim()); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save this note."); }
    finally { setSubmitting(false); }
  }

  const title = workflow === "add" ? "Add insight" : workflow === "edit" ? "Manage insight" : workflow === "note" ? "Add note" : "Compare intelligence";

  return (
    <section className="intelligence-workflow-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="intelligence-workflow-surface" role="dialog" aria-modal="true" aria-label={title}>
        <header className="intelligence-workflow-header">
          <div><p className="eyebrow">Intelligence workflow</p><h2>{title}</h2></div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>

        {workflow === "add" || workflow === "edit" ? (
          <form className="intelligence-form" onSubmit={submitInsight}>
            <p className="workflow-boundary">This form writes through the authenticated Intelligence service and retains source/provenance context in PostgreSQL.</p>
            <label>Insight title<input required value={input.title} onChange={(event) => updateField("title", event.target.value)} /></label>
            <label>Observation<textarea required rows={4} value={input.summary} onChange={(event) => updateField("summary", event.target.value)} /></label>
            <div className="intelligence-form-grid">
              <label>Geography<input required value={input.geography} onChange={(event) => updateField("geography", event.target.value)} /></label>
              <label>Signal type<input value={input.signalType} onChange={(event) => updateField("signalType", event.target.value)} /></label>
              <label>Observed period<input value={input.observedPeriod} onChange={(event) => updateField("observedPeriod", event.target.value)} /></label>
              <label>Source<span className="sr-only">Source label</span><input value={input.sourceLabel} onChange={(event) => updateField("sourceLabel", event.target.value)} /></label>
            </div>
            {error ? <p role="alert" className="workflow-boundary">{error}</p> : null}
            <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : workflow === "add" ? "Add insight" : "Save changes"}</button></div>
          </form>
        ) : null}

        {workflow === "note" ? (
          <form className="intelligence-form" onSubmit={submitNote}>
            <p className="workflow-subject">{record?.title}</p>
            <p className="workflow-boundary">Notes persist through the authenticated Intelligence notes repository with organization visibility.</p>
            <label>Note<textarea autoFocus required rows={6} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, commentary, or a decision note…" /></label>
            {error ? <p role="alert" className="workflow-boundary">{error}</p> : null}
            <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save note"}</button></div>
          </form>
        ) : null}

        {workflow === "compare" ? <div className="intelligence-compare"><p className="workflow-boundary">Comparison is unavailable until the governed analytics/matching service is configured. Reference fixture comparisons are not used as production intelligence.</p><div className="workflow-actions"><button className="workflow-primary" type="button" onClick={onClose}>Back</button></div></div> : null}
      </div>
    </section>
  );
}
