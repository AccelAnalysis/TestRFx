"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Cloud,
  ExternalLink,
  Eye,
  FileText,
  HardDrive,
  Lock,
  MapPin,
  Mic,
  Minus,
  MoreHorizontal,
  Paperclip,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import type { ExchangeLens, ExchangeRecord } from "@/lib/exchange/contracts";
import type {
  RfxWorkflowEntry,
  RfxWorkflowField,
  RfxWorkflowNode,
  RfxWorkspace,
  RfxWorkspaceEnvelope,
  RfxWorkspaceItem,
  RfxWorkspaceValue,
} from "@/lib/rfx/contracts";
import { getRfxDetail } from "@/lib/rfx/catalog";
import {
  chapterSummaries,
  estimateResponseEffort,
  experienceMode,
  isNodeComplete,
  matchBreakdown,
  mobileTreatmentFor,
  nextIncompletePath,
  nodeChecklistComplete,
  nodeRequiredFieldsComplete,
  progressForRoot,
  publicationPreflight,
  recommendRfxType,
  responsePreflight,
  submissionReceipt,
  type RfxExperienceMode,
  type RfxPreflightResult,
} from "@/lib/rfx/mobile-experience";
import {
  findWorkflowNode,
  perspectiveForEntry,
  rfxContextActionTree,
  rootForEntry,
  workflowBreadcrumbs,
  workflowTreeFor,
} from "@/lib/rfx/workflow-tree";
import {
  completeWorkspaceNode,
  setPursuitState,
  setRfxStatus,
  setWorkspaceValues,
} from "@/lib/rfx/workspace";
import { loadRfxWorkspace, saveRfxWorkspace } from "@/lib/rfx/workspace-client";
import {
  formatAttachmentSize,
  removeDeviceAttachment,
  storeDeviceAttachment,
} from "@/lib/rfx/device-attachments";
import styles from "./rfx-workflow-surface.module.css";

type SaveState = "loading" | "saved" | "saving" | "offline" | "error";
type ContextPanel = "match" | "refer" | "more" | undefined;
type CompletionMoment = "published" | "hosted-submitted" | "external-submitted" | undefined;

type RecognitionResult = { 0: { transcript: string }; isFinal?: boolean };
type RecognitionEvent = Event & { results: ArrayLike<RecognitionResult>; resultIndex: number };
type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

const templates = [
  {
    id: "quick-service",
    label: "Quick service request",
    description: "A short request for a clearly defined service.",
    need: "We need a qualified provider to deliver a defined service by a specified date.",
    type: "Service Request",
    mode: "quick" as const,
  },
  {
    id: "competitive-rfq",
    label: "Competitive quote",
    description: "A specification-led request where price and delivery matter most.",
    need: "We need comparable quotes for a defined product or service specification.",
    type: "RFQ",
    mode: "guided" as const,
  },
  {
    id: "sources-sought",
    label: "Sources sought",
    description: "Identify capable organizations before designing a formal opportunity.",
    need: "We want to identify organizations with the capability and capacity to perform this work.",
    type: "Sources Sought",
    mode: "guided" as const,
  },
];

function valueAsString(value: RfxWorkspaceValue | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function pulse() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function dueLabel(value?: string) {
  if (!value) return "No deadline published";
  const distance = new Date(value).getTime() - Date.now();
  if (distance <= 0) return "Deadline passed";
  const days = Math.floor(distance / 86_400_000);
  const hours = Math.max(0, Math.floor((distance % 86_400_000) / 3_600_000));
  return days ? `${days}d ${hours}h remaining` : `${hours}h remaining`;
}

function pathToNode(nodes: RfxWorkflowNode[], targetId: string, path: string[] = []): string[] | undefined {
  for (const node of nodes) {
    const next = [...path, node.id];
    if (node.id === targetId) return next;
    const found = node.children ? pathToNode(node.children, targetId, next) : undefined;
    if (found) return found;
  }
  return undefined;
}

function firstField(node?: RfxWorkflowNode) {
  return node?.fields?.[0];
}

function attachmentId(item: RfxWorkspaceItem) {
  return item.status?.startsWith("device-attachment:") ? item.status.slice("device-attachment:".length) : undefined;
}

function MobileField({
  field,
  value,
  onChange,
  onDictate,
  dictating,
}: {
  field: RfxWorkflowField;
  value: RfxWorkspaceValue | undefined;
  onChange: (value: RfxWorkspaceValue) => void;
  onDictate: () => void;
  dictating: boolean;
}) {
  if (field.type === "select") {
    return (
      <fieldset className={styles.choiceField}>
        <legend>{field.label}{field.required ? " *" : ""}</legend>
        {field.help ? <p>{field.help}</p> : null}
        <div className={styles.choiceGrid}>
          {(field.options ?? []).map((option) => {
            const active = valueAsString(value) === option;
            return (
              <button
                key={option}
                type="button"
                className={active ? styles.choiceActive : styles.choiceButton}
                aria-pressed={active}
                onClick={() => onChange(option)}
              >
                <span>{option}</span>
                {active ? <Check aria-hidden size={18} /> : <Circle aria-hidden size={16} />}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.type === "boolean") {
    return (
      <button
        type="button"
        className={Boolean(value) ? styles.toggleActive : styles.toggle}
        aria-pressed={Boolean(value)}
        onClick={() => onChange(!Boolean(value))}
      >
        <span><strong>{field.label}</strong>{field.help ? <small>{field.help}</small> : null}</span>
        <span className={styles.toggleTrack}><span /></span>
      </button>
    );
  }

  if (field.type === "number") {
    const numeric = Number(value || 0);
    return (
      <label className={styles.field}>
        <span>{field.label}{field.required ? " *" : ""}</span>
        <div className={styles.stepper}>
          <button type="button" aria-label={`Decrease ${field.label}`} onClick={() => onChange(Math.max(0, numeric - 1))}><Minus size={18} /></button>
          <input type="number" inputMode="decimal" value={valueAsString(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : 0)} />
          <button type="button" aria-label={`Increase ${field.label}`} onClick={() => onChange(numeric + 1)}><Plus size={18} /></button>
        </div>
        {field.help ? <small>{field.help}</small> : null}
      </label>
    );
  }

  const long = field.type === "textarea";
  return (
    <label className={styles.field}>
      <span>{field.label}{field.required ? " *" : ""}</span>
      <div className={styles.inputShell}>
        {long ? (
          <textarea value={valueAsString(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input type={field.type === "date" ? "date" : "text"} value={valueAsString(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
        )}
        {field.type !== "date" ? (
          <button type="button" className={dictating ? styles.micActive : styles.mic} onClick={onDictate} aria-label={dictating ? "Stop dictation" : `Dictate ${field.label}`}>
            <Mic size={19} />
          </button>
        ) : null}
      </div>
      {field.help ? <small>{field.help}</small> : null}
    </label>
  );
}

function PreflightPanel({ result, onOpen }: { result: RfxPreflightResult; onOpen: (path: string[]) => void }) {
  return (
    <section className={styles.preflight} aria-label="Readiness preflight">
      <div className={styles.preflightHero}>
        <div className={styles.progressRing} style={{ "--progress": `${result.percent}%` } as CSSProperties}><strong>{result.percent}%</strong><span>ready</span></div>
        <div><p className={styles.eyebrow}>{result.ready ? "Ready for final review" : "Work remains"}</p><h3>{result.complete} of {result.total} checks complete</h3><p>{result.ready ? "No modeled blockers remain." : `${result.blockers.length} blocker${result.blockers.length === 1 ? "" : "s"} must be resolved first.`}</p></div>
      </div>
      <div className={styles.preflightList}>
        {result.items.map((item) => (
          <button key={item.id} type="button" disabled={!item.path} onClick={() => item.path && onOpen(item.path)} className={styles.preflightItem}>
            {item.state === "complete" ? <CheckCircle2 className={styles.successIcon} size={22} /> : item.state === "blocker" ? <XCircle className={styles.blockerIcon} size={22} /> : <AlertTriangle className={styles.warningIcon} size={22} />}
            <span><strong>{item.label}</strong><small>{item.message}</small></span>
            {item.path ? <ChevronRight size={18} /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function RfxWorkflowSurface({ record, entry, onClose, onOpenDetail, onToggleWatch, onLensHandoff, onOpenMenu }: {
  record: ExchangeRecord;
  entry: RfxWorkflowEntry;
  onClose: () => void;
  onOpenDetail: () => void;
  onToggleWatch: () => void;
  onLensHandoff: (lens: ExchangeLens) => void;
  onOpenMenu: () => void;
}) {
  const perspective = perspectiveForEntry(entry);
  const tree = useMemo(() => workflowTreeFor(perspective), [perspective]);
  const rootId = rootForEntry(entry);
  const root = useMemo(() => findWorkflowNode(tree, [rootId]), [tree, rootId]);
  const [envelope, setEnvelope] = useState<RfxWorkspaceEnvelope>();
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");
  const [contextPanel, setContextPanel] = useState<ContextPanel>();
  const [fieldIndex, setFieldIndex] = useState(0);
  const [dictatingFieldId, setDictatingFieldId] = useState<string>();
  const [completionMoment, setCompletionMoment] = useState<CompletionMoment>();
  const [selectedTemplate, setSelectedTemplate] = useState<string>();
  const [marketPreview, setMarketPreview] = useState<{ loading: boolean; potential: number; criteria: number; geography: number; ready: number; error?: string }>();
  const [externalOpened, setExternalOpened] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const recognition = useRef<RecognitionInstance>();
  const detail = getRfxDetail(record.id);

  useEffect(() => {
    let active = true;
    setSaveState("loading");
    void loadRfxWorkspace(record.id, entry)
      .then((loaded) => {
        if (!active) return;
        setEnvelope(loaded);
        setSaveState(loaded.persistence === "local-device" ? "offline" : "saved");
      })
      .catch(() => { if (active) setSaveState("error"); });
    return () => {
      active = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      recognition.current?.stop();
    };
  }, [record.id, entry]);

  const workspace = envelope?.workspace;
  const node = workspace ? findWorkflowNode(tree, workspace.activePath) : undefined;
  const crumbs = workspace ? workflowBreadcrumbs(tree, workspace.activePath) : [];
  const treatment = node ? mobileTreatmentFor(node, perspective) : "single-task";
  const rootProgress = root && workspace ? progressForRoot(root, workspace) : { complete: 0, total: 0, percent: 0 };
  const chapters = root && workspace ? chapterSummaries(root, workspace) : [];
  const currentFields = node?.fields ?? [];
  const currentField = currentFields[Math.min(fieldIndex, Math.max(0, currentFields.length - 1))];
  const currentAttachments = workspace && node ? workspace.items.filter((item) => item.nodeId === node.id && attachmentId(item)) : [];
  const currentItems = workspace && node ? workspace.items.filter((item) => item.nodeId === node.id && !attachmentId(item)) : [];
  const receipt = workspace ? submissionReceipt(workspace) : undefined;
  const saveLabel = saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "offline" ? "Saved on device" : saveState === "error" ? "Save issue" : "Loading";

  useEffect(() => setFieldIndex(0), [node?.id]);

  async function persist(next: RfxWorkspace, success?: string) {
    if (!envelope) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    try {
      const saved = await saveRfxWorkspace(next, envelope.persistence);
      setEnvelope((current) => !current || current.workspace.version <= saved.workspace.version ? saved : current);
      setSaveState(saved.persistence === "local-device" ? "offline" : "saved");
      if (success) setMessage(success);
    } catch {
      setSaveState("error");
      setMessage("This change could not be saved. Your current screen remains open so you can retry.");
    }
  }

  function queuePersist(next: RfxWorkspace) {
    if (!envelope) return;
    setEnvelope({ ...envelope, workspace: next });
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(next); }, 520);
  }

  function updateValue(id: string, value: RfxWorkspaceValue) {
    if (!workspace) return;
    queuePersist(setWorkspaceValues(workspace, { [id]: value }));
  }

  async function navigate(path: string[]) {
    if (!workspace) return;
    const next: RfxWorkspace = { ...workspace, activePath: path, version: workspace.version + 1, updatedAt: new Date().toISOString() };
    setFieldIndex(0);
    setContextPanel(undefined);
    await persist(next);
  }

  function openById(id: string) {
    const path = pathToNode(tree, id);
    if (path) void navigate(path);
  }

  function openChild(child: RfxWorkflowNode) {
    if (!workspace) return;
    void navigate([...workspace.activePath, child.id]);
  }

  function goBack() {
    if (!workspace) return;
    if (workspace.activePath.length <= 1) { onClose(); return; }
    void navigate(workspace.activePath.slice(0, -1));
  }

  async function saveAndExit() {
    if (workspace) await persist(workspace, "Saved");
    onClose();
  }

  function deriveState(next: RfxWorkspace, current: RfxWorkflowNode) {
    if (current.id === "go-no-go") {
      const decision = valueAsString(next.values["decision.goNoGo"]);
      if (decision === "Pursue") next = setPursuitState(next, "pursuing");
      if (decision === "Watch") next = setPursuitState(next, "watching");
      if (decision === "Decline") next = setPursuitState(next, "declined");
    }
    if (current.id === "draft") next = setPursuitState(next, "drafting");
    if (current.id === "validate-compliance") next = setPursuitState(next, "ready");
    if (current.id === "clarify" && perspective === "responder") next = setPursuitState(next, "clarification");
    if (current.id === "execute") next = setPursuitState(next, "executing");
    if (current.id === "report-outcome") next = setPursuitState(next, "outcome-reported");
    if (current.id === "publication-readiness") next = setRfxStatus(next, "ready");
    if (current.id === "evaluation") next = setRfxStatus(next, "evaluation");
    if (current.id === "clarification" && perspective === "issuer") next = setRfxStatus(next, "clarification");
    if (current.id === "close") {
      const close = valueAsString(next.values["decision.close"]);
      if (close === "Close RFx") next = setRfxStatus(next, "closed");
      if (close === "Cancel RFx") next = setRfxStatus(next, "cancelled");
    }
    if (current.id === "select-award-connect") next = setRfxStatus(next, "selected");
    if (current.id === "completed") next = setRfxStatus(next, "completed");
    return next;
  }

  async function completeCurrent() {
    if (!workspace || !node) return;
    if (node.fields?.length && !nodeRequiredFieldsComplete(node, workspace)) {
      setMessage("Complete the required item before continuing.");
      return;
    }
    if (node.checklist?.length && !nodeChecklistComplete(node, workspace)) {
      setMessage("Complete each required check before continuing.");
      return;
    }
    let next = completeWorkspaceNode(workspace, node.id);
    next = deriveState(next, node);
    await persist(next, "Step complete");
    pulse();
    const nextPath = root ? nextIncompletePath(root, next) : undefined;
    if (nextPath && nextPath.join("/") !== workspace.activePath.join("/")) await navigate(nextPath);
    else if (workspace.activePath.length > 1) await navigate([workspace.activePath[0]]);
  }

  async function toggleChecklist(index: number) {
    if (!workspace || !node) return;
    const key = `check:${node.id}:${index}`;
    await persist(setWorkspaceValues(workspace, { [key]: !Boolean(workspace.values[key]) }));
    pulse();
  }

  async function addListItem(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !node || !nodeRequiredFieldsComplete(node, workspace)) {
      setMessage("Complete the required information before adding this item.");
      return;
    }
    const fields = node.fields ?? [];
    const label = valueAsString(workspace.values[fields[0]?.id]) || node.label;
    const note = fields.slice(1).map((field) => valueAsString(workspace.values[field.id])).filter(Boolean).join(" · ");
    const item: RfxWorkspaceItem = { id: `${node.id}-${crypto.randomUUID()}`, nodeId: node.id, label, note: note || undefined, createdAt: new Date().toISOString() };
    const clear = Object.fromEntries(fields.map((field) => [field.id, null])) as Record<string, RfxWorkspaceValue>;
    let next = { ...workspace, items: [...workspace.items, item], version: workspace.version + 1, updatedAt: new Date().toISOString() };
    next = setWorkspaceValues(next, clear);
    await persist(next, "Item added");
    setFieldIndex(0);
    pulse();
  }

  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    if (!workspace || !node || !event.target.files?.length) return;
    const nextItems = [...workspace.items];
    for (const file of Array.from(event.target.files)) {
      try {
        const stored = await storeDeviceAttachment(workspace.id, node.id, file);
        nextItems.push({
          id: `attachment-${stored.id}`,
          nodeId: node.id,
          label: stored.name,
          note: `${stored.type} · ${formatAttachmentSize(stored.size)} · stored on this device`,
          status: `device-attachment:${stored.id}`,
          createdAt: stored.createdAt,
        });
      } catch {
        setMessage("This browser could not store the selected attachment on the device.");
      }
    }
    await persist({ ...workspace, items: nextItems, version: workspace.version + 1, updatedAt: new Date().toISOString() }, "Attachment saved on this device");
    event.target.value = "";
  }

  async function removeAttachment(item: RfxWorkspaceItem) {
    if (!workspace) return;
    const id = attachmentId(item);
    if (id) await removeDeviceAttachment(id).catch(() => undefined);
    await persist({ ...workspace, items: workspace.items.filter((candidate) => candidate.id !== item.id), version: workspace.version + 1, updatedAt: new Date().toISOString() }, "Attachment removed");
  }

  function startDictation(field: RfxWorkflowField) {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Voice dictation is not available in this browser. Your keyboard microphone may still work.");
      return;
    }
    if (dictatingFieldId === field.id) {
      recognition.current?.stop();
      return;
    }
    const instance = new Recognition();
    recognition.current = instance;
    instance.lang = navigator.language || "en-US";
    instance.interimResults = true;
    instance.continuous = false;
    const starting = valueAsString(workspace?.values[field.id]);
    instance.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      updateValue(field.id, `${starting}${starting && transcript ? " " : ""}${transcript}`.trim());
    };
    instance.onerror = () => { setMessage("Dictation stopped before text could be captured."); setDictatingFieldId(undefined); };
    instance.onend = () => setDictatingFieldId(undefined);
    setDictatingFieldId(field.id);
    instance.start();
  }

  function applyTemplate(templateId: string) {
    if (!workspace || !root) return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const needPath = pathToNode(tree, "need");
    const typePath = pathToNode(tree, "select-rfx-type");
    const needNode = needPath ? findWorkflowNode(tree, needPath) : undefined;
    const typeNode = typePath ? findWorkflowNode(tree, typePath) : undefined;
    const values: Record<string, RfxWorkspaceValue> = {
      "mobile.needStatement": template.need,
      "mobile.recommendedType": template.type,
      "experience.mode": template.mode,
    };
    if (firstField(needNode)) values[firstField(needNode)!.id] = template.need;
    if (firstField(typeNode)) values[firstField(typeNode)!.id] = template.type;
    queuePersist(setWorkspaceValues(workspace, values));
    setSelectedTemplate(templateId);
    pulse();
  }

  async function startCreation() {
    if (!workspace) return;
    const need = valueAsString(workspace.values["mobile.needStatement"]);
    if (!need) { setMessage("Describe what you need before continuing."); return; }
    const recommendation = recommendRfxType(need);
    let next = setWorkspaceValues(workspace, {
      "mobile.recommendedType": recommendation.type,
      "experience.mode": workspace.values["experience.mode"] ?? recommendation.mode,
    });
    const typePath = pathToNode(tree, "select-rfx-type");
    const typeNode = typePath ? findWorkflowNode(tree, typePath) : undefined;
    if (firstField(typeNode)) next = setWorkspaceValues(next, { [firstField(typeNode)!.id]: recommendation.type });
    await persist(next, "Need captured");
    if (typePath) await navigate(typePath);
  }

  async function decidePursuit(decision: "Pursue" | "Watch" | "Decline") {
    if (!workspace) return;
    let next = setWorkspaceValues(workspace, { "decision.goNoGo": decision });
    next = setPursuitState(next, decision === "Pursue" ? "pursuing" : decision === "Watch" ? "watching" : "declined");
    await persist(next, decision === "Pursue" ? "Pursuit started" : decision === "Watch" ? "Added to Watch" : "Opportunity declined");
    pulse();
    if (decision === "Watch") { onToggleWatch(); onClose(); return; }
    if (decision === "Decline") { openById("go-no-go"); return; }
    const path = pathToNode(tree, "assess-fit") ?? pathToNode(tree, "go-no-go") ?? nextIncompletePath(root!, next);
    if (path) await navigate(path);
  }

  async function createContextReferral() {
    if (!workspace) return;
    const organization = valueAsString(workspace.values["contextReferral.organization"]).trim();
    if (!organization) { setMessage("Enter the relevant organization."); return; }
    const item: RfxWorkspaceItem = {
      id: `context-refer-${crypto.randomUUID()}`,
      nodeId: "context-refer",
      label: organization,
      note: valueAsString(workspace.values["contextReferral.note"]) || undefined,
      status: "created",
      createdAt: new Date().toISOString(),
    };
    await persist({ ...workspace, items: [...workspace.items, item], version: workspace.version + 1, updatedAt: new Date().toISOString() }, "Referral context recorded");
    setContextPanel(undefined);
    onOpenMenu();
  }

  async function runMarketPreview() {
    if (!workspace) return;
    setMarketPreview({ loading: true, potential: 0, criteria: 0, geography: 0, ready: 0 });
    try {
      const query = valueAsString(workspace.values["mobile.needStatement"]) || record.title;
      const response = await fetch(`/api/exchange/results?lens=capabilities&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("preview unavailable");
      const payload = await response.json() as { records?: ExchangeRecord[]; results?: { record: ExchangeRecord }[] };
      const records = payload.records ?? payload.results?.map((result) => result.record) ?? [];
      const geography = detail?.performanceGeography.toLowerCase() ?? record.geography.toLowerCase();
      const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
      const criteria = records.filter((candidate) => terms.some((term) => `${candidate.title} ${candidate.summary} ${candidate.metadata.join(" ")}`.toLowerCase().includes(term))).length;
      const geographic = records.filter((candidate) => geography.includes(candidate.geography.toLowerCase()) || candidate.geography.toLowerCase().includes(record.geography.toLowerCase())).length;
      const ready = records.filter((candidate) => Boolean(candidate.card?.status) && candidate.metadata.length >= 2).length;
      setMarketPreview({ loading: false, potential: records.length, criteria, geography: geographic, ready });
    } catch {
      const breakdown = matchBreakdown(detail);
      if (breakdown.total) setMarketPreview({ loading: false, potential: breakdown.total, criteria: breakdown.matched + breakdown.confirm, geography: detail?.match?.geographyMatched ? breakdown.total : 0, ready: breakdown.matched });
      else setMarketPreview({ loading: false, potential: 0, criteria: 0, geography: 0, ready: 0, error: "A live market preview requires the Exchange search service. Your RFx draft remains saved." });
    }
  }

  async function publishRfx() {
    if (!workspace || !root) return;
    const preflight = publicationPreflight(root, workspace);
    if (!preflight.ready) { setMessage("Resolve the publication blockers before publishing."); return; }
    const item: RfxWorkspaceItem = {
      id: `publication-${crypto.randomUUID()}`,
      nodeId: "publication-receipt",
      label: `Published ${record.title}`,
      note: `${new Date().toISOString()} · workspace version ${workspace.version + 1}`,
      status: "published",
      createdAt: new Date().toISOString(),
    };
    let next = setRfxStatus(workspace, "open");
    next = completeWorkspaceNode(next, "publish");
    next = { ...next, items: [...next.items, item], version: next.version + 1, updatedAt: new Date().toISOString() };
    await persist(next, "RFx published");
    setCompletionMoment("published");
    pulse();
  }

  async function submitHosted() {
    if (!workspace || !root) return;
    const preflight = responsePreflight(root, workspace);
    if (!preflight.ready || !Boolean(workspace.values["submission.authorized"])) {
      setMessage(preflight.ready ? "Confirm that you are authorized to submit." : "Resolve the submission blockers first.");
      return;
    }
    const receiptId = `RFXC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const item: RfxWorkspaceItem = {
      id: `submission-${crypto.randomUUID()}`,
      nodeId: "submission-receipt",
      label: receiptId,
      note: `${new Date().toISOString()} · locked workspace version ${workspace.version + 1}`,
      status: "submitted",
      createdAt: new Date().toISOString(),
    };
    let next = setPursuitState(workspace, "submitted");
    next = completeWorkspaceNode(next, "hosted-submission");
    next = { ...next, items: [...next.items, item], version: next.version + 1, updatedAt: new Date().toISOString() };
    await persist(next, "Response submitted");
    setCompletionMoment("hosted-submitted");
    pulse();
  }

  async function confirmExternalSubmission() {
    if (!workspace || !root) return;
    const reference = valueAsString(workspace.values["submission.externalReference"]);
    const submittedAt = valueAsString(workspace.values["submission.externalSubmittedAt"]);
    if (!reference || !submittedAt || !Boolean(workspace.values["submission.externalConfirmed"])) {
      setMessage("Enter the external confirmation, date, and self-report acknowledgement.");
      return;
    }
    const item: RfxWorkspaceItem = {
      id: `external-${crypto.randomUUID()}`,
      nodeId: "external-submission",
      label: reference,
      note: `${submittedAt} · externally submitted, self-reported`,
      status: "external-self-reported",
      createdAt: new Date().toISOString(),
    };
    let next = setPursuitState(workspace, "submitted");
    next = completeWorkspaceNode(next, "external-submission");
    next = { ...next, items: [...next.items, item], version: next.version + 1, updatedAt: new Date().toISOString() };
    await persist(next, "External submission recorded as self-reported");
    setCompletionMoment("external-submitted");
    pulse();
  }

  async function handoff(current: RfxWorkflowNode) {
    if (!workspace) return;
    await persist(workspace, "RFx work saved before handoff");
    if (current.handoff === "capabilities") { onLensHandoff("capabilities"); return; }
    if (current.handoff === "resources") { onLensHandoff("resources"); return; }
    if (current.handoff === "referrals") { onOpenMenu(); return; }
    setExternalOpened(true);
  }

  function nextFieldOrComplete() {
    if (!workspace || !node) return;
    if (currentField?.required && !valueAsString(workspace.values[currentField.id])) {
      setMessage("Complete this item before continuing.");
      return;
    }
    if (fieldIndex < currentFields.length - 1) {
      setFieldIndex((current) => current + 1);
      setMessage("");
      return;
    }
    void completeCurrent();
  }

  if (!workspace || !node || !root) {
    return <div className={styles.backdrop}><section className={styles.canvas}><div className={styles.loading}><span /><strong>Opening RFx workspace</strong><small>Your saved work is being restored.</small></div></section></div>;
  }

  const atRoot = workspace.activePath.length === 1;
  const needStatement = valueAsString(workspace.values["mobile.needStatement"]);
  const recommendation = recommendRfxType(needStatement || record.summary);
  const breakdown = matchBreakdown(detail);
  const effort = estimateResponseEffort(detail);
  const publication = publicationPreflight(root, workspace);
  const submission = responsePreflight(root, workspace);
  const mode = experienceMode(workspace);
  const isCreationStart = entry === "create-rfx" && atRoot && !needStatement;
  const isResponderDecision = perspective === "responder" && atRoot && ["discovered", undefined].includes(workspace.pursuitState);
  const showResponseHome = perspective === "responder" && atRoot && !isResponderDecision;
  const showChapterHome = atRoot && !isCreationStart && !isResponderDecision && !showResponseHome;
  const nodeComplete = isNodeComplete(node, workspace);
  const fieldNumber = currentFields.length ? fieldIndex + 1 : undefined;
  const primaryLabel = currentFields.length && fieldNumber && fieldNumber < currentFields.length ? "Continue" : nodeComplete ? "Done" : "Complete step";

  function renderCreationStart() {
    return (
      <div className={styles.focusTask}>
        <div className={styles.focusHeading}><span className={styles.iconDisc}><Sparkles size={23} /></span><p className={styles.eyebrow}>Create an RFx</p><h3>What do you need?</h3><p>Start in your own words. RFxchange will organize the request without forcing you through a giant form.</p></div>
        <label className={styles.heroInput}>
          <span className="sr-only">Describe what you need</span>
          <textarea value={needStatement} placeholder="For example: We need a firm to assess our cybersecurity controls and provide a remediation plan…" onChange={(event) => updateValue("mobile.needStatement", event.target.value)} />
          <div className={styles.captureRail}>
            <button type="button" onClick={() => startDictation({ id: "mobile.needStatement", label: "Need", type: "textarea" })} className={dictatingFieldId === "mobile.needStatement" ? styles.captureActive : styles.capture}><Mic size={18} /><span>Speak</span></button>
            <label className={styles.capture}><Camera size={18} /><span>Scan</span><input className="sr-only" type="file" accept="image/*" capture="environment" onChange={addAttachments} /></label>
            <label className={styles.capture}><Upload size={18} /><span>Upload</span><input className="sr-only" type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={addAttachments} /></label>
          </div>
        </label>
        <div className={styles.templateBlock}>
          <div><strong>Start another way</strong><small>Use a governed starting point and customize it.</small></div>
          <div className={styles.templateScroller}>
            {templates.map((template) => <button key={template.id} type="button" className={selectedTemplate === template.id ? styles.templateActive : styles.template} onClick={() => applyTemplate(template.id)}><FileText size={20} /><strong>{template.label}</strong><small>{template.description}</small></button>)}
          </div>
        </div>
      </div>
    );
  }

  function renderOpportunityDecision() {
    return (
      <div className={styles.decisionHome}>
        <div className={styles.opportunityHero}>
          <div className={styles.opportunityTop}><span>{detail?.rfxType ?? "RFx"}</span><span className={styles.due}><Clock size={15} />{dueLabel(detail?.closesAt)}</span></div>
          <h3>{record.title}</h3><p>{record.organization}</p>
          <div className={styles.opportunityMeta}><span><MapPin size={15} />{detail?.performanceGeography ?? record.geography}</span>{detail?.estimatedValue ? <span>{detail.estimatedValue}</span> : null}<span>{effort.label} effort</span></div>
        </div>
        <section className={styles.whyCard}>
          <div><p className={styles.eyebrow}>Why you are seeing this</p><h4>{breakdown.matched} of {breakdown.total || detail?.match?.total || 0} requirements represented</h4></div>
          <div className={styles.matchTiles}><div className={styles.matched}><strong>{breakdown.matched}</strong><span>Matched</span></div><div className={styles.confirm}><strong>{breakdown.confirm}</strong><span>Confirm</span></div><div className={styles.gap}><strong>{breakdown.gap}</strong><span>Gap</span></div></div>
          <p>{detail?.match?.summary ?? "Review the structured requirements before making a pursuit decision."}</p>
          <small>Discovery context only—not qualification, endorsement, eligibility, or an award prediction.</small>
        </section>
        <section className={styles.effortCard}><Target size={22} /><div><strong>{effort.label} response effort</strong><p>{effort.detail}</p></div></section>
        <div className={styles.decisionButtons}><button type="button" className={styles.primaryLarge} onClick={() => void decidePursuit("Pursue")}>Pursue</button><button type="button" onClick={() => void decidePursuit("Watch")}>Watch</button><button type="button" onClick={() => void decidePursuit("Decline")}>Decline</button></div>
      </div>
    );
  }

  function renderResponseHome() {
    const next = nextIncompletePath(root, workspace);
    const blockerCount = submission.blockers.length;
    return (
      <div className={styles.responseHome}>
        <section className={styles.readinessHero}>
          <div className={styles.progressRingLarge} style={{ "--progress": `${submission.percent}%` } as CSSProperties}><strong>{submission.percent}%</strong><span>ready</span></div>
          <div><p className={styles.eyebrow}>Your response</p><h3>{dueLabel(detail?.closesAt)}</h3><p>{blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"} before submission` : "No modeled blockers remain"}</p></div>
        </section>
        {next ? <button type="button" className={styles.nextBest} onClick={() => void navigate(next)}><span><small>Next best action</small><strong>Continue where you left off</strong></span><ChevronRight size={22} /></button> : null}
        {blockerCount ? <section className={styles.blockerSummary}><div><AlertTriangle size={20} /><strong>Needs attention</strong></div>{submission.blockers.slice(0, 3).map((item) => <button key={item.id} type="button" onClick={() => item.path && void navigate(item.path)}><span>{item.label}</span><ChevronRight size={17} /></button>)}</section> : null}
        <div className={styles.chapterList}>{chapters.map((chapter) => <button key={chapter.id} type="button" className={styles.chapterCard} onClick={() => void navigate(chapter.nextPath ?? chapter.path)}><div className={styles.chapterStatus}>{chapter.percent === 100 ? <Check size={18} /> : <span>{chapter.percent}%</span>}</div><span><strong>{chapter.label}</strong><small>{chapter.complete} of {chapter.total} tasks complete</small></span><ChevronRight size={19} /></button>)}</div>
        <button type="button" className={styles.submitShortcut} onClick={() => openById(detail?.externalSubmissionRequired ? "external-submission" : "hosted-submission")}><ShieldCheck size={20} /><span><strong>Review & submit</strong><small>Run the final package preflight.</small></span><ChevronRight size={19} /></button>
      </div>
    );
  }

  function renderChapterHome() {
    const next = nextIncompletePath(root, workspace);
    return (
      <div className={styles.chapterHome}>
        <section className={styles.chapterHero}><div className={styles.progressRingLarge} style={{ "--progress": `${rootProgress.percent}%` } as CSSProperties}><strong>{rootProgress.percent}%</strong><span>complete</span></div><div><p className={styles.eyebrow}>{perspective === "issuer" ? "Issuer workspace" : "Response workspace"}</p><h3>{entry === "create-rfx" ? "Build your RFx" : node.label}</h3><p>{mode[0].toUpperCase() + mode.slice(1)} path · {rootProgress.complete} of {rootProgress.total} tasks complete</p></div></section>
        {entry === "create-rfx" && needStatement ? <section className={styles.needSummary}><Sparkles size={20} /><div><small>Your need</small><p>{needStatement}</p><span>{valueAsString(workspace.values["mobile.recommendedType"]) || recommendation.type} · {mode} path</span></div></section> : null}
        {next ? <button type="button" className={styles.nextBest} onClick={() => void navigate(next)}><span><small>Continue</small><strong>Pick up where you left off</strong></span><ChevronRight size={22} /></button> : null}
        <div className={styles.chapterList}>{chapters.map((chapter) => <button key={chapter.id} type="button" className={styles.chapterCard} onClick={() => void navigate(chapter.nextPath ?? chapter.path)}><div className={styles.chapterStatus}>{chapter.percent === 100 ? <Check size={18} /> : <span>{chapter.percent}%</span>}</div><span><strong>{chapter.label}</strong><small>{chapter.description}</small></span><ChevronRight size={19} /></button>)}</div>
      </div>
    );
  }

  function renderTypeRecommendation() {
    const selected = valueAsString(workspace.values[firstField(node)?.id ?? "mobile.recommendedType"]) || recommendation.type;
    return (
      <div className={styles.focusTask}>
        <div className={styles.focusHeading}><span className={styles.iconDisc}><Sparkles size={23} /></span><p className={styles.eyebrow}>Recommended request</p><h3>{recommendation.type}</h3><p>{recommendation.reason}</p></div>
        <button type="button" className={styles.recommendationCard}><span><small>Recommended</small><strong>{recommendation.type}</strong><p>{recommendation.reason}</p></span><CheckCircle2 size={25} /></button>
        <div className={styles.alternativeBlock}><strong>Choose another type</strong><div className={styles.choiceGrid}>{[recommendation.type, ...recommendation.alternatives].filter((value, index, values) => values.indexOf(value) === index).map((type) => <button key={type} type="button" className={selected === type ? styles.choiceActive : styles.choiceButton} onClick={() => { if (firstField(node)) updateValue(firstField(node)!.id, type); updateValue("mobile.recommendedType", type); }}><span>{type}</span>{selected === type ? <Check size={18} /> : <Circle size={16} />}</button>)}</div></div>
        <div className={styles.modeBlock}><strong>How much structure do you need?</strong><div className={styles.modeGrid}>{(["quick", "guided", "formal"] as RfxExperienceMode[]).map((candidate) => <button key={candidate} type="button" className={mode === candidate ? styles.modeActive : styles.mode} onClick={() => updateValue("experience.mode", candidate)}><strong>{candidate[0].toUpperCase() + candidate.slice(1)}</strong><small>{candidate === "quick" ? "Defined need, lighter path" : candidate === "guided" ? "Typical RFx with structured guidance" : "Approvals, evaluation, and governance"}</small></button>)}</div></div>
      </div>
    );
  }

  function renderMarketPreview() {
    const preview = marketPreview;
    return (
      <div className={styles.focusTask}>
        <div className={styles.focusHeading}><span className={styles.iconDisc}><Target size={23} /></span><p className={styles.eyebrow}>Market preview</p><h3>See the reachable market before publishing</h3><p>This preview uses visible Exchange profiles and structured requirement signals. It does not certify qualification.</p></div>
        {!preview ? <button type="button" className={styles.primaryLarge} onClick={() => void runMarketPreview()}><Sparkles size={19} />Run market preview</button> : preview.loading ? <div className={styles.marketLoading}><span /><strong>Checking the visible Exchange</strong></div> : (
          <div className={styles.funnel}>
            {[{ label: "Potential profiles", value: preview.potential }, { label: "Criteria represented", value: preview.criteria }, { label: "Service geography", value: preview.geography }, { label: "Profiles ready", value: preview.ready }].map((stage, index) => <div key={stage.label} className={styles.funnelStage} style={{ "--stage": index } as CSSProperties}><strong>{stage.value}</strong><span>{stage.label}</span></div>)}
          </div>
        )}
        {preview?.error ? <div className={styles.boundaryNote}><WifiOff size={20} /><p>{preview.error}</p></div> : null}
        <div className={styles.boundaryNote}><ShieldCheck size={20} /><p>Counts support market design only. The issuer remains responsible for eligibility, evaluation, and selection.</p></div>
      </div>
    );
  }

  function renderPreflight() {
    const result = perspective === "issuer" ? publication : submission;
    return <PreflightPanel result={result} onOpen={(path) => void navigate(path)} />;
  }

  function renderPreview() {
    return (
      <div className={styles.previewPhone}>
        <div className={styles.previewLabel}><Eye size={18} />Responder preview</div>
        <article className={styles.previewCard}>
          <div><span>{detail?.rfxType ?? valueAsString(workspace.values["mobile.recommendedType"]) || "RFx"}</span><span>{dueLabel(detail?.closesAt)}</span></div>
          <h3>{record.title}</h3><p>{record.organization}</p>
          <div className={styles.previewMeta}><span><MapPin size={15} />{detail?.performanceGeography ?? record.geography}</span>{detail?.estimatedValue ? <span>{detail.estimatedValue}</span> : null}</div>
          <p>{needStatement || detail?.scope || record.summary}</p>
          <div className={styles.previewRequirements}>{(detail?.requirements ?? []).slice(0, 4).map((requirement) => <span key={requirement.id}>{requirement.label}</span>)}</div>
        </article>
        <p className={styles.previewHint}>This is the compact first impression responders receive. Full requirements, response instructions, evaluation, and attachments remain available below it.</p>
      </div>
    );
  }

  function renderSubmission() {
    const hosted = node.id === "hosted-submission";
    const result = submission;
    if ((hosted && completionMoment === "hosted-submitted") || (!hosted && completionMoment === "external-submitted") || receipt) {
      const currentReceipt = receipt;
      return (
        <div className={styles.receipt}>
          <span className={styles.receiptCheck}><Check size={34} /></span>
          <p className={styles.eyebrow}>{hosted ? "Response submitted" : "External submission recorded"}</p>
          <h3>{currentReceipt?.label ?? "Submission complete"}</h3>
          <p>{currentReceipt?.note}</p>
          <div className={styles.receiptFacts}><div><span>Status</span><strong>{hosted ? "RFxchange hosted" : "Externally submitted · self-reported"}</strong></div><div><span>Workspace version</span><strong>{workspace.version}</strong></div><div><span>Timestamp</span><strong>{formatDate(currentReceipt?.createdAt)}</strong></div></div>
          <button type="button" className={styles.primaryLarge} onClick={onClose}>Return to RFx</button>
        </div>
      );
    }
    return (
      <div className={styles.submissionFlow}>
        <PreflightPanel result={result} onOpen={(path) => void navigate(path)} />
        {result.ready ? hosted ? (
          <section className={styles.commitCard}><Lock size={23} /><div><h3>Submit response</h3><p>Submitting locks this response version, records the server timestamp, and creates a receipt.</p></div><label className={styles.authorityCheck}><input type="checkbox" checked={Boolean(workspace.values["submission.authorized"])} onChange={(event) => updateValue("submission.authorized", event.target.checked)} /><span>I confirm that I am authorized to submit this response.</span></label><button type="button" className={styles.primaryLarge} onClick={() => void submitHosted()}><Send size={19} />Submit response</button></section>
        ) : (
          <section className={styles.externalCard}>
            <ExternalLink size={24} /><div><h3>Submit in the authoritative issuer system</h3><p>RFxchange can prepare and validate the package, but it will not claim formal external submission.</p></div>
            {!externalOpened ? <button type="button" className={styles.primaryLarge} onClick={() => { setExternalOpened(true); window.open((detail as (typeof detail & { authoritativeSubmissionUrl?: string }))?.authoritativeSubmissionUrl ?? "about:blank", "_blank", "noopener,noreferrer"); }}>Open official portal<ExternalLink size={18} /></button> : <>
              <label className={styles.field}><span>External confirmation or reference *</span><input value={valueAsString(workspace.values["submission.externalReference"])} onChange={(event) => updateValue("submission.externalReference", event.target.value)} placeholder="Confirmation number" /></label>
              <label className={styles.field}><span>Submitted date and time *</span><input type="datetime-local" value={valueAsString(workspace.values["submission.externalSubmittedAt"])} onChange={(event) => updateValue("submission.externalSubmittedAt", event.target.value)} /></label>
              <label className={styles.authorityCheck}><input type="checkbox" checked={Boolean(workspace.values["submission.externalConfirmed"])} onChange={(event) => updateValue("submission.externalConfirmed", event.target.checked)} /><span>I confirm that I completed submission in the issuer system. This status is self-reported until a permitted integration verifies it.</span></label>
              <label className={styles.attachmentButton}><Paperclip size={18} /><span>Add receipt image or file</span><input className="sr-only" type="file" accept="image/*,.pdf" capture="environment" onChange={addAttachments} /></label>
              <button type="button" className={styles.primaryLarge} onClick={() => void confirmExternalSubmission()}>Record external submission</button>
            </>}
          </section>
        ) : null}
      </div>
    );
  }

  function renderGenericTask() {
    if (node.children?.length) {
      return <div className={styles.chapterList}>{node.children.map((child) => { const complete = isNodeComplete(child, workspace); return <button key={child.id} type="button" className={styles.chapterCard} onClick={() => openChild(child)}><div className={complete ? styles.chapterStatusComplete : styles.chapterStatus}>{complete ? <Check size={18} /> : <Circle size={16} />}</div><span><strong>{child.label}</strong><small>{child.description}</small></span><ChevronRight size={19} /></button>; })}</div>;
    }
    if (node.kind === "list") {
      return <form className={styles.taskForm} onSubmit={(event) => void addListItem(event)}>{currentField ? <MobileField field={currentField} value={workspace.values[currentField.id]} onChange={(value) => updateValue(currentField.id, value)} onDictate={() => startDictation(currentField)} dictating={dictatingFieldId === currentField.id} /> : null}{currentFields.length > 1 ? <div className={styles.fieldProgress}>{currentFields.map((field, index) => <button type="button" key={field.id} aria-label={`Open ${field.label}`} className={index === fieldIndex ? styles.fieldDotActive : styles.fieldDot} onClick={() => setFieldIndex(index)} />)}</div> : null}{fieldIndex === currentFields.length - 1 ? <button type="submit" className={styles.primaryLarge}><Plus size={18} />Add item</button> : <button type="button" className={styles.primaryLarge} onClick={() => setFieldIndex((current) => Math.min(current + 1, currentFields.length - 1))}>Continue</button>}{currentItems.length ? <div className={styles.workCards}>{currentItems.map((item) => <article key={item.id}><CheckCircle2 size={19} /><span><strong>{item.label}</strong>{item.note ? <small>{item.note}</small> : null}</span></article>)}</div> : null}</form>;
    }
    if (node.checklist?.length) {
      return <div className={styles.checklist}>{node.checklist.map((item, index) => { const checked = Boolean(workspace.values[`check:${node.id}:${index}`]); return <button key={item} type="button" aria-pressed={checked} className={checked ? styles.checkActive : styles.check} onClick={() => void toggleChecklist(index)}>{checked ? <Check size={19} /> : <Circle size={18} />}<span>{item}</span></button>; })}</div>;
    }
    if (currentField) {
      return <div className={styles.taskForm}><MobileField field={currentField} value={workspace.values[currentField.id]} onChange={(value) => updateValue(currentField.id, value)} onDictate={() => startDictation(currentField)} dictating={dictatingFieldId === currentField.id} />{currentFields.length > 1 ? <div className={styles.fieldProgress}>{currentFields.map((field, index) => <button type="button" key={field.id} aria-label={`Open ${field.label}`} className={index === fieldIndex ? styles.fieldDotActive : styles.fieldDot} onClick={() => setFieldIndex(index)} />)}</div> : null}</div>;
    }
    if (node.kind === "handoff") {
      return <div className={styles.handoff}><Users size={30} /><h3>{node.label}</h3><p>{node.description}</p><button type="button" className={styles.primaryLarge} onClick={() => void handoff(node)}>{node.handoff === "capabilities" ? "Find a teammate" : node.handoff === "resources" ? "Find support resources" : "Continue"}<ChevronRight size={19} /></button></div>;
    }
    return <div className={styles.activityCard}><CheckCircle2 size={25} /><h3>{node.label}</h3><p>{node.description}</p></div>;
  }

  let taskContent;
  if (isCreationStart) taskContent = renderCreationStart();
  else if (isResponderDecision) taskContent = renderOpportunityDecision();
  else if (showResponseHome) taskContent = renderResponseHome();
  else if (showChapterHome) taskContent = renderChapterHome();
  else if (node.id === "select-rfx-type") taskContent = renderTypeRecommendation();
  else if (treatment === "market-preview") taskContent = renderMarketPreview();
  else if (treatment === "preflight") taskContent = renderPreflight();
  else if (treatment === "preview") taskContent = renderPreview();
  else if (treatment === "hosted-submission" || treatment === "external-submission") taskContent = renderSubmission();
  else taskContent = renderGenericTask();

  const canShowTaskFooter = !atRoot && !["hosted-submission", "external-submission"].includes(treatment) && node.id !== "publish";

  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.canvas} role="dialog" aria-modal="true" aria-label={`${node.label} RFx task canvas`}>
        <header className={styles.header}>
          <button type="button" className={styles.iconButton} onClick={goBack} aria-label="Go back"><ArrowLeft size={22} /></button>
          <div className={styles.headerCenter}><strong>{entry === "create-rfx" ? "Create RFx" : perspective === "issuer" ? "Manage RFx" : "RFx response"}</strong><span>{atRoot ? `${rootProgress.percent}% complete` : node.label}</span></div>
          <div className={styles.headerActions}>
            <span className={saveState === "error" ? styles.saveError : styles.saveStatus}>{saveState === "saved" ? <Cloud size={15} /> : saveState === "offline" ? <HardDrive size={15} /> : saveState === "error" ? <WifiOff size={15} /> : <Save size={15} />}{saveLabel}</span>
            <button type="button" className={styles.iconButton} onClick={() => setContextPanel(contextPanel === "more" ? undefined : "more")} aria-label="More RFx actions" aria-expanded={contextPanel === "more"}><MoreHorizontal size={22} /></button>
            <button type="button" className={styles.iconButton} onClick={() => void saveAndExit()} aria-label="Save and close"><X size={22} /></button>
          </div>
        </header>

        {!atRoot ? <div className={styles.stageBar}><div style={{ width: `${rootProgress.percent}%` }} /></div> : null}

        {contextPanel === "more" ? <div className={styles.moreSheet}><button type="button" onClick={onOpenDetail}><Eye size={19} /><span>View RFx detail</span></button><button type="button" onClick={() => setContextPanel("match")}><Target size={19} /><span>Match context</span></button><button type="button" onClick={() => setContextPanel("refer")}><Users size={19} /><span>Refer organization</span></button><button type="button" onClick={onToggleWatch}>{record.saved ? <Check size={19} /> : <Save size={19} />}<span>{record.saved ? "Saved / watching" : "Save / watch"}</span></button></div> : null}
        {contextPanel === "match" ? <div className={styles.contextSheet}><div className={styles.sheetHeader}><strong>Match context</strong><button type="button" onClick={() => setContextPanel(undefined)}><X size={20} /></button></div><div className={styles.matchTiles}><div className={styles.matched}><strong>{breakdown.matched}</strong><span>Matched</span></div><div className={styles.confirm}><strong>{breakdown.confirm}</strong><span>Confirm</span></div><div className={styles.gap}><strong>{breakdown.gap}</strong><span>Gap</span></div></div><p>{detail?.match?.summary ?? "No structured match context is available."}</p><small>Discovery context only—not qualification or an award prediction.</small></div> : null}
        {contextPanel === "refer" ? <div className={styles.contextSheet}><div className={styles.sheetHeader}><strong>Refer from RFx context</strong><button type="button" onClick={() => setContextPanel(undefined)}><X size={20} /></button></div><MobileField field={rfxContextActionTree[2].fields![0]} value={workspace.values["contextReferral.organization"]} onChange={(value) => updateValue("contextReferral.organization", value)} onDictate={() => startDictation(rfxContextActionTree[2].fields![0])} dictating={dictatingFieldId === rfxContextActionTree[2].fields![0].id} /><MobileField field={rfxContextActionTree[2].fields![1]} value={workspace.values["contextReferral.note"]} onChange={(value) => updateValue("contextReferral.note", value)} onDictate={() => startDictation(rfxContextActionTree[2].fields![1])} dictating={dictatingFieldId === rfxContextActionTree[2].fields![1].id} /><button type="button" className={styles.primaryLarge} onClick={() => void createContextReferral()}>Create referral</button></div> : null}

        <main className={styles.body} key={node.id}>
          {!atRoot && !["hosted-submission", "external-submission"].includes(treatment) ? <div className={styles.taskHeading}><div><p className={styles.eyebrow}>{crumbs.slice(-2).map((crumb) => crumb.label).join(" · ")}</p><h2>{node.label}</h2><p>{node.description}</p></div>{currentFields.length > 1 ? <span className={styles.taskCount}>{fieldNumber} / {currentFields.length}</span> : null}</div> : null}
          {taskContent}
          {currentAttachments.length ? <section className={styles.attachments}><strong>Device attachments</strong>{currentAttachments.map((item) => <article key={item.id}><Paperclip size={18} /><span><strong>{item.label}</strong><small>{item.note}</small></span><button type="button" onClick={() => void removeAttachment(item)} aria-label={`Remove ${item.label}`}><X size={17} /></button></article>)}</section> : null}
          {message ? <div className={styles.message} role="status" aria-live="polite">{message}</div> : null}
        </main>

        {node.id === "publish" && !completionMoment ? <footer className={styles.commitFooter}><button type="button" onClick={() => void saveAndExit()}>Save & exit</button><button type="button" className={styles.primary} disabled={!publication.ready} onClick={() => void publishRfx()}><Send size={18} />Publish RFx</button></footer> : null}
        {completionMoment === "published" ? <div className={styles.successOverlay}><span><Check size={34} /></span><p className={styles.eyebrow}>Published</p><h2>Your RFx is live</h2><p>Discovery, matching, and the response timeline are now active for this workspace.</p><button type="button" className={styles.primaryLarge} onClick={onClose}>Return to Exchange</button></div> : null}
        {canShowTaskFooter ? <footer className={styles.footer}><button type="button" onClick={() => void saveAndExit()}>Save & exit</button>{node.children?.length ? <button type="button" className={styles.primary} onClick={() => { const next = node.children?.find((child) => !isNodeComplete(child, workspace)) ?? node.children?.[0]; if (next) openChild(next); }}>Continue<ChevronRight size={18} /></button> : node.kind === "list" ? null : <button type="button" className={styles.primary} onClick={nextFieldOrComplete}>{primaryLabel}<ChevronRight size={18} /></button>}</footer> : null}
      </section>
    </div>
  );
}
