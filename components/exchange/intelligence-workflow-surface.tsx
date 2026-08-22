"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { IntelligenceCompareDimension, IntelligenceCompareResponse, IntelligenceInsightInput, IntelligenceWorkflow } from "@/lib/exchange/intelligence-runtime";
import { addIntelligenceNoteThroughService, compareIntelligenceThroughService, createIntelligenceThroughService, updateIntelligenceThroughService } from "@/lib/exchange/intelligence-client";

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
    observedFrom: "",
    observedTo: "",
    sourceLabel: sourceFrom(record),
    sourceType: "participant-observation",
    sourceUri: "",
  });
  const [note, setNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"personal" | "organization" | "shared">("organization");
  const [dimension, setDimension] = useState<IntelligenceCompareDimension>("insights");
  const intelligenceRecords = useMemo(() => records.filter((item) => item.type === "intelligence"), [records]);
  const organizationOptions = useMemo(() => Array.from(new Map(intelligenceRecords.map((item) => [item.organization, item.organization])).values()), [intelligenceRecords]);
  const geographyOptions = useMemo(() => Array.from(new Set(intelligenceRecords.map((item) => item.geography).filter(Boolean))), [intelligenceRecords]);
  const insightOptions = useMemo(() => intelligenceRecords.map((item) => ({ value: item.id, label: item.title })), [intelligenceRecords]);
  const dimensionOptions = dimension === "insights" ? insightOptions : dimension === "organizations" ? organizationOptions.map((value) => ({ value, label: value })) : geographyOptions.map((value) => ({ value, label: value }));
  const [left, setLeft] = useState(record?.id ?? insightOptions[0]?.value ?? "");
  const [right, setRight] = useState(insightOptions.find((item) => item.value !== record?.id)?.value ?? "");
  const [comparison, setComparison] = useState<IntelligenceCompareResponse>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function updateField<K extends keyof IntelligenceInsightInput>(key: K, value: IntelligenceInsightInput[K]) { setInput((current) => ({ ...current, [key]: value })); }

  function resetComparison(nextDimension: IntelligenceCompareDimension) {
    setDimension(nextDimension); setComparison(undefined);
    const options = nextDimension === "insights" ? insightOptions : nextDimension === "organizations" ? organizationOptions.map((value) => ({ value, label: value })) : geographyOptions.map((value) => ({ value, label: value }));
    setLeft(options[0]?.value ?? ""); setRight(options[1]?.value ?? options[0]?.value ?? "");
  }

  async function submitInsight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      if (workflow === "add") { const result = await createIntelligenceThroughService(input); onCreate(result.record); }
      if (workflow === "edit" && record) { const result = await updateIntelligenceThroughService(record.id, input); onUpdate(result.record); }
      onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Intelligence could not be saved."); }
    finally { setPending(false); }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!record || !note.trim()) return; setPending(true); setMessage("");
    try { await addIntelligenceNoteThroughService(record.id, note.trim(), noteVisibility); onAddNote(record.id, note.trim()); onClose(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Note could not be saved."); }
    finally { setPending(false); }
  }

  async function runComparison() {
    if (!left || !right) return; setPending(true); setMessage("");
    try { const result = await compareIntelligenceThroughService(dimension, left, right); setComparison(result.comparison); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Comparison could not be loaded."); }
    finally { setPending(false); }
  }

  const title = workflow === "add" ? "Add insight" : workflow === "edit" ? "Edit insight" : workflow === "note" ? "Add note" : "Compare intelligence";
  return <section className="intelligence-workflow-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="intelligence-workflow-surface" role="dialog" aria-modal="true" aria-label={title}>
      <header className="intelligence-workflow-header"><div><p className="eyebrow">Intelligence</p><h2>{title}</h2></div><button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button></header>
      {workflow === "add" || workflow === "edit" ? <form className="intelligence-form" onSubmit={(event) => void submitInsight(event)}>
        <label>Insight title<input required value={input.title} onChange={(event) => updateField("title", event.target.value)} /></label>
        <label>Observation<textarea required rows={4} value={input.summary} onChange={(event) => updateField("summary", event.target.value)} /></label>
        <div className="intelligence-form-grid">
          <label>Geography<input value={input.geography} onChange={(event) => updateField("geography", event.target.value)} /></label>
          <label>Signal type<input required value={input.signalType} onChange={(event) => updateField("signalType", event.target.value)} /></label>
          <label>Observed from<input type="date" value={input.observedFrom ?? ""} onChange={(event) => updateField("observedFrom", event.target.value)} /></label>
          <label>Observed to<input type="date" value={input.observedTo ?? ""} onChange={(event) => updateField("observedTo", event.target.value)} /></label>
          <label>Source type<select value={input.sourceType} onChange={(event) => updateField("sourceType", event.target.value as IntelligenceInsightInput["sourceType"])}><option value="participant-observation">Participant observation</option><option value="exchange-activity">Exchange activity</option><option value="external-dataset">External dataset</option></select></label>
          <label>Source label<input required value={input.sourceLabel} onChange={(event) => updateField("sourceLabel", event.target.value)} /></label>
        </div>
        <label>Source link (optional)<input type="url" value={input.sourceUri ?? ""} onChange={(event) => updateField("sourceUri", event.target.value)} placeholder="https://…" /></label>
        {message ? <p className="intelligence-service-state intelligence-service-error" role="alert">{message}</p> : null}
        <div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit" disabled={pending}>{pending ? "Saving…" : workflow === "add" ? "Add insight" : "Save changes"}</button></div>
      </form> : null}
      {workflow === "note" ? <form className="intelligence-form" onSubmit={(event) => void submitNote(event)}><p className="workflow-subject">{record?.title}</p><label>Visibility<select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value as typeof noteVisibility)}><option value="personal">Personal</option><option value="organization">Organization</option><option value="shared">Shared</option></select></label><label>Note<textarea autoFocus required rows={6} value={note} onChange={(event) => setNote(event.target.value)} /></label>{message ? <p className="intelligence-service-state intelligence-service-error" role="alert">{message}</p> : null}<div className="workflow-actions"><button type="button" onClick={onClose}>Cancel</button><button className="workflow-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save note"}</button></div></form> : null}
      {workflow === "compare" ? <div className="intelligence-compare"><label>Compare by<select value={dimension} onChange={(event) => resetComparison(event.target.value as IntelligenceCompareDimension)}><option value="insights">Insights</option><option value="organizations">Organizations</option><option value="geographies">Geographies</option></select></label><div className="intelligence-form-grid"><label>Left<select value={left} onChange={(event) => setLeft(event.target.value)}>{dimensionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Right<select value={right} onChange={(event) => setRight(event.target.value)}>{dimensionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><button className="workflow-primary" type="button" disabled={pending || !left || !right} onClick={() => void runComparison()}>{pending ? "Comparing…" : "Compare"}</button>{comparison ? <div className="compare-grid">{[comparison.left, comparison.right].map((side) => <div className="compare-column" key={side.label}><h3>{side.label}</h3>{side.records.length ? side.records.map((item) => <dl key={item.id}><dt>{item.title}</dt><dd>{item.signalType ?? "Signal not supplied"} · {item.geography}</dd></dl>) : <p>No Intelligence records in this side.</p>}</div>)}</div> : null}{message ? <p className="intelligence-service-state intelligence-service-error" role="alert">{message}</p> : null}<div className="workflow-actions"><button type="button" onClick={onClose}>Done</button></div></div> : null}
    </div>
  </section>;
}
