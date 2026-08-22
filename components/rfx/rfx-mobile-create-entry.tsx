"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, ChevronRight, FileText, Mic, Sparkles, Upload, WifiOff } from "lucide-react";
import type { RfxWorkspace, RfxWorkspaceEnvelope, RfxWorkspaceValue } from "@/lib/rfx/contracts";
import { recommendRfxType } from "@/lib/rfx/mobile-experience";
import { completeWorkspaceNode, setWorkspaceValues } from "@/lib/rfx/workspace";
import { loadRfxWorkspace, saveRfxWorkspace } from "@/lib/rfx/workspace-client";
import { formatAttachmentSize, storeDeviceAttachment } from "@/lib/rfx/device-attachments";
import { RfxMobileTaskCanvas, type RfxTaskCanvasProps } from "./rfx-mobile-task-canvas";
import { RfxReusePrevious, type ReusableRfxRecord } from "./rfx-reuse-previous";
import styles from "./rfx-workflow-surface.module.css";

type RecognitionEvent = Event & { results: ArrayLike<{ 0: { transcript: string } }>; resultIndex: number };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const templates = [
  { id: "quick-service", label: "Quick service request", description: "A short request for a clearly defined service.", need: "We need a qualified provider to deliver a defined service by a specified date.", type: "Service Request", mode: "quick" },
  { id: "competitive-rfq", label: "Competitive quote", description: "A specification-led request where price and delivery matter most.", need: "We need comparable quotes for a defined product or service specification.", type: "RFQ", mode: "guided" },
  { id: "sources-sought", label: "Sources sought", description: "Identify capable organizations before designing a formal opportunity.", need: "We want to identify organizations with the capability and capacity to perform this work.", type: "Sources Sought", mode: "guided" },
] as const;

function value(value: RfxWorkspaceValue | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function hasStarted(workspace: RfxWorkspace) {
  return Boolean(value(workspace.values["mobile.needStatement"]) || value(workspace.values["need.statement"]) || workspace.completedNodeIds.length || workspace.items.length);
}

export function RfxMobileCreationEntry(props: RfxTaskCanvasProps) {
  const [envelope, setEnvelope] = useState<RfxWorkspaceEnvelope>();
  const [readyForCanvas, setReadyForCanvas] = useState(props.entry !== "create-rfx");
  const [need, setNeed] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>();
  const [reuseOpen, setReuseOpen] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const recognition = useRef<Recognition>();

  useEffect(() => {
    if (props.entry !== "create-rfx") return;
    let active = true;
    void loadRfxWorkspace(props.record.id, "create-rfx").then((loaded) => {
      if (!active) return;
      setEnvelope(loaded);
      const existing = value(loaded.workspace.values["mobile.needStatement"]) || value(loaded.workspace.values["need.statement"]);
      setNeed(existing);
      if (hasStarted(loaded.workspace)) setReadyForCanvas(true);
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "The RFx draft could not be opened."); });
    return () => { active = false; recognition.current?.stop(); };
  }, [props.entry, props.record.id]);

  if (props.entry !== "create-rfx" || readyForCanvas) return <RfxMobileTaskCanvas {...props} />;
  if (!envelope) return <div className={styles.backdrop}><section className={styles.canvas}><div className={styles.loading}><span /><strong>Opening RFx draft</strong><small>{message || "Preparing your creation workspace."}</small></div></section></div>;

  async function persist(next: RfxWorkspace) {
    setSaving(true);
    try {
      const saved = await saveRfxWorkspace(next, envelope.persistence);
      setEnvelope(saved);
      return saved.workspace;
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setNeed(template.need);
    setEnvelope((current) => current ? { ...current, workspace: setWorkspaceValues(current.workspace, { "mobile.needStatement": template.need, "need.statement": template.need, "mobile.recommendedType": template.type, "need.rfxType": template.type, "need.startingPoint": "Template", "experience.mode": template.mode }) } : current);
  }

  async function continueFromDescription() {
    const statement = need.trim();
    if (!statement) { setMessage("Describe what you need before continuing."); return; }
    const recommendation = recommendRfxType(statement);
    let next = setWorkspaceValues(envelope.workspace, {
      "mobile.needStatement": statement,
      "need.statement": statement,
      "need.startingPoint": selectedTemplate ? "Template" : "Guided drafting",
      "mobile.recommendedType": selectedTemplate ? value(envelope.workspace.values["mobile.recommendedType"]) || recommendation.type : recommendation.type,
      "need.rfxType": selectedTemplate ? value(envelope.workspace.values["need.rfxType"]) || recommendation.type : recommendation.type,
      "experience.mode": envelope.workspace.values["experience.mode"] ?? recommendation.mode,
    });
    next = completeWorkspaceNode(completeWorkspaceNode(next, "need"), "starting-point");
    next = { ...next, activePath: ["create", "define-need", "select-rfx-type"], version: next.version + 1, updatedAt: new Date().toISOString() };
    await persist(next);
    setReadyForCanvas(true);
  }

  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return;
    const items = [...envelope.workspace.items];
    for (const file of Array.from(event.target.files)) {
      try {
        const stored = await storeDeviceAttachment(envelope.workspace.id, "need", file);
        items.push({ id: `attachment-${stored.id}`, nodeId: "need", label: stored.name, note: `${stored.type} · ${formatAttachmentSize(stored.size)} · stored on this device`, status: `device-attachment:${stored.id}`, createdAt: stored.createdAt });
      } catch { setMessage("This browser could not store the selected attachment on this device."); }
    }
    await persist({ ...envelope.workspace, items, version: envelope.workspace.version + 1, updatedAt: new Date().toISOString() });
    event.target.value = "";
  }

  function startDictation() {
    const scoped = window as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Constructor = scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition;
    if (!Constructor) { setMessage("Voice dictation is not available in this browser. Your keyboard microphone may still work."); return; }
    if (dictating) { recognition.current?.stop(); return; }
    const instance = new Constructor();
    recognition.current = instance;
    const starting = need;
    instance.lang = navigator.language || "en-US";
    instance.interimResults = true;
    instance.continuous = false;
    instance.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      setNeed(`${starting}${starting && transcript ? " " : ""}${transcript}`.trim());
    };
    instance.onerror = () => { setDictating(false); setMessage("Dictation stopped before text could be captured."); };
    instance.onend = () => setDictating(false);
    setDictating(true);
    instance.start();
  }

  async function applyPrevious(record: ReusableRfxRecord) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/rfx/reusable", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceRecordId: record.id, targetRecordId: props.record.id }) });
      const body = await response.json().catch(() => ({})) as { workspace?: RfxWorkspace; persistence?: "postgres"; error?: string };
      if (!response.ok || !body.workspace) throw new Error(body.error || "The previous RFx could not be reused.");
      setEnvelope({ workspace: body.workspace, persistence: "postgres" });
      setNeed(value(body.workspace.values["mobile.needStatement"]));
      setReuseOpen(false);
      setReadyForCanvas(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The previous RFx could not be reused.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.backdrop} role="presentation"><section className={styles.canvas} role="dialog" aria-modal="true" aria-label="Create RFx">
    <header className={styles.header}><button type="button" className={styles.iconButton} onClick={props.onClose} aria-label="Close RFx creation">×</button><div className={styles.headerCenter}><strong>Create RFx</strong><span>{saving ? "Saving" : envelope.persistence === "postgres" ? "Saved" : "Saved on device"}</span></div><span /></header>
    <main className={styles.body}>{reuseOpen ? <RfxReusePrevious currentRecordId={props.record.id} onCancel={() => setReuseOpen(false)} onApply={(record) => void applyPrevious(record)} /> : <div className={styles.focusTask}>
      <div className={styles.focusHeading}><span className={styles.iconDisc}><Sparkles size={23} /></span><p className={styles.eyebrow}>Create an RFx</p><h3>What do you need?</h3><p>Start in your own words. RFxchange will organize the request without forcing you through a giant form.</p></div>
      <label className={styles.heroInput}><span className="sr-only">Describe what you need</span><textarea value={need} placeholder="For example: We need a firm to assess our cybersecurity controls and provide a remediation plan…" onChange={(event) => setNeed(event.target.value)} /><div className={styles.captureRail}><button type="button" onClick={startDictation} className={dictating ? styles.captureActive : styles.capture}><Mic size={18} /><span>Speak</span></button><label className={styles.capture}><Camera size={18} /><span>Scan</span><input className="sr-only" type="file" accept="image/*" capture="environment" onChange={addAttachments} /></label><label className={styles.capture}><Upload size={18} /><span>Upload</span><input className="sr-only" type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={addAttachments} /></label></div></label>
      <div className={styles.templateBlock}><div><strong>Start another way</strong><small>Use a governed starting point and customize it.</small></div><button type="button" className={styles.primaryLarge} onClick={() => setReuseOpen(true)}><FileText size={18} />Reuse a previous RFx</button><div className={styles.templateScroller}>{templates.map((template) => <button key={template.id} type="button" className={selectedTemplate === template.id ? styles.templateActive : styles.template} onClick={() => applyTemplate(template.id)}><FileText size={20} /><strong>{template.label}</strong><small>{template.description}</small></button>)}</div></div>
      {message ? <div className={styles.message} role="status"><WifiOff size={16} /> {message}</div> : null}
      <button type="button" className={styles.primaryLarge} disabled={saving} onClick={() => void continueFromDescription()}>Continue<ChevronRight size={19} /></button>
    </div>}</main>
  </section></div>;
}
