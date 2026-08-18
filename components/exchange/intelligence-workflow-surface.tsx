"use client";

import { useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { buildParticipantInsight, updateParticipantInsight, type IntelligenceInsightInput, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";

interface IntelligenceServiceRecord { publicId: string; title: string; organization?: string; summary: string; signalType?: string | null; observedAt?: string | null; sourceContext?: Record<string, unknown>; geography?: string; observedPeriod?: string; sourceLabel?: string; }
interface ComparisonResult { selected: IntelligenceServiceRecord; comparison: IntelligenceServiceRecord; }

function sourceFrom(record?: ExchangeRecord) { return record?.metadata.find((item) => item.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "Participant observation"; }

async function execute(command: "add" | "edit" | "note" | "compare", payload: { recordId?: string; input?: IntelligenceInsightInput; note?: string; comparisonId?: string }) {
  const response = await fetch("/api/exchange/intelligence/workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command, ...payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Intelligence service rejected the request.");
  return body.result as IntelligenceServiceRecord | ComparisonResult;
}

export function IntelligenceWorkflowSurface({ workflow, record, records, onClose, onCreate, onUpdate, onAddNote }: {
  workflow: IntelligenceWorkflow;
  record?: ExchangeRecord;
  records: ExchangeRecord[];
  onClose: () => void;
  onCreate: (record: ExchangeRecord) => void;
  onUpdate: (record: ExchangeRecord) => void;
  onAddNote: (recordId: string, note: string) => void;
}) {
  const [input, setInput] = useState<IntelligenceInsightInput>({ title: record?.title ?? "", summary: record?.summary ?? "", geography: record?.geography ?? "", signalType: record?.metadata[0] ?? "Participant insight", observedPeriod: record?.metadata[1] ?? "Current view", sourceLabel: sourceFrom(record) });
  const [note, setNote] = useState("");
  const comparisonOptions = useMemo(() => records.filter((item) => item.type === "intelligence" && item.id !== record?.id), [records, record?.id]);
  const [comparisonId, setComparisonId] = useState(comparisonOptions[0]?.id ?? "");
  const [comparison, setComparison] = useState<ComparisonResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof IntelligenceInsightInput>(key: K, value: IntelligenceInsightInput[K]) { setInput((current) => ({ ...current, [key]: value })); }

  async function submitInsight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!input.title.trim() || !input.summary.trim() || !input.geography.trim()) return; setBusy(true); setError("");
    try {
      if (workflow === "add") {
        const persisted = await execute("add", { input }) as IntelligenceServiceRecord;
        const local = buildParticipantInsight(input);
        onCreate({ ...local, id: persisted.publicId, organization: persisted.organization ?? local.organization });
      }
      if (workflow === "edit" && record) {
        await execute("edit", { recordId: record.id, input });
        onUpdate(updateParticipantInsight(record, input));
      }
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Intelligence workflow failed."); }
    finally { setBusy(false); }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!record || !note.trim()) return; setBusy(true); setError("");
    try { await execute("note", { recordId: record.id, note: note.trim() }); onAddNote(record.id, note.trim()); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Intelligence note failed."); }
    finally { setBusy(false); }
  }

  async function runComparison() {
    if (!record || !comparisonId) return; setBusy(true); setError("");
    try { setComparison(await execute("compare", { recordId: record.id, comparisonId }) as ComparisonResult); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Intelligence comparison failed."); }
    finally { setBusy(false); }
  }

  const title = workflow === "add" ? "Add insight" : workflow === "edit" ? "Manage insight" : workflow === "note" ? "Add note" : "Compare intelligence";
  const sourceText = (item?: IntelligenceServiceRecord) => item?.sourceContext?.sourceLabel ? String(item.sourceContext.sourceLabel) : "Not supplied";
  const periodText = (item?: IntelligenceServiceRecord) => item?.sourceContext?.observedPeriod ? String(item.sourceContext.observedPeriod) : "Not supplied";

  return <section className="intelligence-workflow-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="intelligence-workflow-surface" role="dialog" aria-modal="true" aria-label={title}>
      <header className="intelligence-workflow-header"><div><p className="eyebrow">Intelligence workflow</p><h2>{title}</h2></div><button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>
      <p className="workflow-boundary">Intelligence writes and comparisons run through the authenticated PostgreSQL Intelligence service. Source/provenance metadata is persisted; unavailable infrastructure fails closed.</p>
      {error ? <p className="workflow-boundary" role="alert">{error}</p> : null}

      {workflow === "add" || workflow === "edit" ? <form className="intelligence-form" onSubmit={submitInsight}>
        <label>Insight title<input required value={input.title} onChange={(event) => updateField("title", event.target.value)} /></label>
        <label>Observation<textarea required rows={4} value={input.summary} onChange={(event) => updateField("summary", event.target.value)} /></label>
        <div className="intelligence-form-grid"><label>Geography<input required value={input.geography} onChange={(event) => updateField("geography", event.target.value)} /></label><label>Signal type<input value={input.signalType} onChange={(event) => updateField("signalType", event.target.value)} /></label><label>Observed period<input value={input.observedPeriod} onChange={(event) => updateField("observedPeriod", event.target.value)} /></label><label>Source<span className="sr-only">Source label</span><input value={input.sourceLabel} onChange={(event) => updateField("sourceLabel", event.target.value)} /></label></div>
        <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" disabled={busy} type="submit">{busy ? "Saving…" : workflow === "add" ? "Add insight" : "Save changes"}</button></div>
      </form> : null}

      {workflow === "note" ? <form className="intelligence-form" onSubmit={submitNote}><p className="workflow-subject">{record?.title}</p><label>Note<textarea autoFocus required rows={6} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, commentary, or a decision note…" /></label><div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save note"}</button></div></form> : null}

      {workflow === "compare" ? <div className="intelligence-compare">
        <label>Compare with<select value={comparisonId} onChange={(event) => { setComparisonId(event.target.value); setComparison(undefined); }}>{comparisonOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <div className="workflow-actions"><button className="workflow-primary" disabled={busy || !comparisonId} type="button" onClick={() => void runComparison()}>{busy ? "Comparing…" : "Run comparison"}</button></div>
        {comparison ? <div className="compare-grid">{[comparison.selected, comparison.comparison].map((item, index) => <div className="compare-column" key={item.publicId}><p className="eyebrow">{index === 0 ? "Selected" : "Comparison"}</p><h3>{item.title}</h3><dl><dt>Organization</dt><dd>{item.organization ?? "Not supplied"}</dd><dt>Signal</dt><dd>{item.signalType ?? "Not supplied"}</dd><dt>Period</dt><dd>{periodText(item)}</dd><dt>Source</dt><dd>{sourceText(item)}</dd></dl></div>)}</div> : <p className="workflow-boundary">Choose a canonical Intelligence record and run the comparison. Missing fields remain missing rather than being interpreted as zero.</p>}
        <div className="workflow-actions"><button type="button" onClick={onClose}>Done</button></div>
      </div> : null}
    </div>
  </section>;
}
