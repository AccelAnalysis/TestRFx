"use client";

import { useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { buildParticipantInsight, getIntelligenceDetail, updateParticipantInsight, type IntelligenceInsightInput, type IntelligenceWorkflow } from "@/lib/exchange/intelligence";

const referenceMode = process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE === "1";

function sourceFrom(record?: ExchangeRecord) {
  return record?.metadata.find((item) => item.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "Participant observation";
}

export function IntelligenceWorkflowSurface({
  workflow,
  record,
  records,
  onClose,
  onCreate,
  onUpdate,
  onAddNote,
}: {
  workflow: IntelligenceWorkflow;
  record?: ExchangeRecord;
  records: ExchangeRecord[];
  onClose: () => void;
  onCreate: (record: ExchangeRecord) => void;
  onUpdate: (record: ExchangeRecord) => void;
  onAddNote: (recordId: string, note: string) => void;
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
  const comparisonOptions = useMemo(() => records.filter((item) => item.type === "intelligence" && item.id !== record?.id), [records, record?.id]);
  const [comparisonId, setComparisonId] = useState(comparisonOptions[0]?.id ?? "");
  const comparison = records.find((item) => item.id === comparisonId);

  function updateField<K extends keyof IntelligenceInsightInput>(key: K, value: IntelligenceInsightInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function submitInsight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.title.trim() || !input.summary.trim() || !input.geography.trim()) return;
    if (workflow === "add") onCreate(buildParticipantInsight(input));
    if (workflow === "edit" && record) onUpdate(updateParticipantInsight(record, input));
    onClose();
  }

  function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !note.trim()) return;
    onAddNote(record.id, note.trim());
    onClose();
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
            <p className="workflow-boundary">{referenceMode ? "Static preview: contributions are visible for inspection but are not persisted." : "This contribution is written through the authenticated Intelligence service. Source verification and revision governance remain explicit provenance concerns."}</p>
            <label>Insight title<input required value={input.title} onChange={(event) => updateField("title", event.target.value)} /></label>
            <label>Observation<textarea required rows={4} value={input.summary} onChange={(event) => updateField("summary", event.target.value)} /></label>
            <div className="intelligence-form-grid">
              <label>Geography<input required value={input.geography} onChange={(event) => updateField("geography", event.target.value)} /></label>
              <label>Signal type<input value={input.signalType} onChange={(event) => updateField("signalType", event.target.value)} /></label>
              <label>Observed period<input value={input.observedPeriod} onChange={(event) => updateField("observedPeriod", event.target.value)} /></label>
              <label>Source<label className="sr-only">Source label</label><input value={input.sourceLabel} onChange={(event) => updateField("sourceLabel", event.target.value)} /></label>
            </div>
            <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit">{workflow === "add" ? "Add insight" : "Save changes"}</button></div>
          </form>
        ) : null}

        {workflow === "note" ? (
          <form className="intelligence-form" onSubmit={submitNote}>
            <p className="workflow-subject">{record?.title}</p>
            <p className="workflow-boundary">{referenceMode ? "Static preview: note persistence is disabled." : "Notes are persisted by the Intelligence service under the authenticated user and active organization context."}</p>
            <label>Note<textarea autoFocus required rows={6} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, commentary, or a decision note…" /></label>
            <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit">Save note</button></div>
          </form>
        ) : null}

        {workflow === "compare" ? (
          <div className="intelligence-compare">
            <p className="workflow-boundary">Comparison is computed from the Intelligence records currently returned by the Exchange service. Missing values remain missing rather than being interpreted as zero.</p>
            <label>Compare with<select value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}>{comparisonOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <div className="compare-grid">
              {[record, comparison].map((item, index) => {
                if (!item) return <div className="compare-column" key={index}><p>No comparison record available.</p></div>;
                const detail = getIntelligenceDetail(item);
                return <div className="compare-column" key={item.id}><p className="eyebrow">{index === 0 ? "Selected" : "Comparison"}</p><h3>{item.title}</h3><dl><dt>Geography</dt><dd>{item.geography}</dd><dt>Signal</dt><dd>{detail?.signalType ?? "Not supplied"}</dd><dt>Period</dt><dd>{detail?.observedPeriod ?? "Not supplied"}</dd><dt>Source</dt><dd>{detail?.sourceLabel ?? "Not supplied"}</dd></dl></div>;
              })}
            </div>
            <div className="workflow-actions"><button className="workflow-primary" type="button" onClick={onClose}>Done</button></div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
