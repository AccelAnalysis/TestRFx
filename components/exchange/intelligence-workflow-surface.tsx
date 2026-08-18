"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { IntelligenceCompareDimension, IntelligenceCompareResponse, IntelligenceInsightInput, IntelligenceNote, IntelligenceWorkflow } from "@/lib/exchange/intelligence";
import { compareIntelligenceRecords, createIntelligenceNote, createIntelligenceRecord, getIntelligenceRecord, IntelligenceServiceError, updateIntelligenceRecord } from "@/lib/exchange/intelligence-client";
import { resultNodeForAction } from "@/lib/exchange/intelligence";

function sourceFrom(record?: ExchangeRecord) {
  return record?.metadata.find((item) => item.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "";
}

function defaultInput(record?: ExchangeRecord): IntelligenceInsightInput {
  return {
    title: record?.title ?? "",
    summary: record?.summary ?? "",
    geography: record?.geography ?? "",
    signalType: record?.metadata[0] ?? "Participant insight",
    sourceLabel: sourceFrom(record),
    sourceType: "participant-observation",
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function displayObserved(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "Not supplied";
}

export function IntelligenceWorkflowSurface({
  workflow,
  record,
  records,
  onClose,
  onCompleted,
}: {
  workflow: IntelligenceWorkflow;
  record?: ExchangeRecord;
  records: ExchangeRecord[];
  onClose: () => void;
  onCompleted: (nodeId: string, updatedRecord?: ExchangeRecord) => void;
}) {
  const [input, setInput] = useState<IntelligenceInsightInput>(() => defaultInput(record));
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<IntelligenceNote["visibility"]>("organization");
  const [dimension, setDimension] = useState<IntelligenceCompareDimension>("insights");
  const [rightValue, setRightValue] = useState("");
  const [comparison, setComparison] = useState<IntelligenceCompareResponse>();
  const [busy, setBusy] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(workflow === "edit");
  const [error, setError] = useState<string>();

  const intelligenceRecords = useMemo(() => records.filter((item) => item.type === "intelligence"), [records]);
  const dimensionOptions = useMemo(() => {
    if (dimension === "organizations") return unique(intelligenceRecords.map((item) => item.organization));
    if (dimension === "geographies") return unique(intelligenceRecords.map((item) => item.geography));
    return intelligenceRecords.map((item) => item.id);
  }, [dimension, intelligenceRecords]);
  const leftValue = dimension === "organizations" ? record?.organization ?? "" : dimension === "geographies" ? record?.geography ?? "" : record?.id ?? "";
  const rightChoices = dimensionOptions.filter((value) => value !== leftValue);

  useEffect(() => {
    if (workflow !== "edit" || !record) return;
    let cancelled = false;
    setLoadingEdit(true);
    getIntelligenceRecord(record.id)
      .then((detail) => {
        if (cancelled) return;
        setInput({
          title: detail.record.title,
          summary: detail.record.summary,
          geography: detail.record.geography,
          signalType: detail.signalType,
          observedFrom: detail.observedFrom?.slice(0, 10),
          observedTo: detail.observedTo?.slice(0, 10),
          sourceLabel: detail.sources[0]?.label ?? "",
          sourceType: detail.sources[0]?.type ?? detail.sourceType ?? "participant-observation",
          sourceUri: detail.sources[0]?.uri,
        });
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof IntelligenceServiceError ? caught.message : "The insight could not be loaded for editing."); })
      .finally(() => { if (!cancelled) setLoadingEdit(false); });
    return () => { cancelled = true; };
  }, [workflow, record]);

  useEffect(() => {
    setRightValue(rightChoices[0] ?? "");
    setComparison(undefined);
  }, [dimension, leftValue, rightChoices.join("|")]);

  function updateField<K extends keyof IntelligenceInsightInput>(key: K, value: IntelligenceInsightInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function submitInsight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loadingEdit) return;
    setBusy(true); setError(undefined);
    try {
      const detail = workflow === "add" ? await createIntelligenceRecord(input) : record ? await updateIntelligenceRecord(record.id, input) : undefined;
      if (!detail) return;
      const nodeId = workflow === "add" ? "intelligence.own.add.updated" : "intelligence.own.edit.updated";
      onCompleted(nodeId, detail.record);
    } catch (caught) {
      setError(caught instanceof IntelligenceServiceError ? caught.message : "The Intelligence service could not save this insight.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !note.trim() || busy) return;
    setBusy(true); setError(undefined);
    try {
      await createIntelligenceNote(record.id, { body: note.trim(), visibility });
      onCompleted("intelligence.other.note.contributed", record);
    } catch (caught) {
      setError(caught instanceof IntelligenceServiceError ? caught.message : "The note could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function runComparison() {
    if (!record || !leftValue || !rightValue || busy) return;
    setBusy(true); setError(undefined);
    try {
      setComparison(await compareIntelligenceRecords({ dimension, left: leftValue, right: rightValue }));
    } catch (caught) {
      setError(caught instanceof IntelligenceServiceError ? caught.message : "The comparison could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function finishComparison() {
    if (!record) return;
    const nodeId = resultNodeForAction("compare", record.ownedByViewer ? "own" : "other");
    if (nodeId) onCompleted(nodeId, record);
  }

  const title = workflow === "add" ? "Add Insight" : workflow === "edit" ? "Edit Insight" : workflow === "note" ? "Add Note" : "Compare";

  return (
    <section className="intelligence-workflow-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="intelligence-workflow-surface" role="dialog" aria-modal="true" aria-label={title}>
        <header className="intelligence-workflow-header">
          <div><p className="eyebrow">Intelligence</p><h2>{title}</h2></div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} disabled={busy}>×</button>
        </header>

        {error ? <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Action not completed</strong><p>{error}</p></div> : null}

        {workflow === "add" || workflow === "edit" ? (
          loadingEdit ? <div className="intelligence-service-state" role="status">Loading the canonical insight…</div> : <form className="intelligence-form" onSubmit={submitInsight}>
            <label>Insight title<input required value={input.title} onChange={(event) => updateField("title", event.target.value)} /></label>
            <label>Observation<textarea required rows={4} value={input.summary} onChange={(event) => updateField("summary", event.target.value)} /></label>
            <div className="intelligence-form-grid">
              <label>Geography<input required value={input.geography} onChange={(event) => updateField("geography", event.target.value)} /></label>
              <label>Signal type<input required value={input.signalType} onChange={(event) => updateField("signalType", event.target.value)} /></label>
              <label>Observed from<input type="date" value={input.observedFrom ?? ""} onChange={(event) => updateField("observedFrom", event.target.value || undefined)} /></label>
              <label>Observed to<input type="date" value={input.observedTo ?? ""} onChange={(event) => updateField("observedTo", event.target.value || undefined)} /></label>
              <label>Source type<select value={input.sourceType} onChange={(event) => updateField("sourceType", event.target.value as IntelligenceInsightInput["sourceType"])}><option value="participant-observation">Participant observation</option><option value="exchange-activity">Exchange activity</option><option value="external-dataset">External dataset</option></select></label>
              <label>Source label<input required value={input.sourceLabel} onChange={(event) => updateField("sourceLabel", event.target.value)} /></label>
            </div>
            <label>Source URL (optional)<input type="url" value={input.sourceUri ?? ""} onChange={(event) => updateField("sourceUri", event.target.value || undefined)} /></label>
            <div className="workflow-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="workflow-primary" type="submit" disabled={busy}>{busy ? "Saving…" : workflow === "add" ? "Add Insight" : "Save Changes"}</button></div>
          </form>
        ) : null}

        {workflow === "note" ? (
          <form className="intelligence-form" onSubmit={submitNote}>
            <p className="workflow-subject">{record?.title}</p>
            <label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as IntelligenceNote["visibility"])}><option value="personal">Personal</option><option value="organization">Organization</option><option value="shared">Shared</option></select></label>
            <label>Note<textarea autoFocus required rows={6} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, commentary, or a decision note…" /></label>
            <div className="workflow-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="workflow-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Note"}</button></div>
          </form>
        ) : null}

        {workflow === "compare" ? (
          <div className="intelligence-compare">
            <div className="compare-dimensions" role="group" aria-label="Compare across"><button type="button" className={dimension === "insights" ? "active" : ""} onClick={() => setDimension("insights")}>Insights</button><button type="button" className={dimension === "organizations" ? "active" : ""} onClick={() => setDimension("organizations")}>Organizations</button><button type="button" className={dimension === "geographies" ? "active" : ""} onClick={() => setDimension("geographies")}>Geographies</button></div>
            <div className="compare-select-grid"><label>Selected<input readOnly value={dimension === "insights" ? record?.title ?? "" : leftValue} /></label><label>Compare with<select value={rightValue} onChange={(event) => { setRightValue(event.target.value); setComparison(undefined); }}>{rightChoices.map((value) => <option key={value} value={value}>{dimension === "insights" ? intelligenceRecords.find((item) => item.id === value)?.title ?? value : value}</option>)}</select></label></div>
            <button className="workflow-primary compare-run" type="button" onClick={runComparison} disabled={!rightValue || busy}>{busy ? "Comparing…" : "Run Comparison"}</button>
            {comparison ? <div className="compare-grid">{[comparison.left, comparison.right].map((side, index) => <section className="compare-column" key={`${index}:${side.label}`}><p className="eyebrow">{index === 0 ? "Selected" : "Comparison"}</p><h3>{side.label}</h3>{side.records.length ? side.records.map((item) => <article className="compare-record" key={item.id}><strong>{item.title}</strong><span>{item.organization}</span><span>{item.geography}</span><small>{item.signalType ?? "Signal not supplied"} · {displayObserved(item.observedFrom)} → {displayObserved(item.observedTo)}</small></article>) : <p>No source records are available for this side.</p>}</section>)}</div> : null}
            <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button>{comparison ? <button className="workflow-primary" type="button" onClick={finishComparison}>Continue</button> : null}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
