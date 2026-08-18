"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ExchangeLens, ExchangeRecord } from "@/lib/exchange/contracts";
import type { RfxWorkflowEntry, RfxWorkflowField, RfxWorkflowNode, RfxWorkspace, RfxWorkspaceEnvelope, RfxWorkspaceValue } from "@/lib/rfx/contracts";
import { getRfxDetail } from "@/lib/rfx/catalog";
import { findWorkflowNode, perspectiveForEntry, rfxContextActionTree, workflowBreadcrumbs, workflowTreeFor } from "@/lib/rfx/workflow-tree";
import { completeWorkspaceNode, setPursuitState, setRfxStatus, setWorkspaceValues } from "@/lib/rfx/workspace";
import { loadRfxWorkspace, saveRfxWorkspace } from "@/lib/rfx/workspace-client";
import styles from "./rfx-workflow-surface.module.css";

function valueAsString(value: RfxWorkspaceValue | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function requiredFieldsComplete(node: RfxWorkflowNode, workspace: RfxWorkspace) {
  return (node.fields ?? []).filter((field) => field.required).every((field) => valueAsString(workspace.values[field.id]).trim());
}

function Field({ field, value, onChange }: { field: RfxWorkflowField; value: RfxWorkspaceValue | undefined; onChange: (value: RfxWorkspaceValue) => void }) {
  if (field.type === "textarea") return <label className={styles.field}><span>{field.label}{field.required ? " *" : ""}</span><textarea value={valueAsString(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />{field.help ? <small>{field.help}</small> : null}</label>;
  if (field.type === "select") return <label className={styles.field}><span>{field.label}{field.required ? " *" : ""}</span><select value={valueAsString(value)} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select>{field.help ? <small>{field.help}</small> : null}</label>;
  if (field.type === "boolean") return <label className={styles.checkField}><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  return <label className={styles.field}><span>{field.label}{field.required ? " *" : ""}</span><input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={valueAsString(value)} placeholder={field.placeholder} onChange={(event) => onChange(field.type === "number" && event.target.value ? Number(event.target.value) : event.target.value)} />{field.help ? <small>{field.help}</small> : null}</label>;
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
  const [envelope, setEnvelope] = useState<RfxWorkspaceEnvelope>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [contextAction, setContextAction] = useState<"match" | "refer" | undefined>();
  const detail = getRfxDetail(record.id);

  useEffect(() => {
    let active = true;
    void loadRfxWorkspace(record.id, entry).then((loaded) => { if (active) setEnvelope(loaded); });
    return () => { active = false; };
  }, [record.id, entry]);

  const workspace = envelope?.workspace;
  const node = workspace ? findWorkflowNode(tree, workspace.activePath) : undefined;
  const crumbs = workspace ? workflowBreadcrumbs(tree, workspace.activePath) : [];

  async function persist(next: RfxWorkspace, success = "Saved") {
    if (!envelope) return;
    setSaving(true);
    const saved = await saveRfxWorkspace(next, envelope.persistence);
    setEnvelope(saved);
    setSaving(false);
    setMessage(`${success} · ${saved.persistence === "postgres" ? "shared Postgres workspace" : "saved on this device"}`);
  }

  function updateValue(id: string, value: RfxWorkspaceValue) {
    if (!workspace || !envelope) return;
    setEnvelope({ ...envelope, workspace: setWorkspaceValues(workspace, { [id]: value }) });
  }

  async function navigate(path: string[]) {
    if (!workspace || !envelope) return;
    const next = { ...workspace, activePath: path, updatedAt: new Date().toISOString() };
    setEnvelope({ ...envelope, workspace: next });
    setMessage("");
    const saved = await saveRfxWorkspace(next, envelope.persistence);
    setEnvelope(saved);
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

  async function addListItem(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !node || !requiredFieldsComplete(node, workspace)) { setMessage("Complete the required fields before adding this item."); return; }
    const fields = node.fields ?? [];
    const label = valueAsString(workspace.values[fields[0]?.id]) || node.label;
    const note = fields.slice(1).map((field) => valueAsString(workspace.values[field.id])).filter(Boolean).join(" · ");
    const item = { id: `${node.id}-${Date.now()}`, nodeId: node.id, label, note: note || undefined, createdAt: new Date().toISOString() };
    let next: RfxWorkspace = { ...workspace, items: [...workspace.items, item], version: workspace.version + 1, updatedAt: new Date().toISOString() };
    if (node.id === "participate") next = setPursuitState(next, "teaming");
    const clear = Object.fromEntries(fields.map((field) => [field.id, null])) as Record<string, RfxWorkspaceValue>;
    next = setWorkspaceValues(next, clear);
    await persist(next, "Item added");
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
    if (current.id === "hosted-submission" && valueAsString(next.values["submission.hostedDecision"]) === "Submit final response") {
      next = setPursuitState(next, "submitted");
      next = { ...next, items: [...next.items, { id: `submission-receipt-${Date.now()}`, nodeId: "submission-receipt", label: `RFxchange submission v${next.version}`, status: "submitted", createdAt: new Date().toISOString() }] };
    }
    if (current.id === "clarify" && perspective === "responder") next = setPursuitState(next, "clarification");
    if (current.id === "execute") next = setPursuitState(next, "executing");
    if (current.id === "report-outcome") next = setPursuitState(next, "outcome-reported");
    if (current.id === "publication-readiness") next = setRfxStatus(next, "ready");
    if (current.id === "publish" && valueAsString(next.values["publish.confirmation"]) === "Publish RFx") next = setRfxStatus(next, "open");
    if (current.id === "draft-save-publish") {
      const action = valueAsString(next.values["manage.lifecycleAction"]);
      if (action === "Save draft") next = setRfxStatus(next, "draft");
      if (action === "Publish" || action === "Update published RFx") next = setRfxStatus(next, "open");
    }
    if (current.id === "evaluation") next = setRfxStatus(next, "evaluation");
    if (current.id === "clarification" && perspective === "issuer") next = setRfxStatus(next, "clarification");
    if (current.id === "close") {
      const close = valueAsString(next.values["decision.close"]);
      if (close === "Close RFx") next = setRfxStatus(next, "closed");
      if (close === "Cancel RFx") next = setRfxStatus(next, "cancelled");
    }
    if (current.id === "select-award-connect") next = setRfxStatus(next, "selected");
    if (current.id === "advance") {
      const advance = valueAsString(next.values["decision.advance"]);
      if (advance === "Evaluation") next = setRfxStatus(next, "evaluation");
      if (advance === "Clarification") next = setRfxStatus(next, "clarification");
      if (advance === "Selected / awarded") next = setRfxStatus(next, "awarded");
      if (advance === "Execution / relationship") next = setRfxStatus(next, "executing");
      if (advance === "Completed") next = setRfxStatus(next, "completed");
    }
    if (current.id === "completed") next = setRfxStatus(next, "completed");
    return next;
  }

  async function completeCurrent() {
    if (!workspace || !node) return;
    if (node.fields?.length && !requiredFieldsComplete(node, workspace)) { setMessage("Complete the required fields before marking this workflow step complete."); return; }
    let next = completeWorkspaceNode(workspace, node.id);
    next = deriveState(next, node);
    await persist(next, "Workflow step completed");
  }

  async function toggleChecklist(index: number) {
    if (!workspace || !node) return;
    const key = `check:${node.id}:${index}`;
    const next = setWorkspaceValues(workspace, { [key]: !Boolean(workspace.values[key]) });
    await persist(next, "Checklist updated");
  }

  async function createContextReferral() {
    if (!workspace) return;
    const organization = valueAsString(workspace.values["contextReferral.organization"]).trim();
    if (!organization) { setMessage("Choose or enter the organization to refer."); return; }
    const item = { id: `context-refer-${Date.now()}`, nodeId: "context-refer", label: organization, note: valueAsString(workspace.values["contextReferral.note"]) || undefined, status: "created", createdAt: new Date().toISOString() };
    await persist({ ...workspace, items: [...workspace.items, item], version: workspace.version + 1, updatedAt: new Date().toISOString() }, "Referral created in this RFx workspace");
    setContextAction(undefined);
  }

  async function shareInvitation() {
    const url = `${window.location.origin}/exchange/rfx/${record.id}`;
    const text = `RFx collaboration: ${record.title}`;
    try {
      if (navigator.share) await navigator.share({ title: record.title, text, url });
      else await navigator.clipboard.writeText(url);
      setMessage("RFx collaboration link shared or copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The collaboration link could not be shared from this device.");
    }
  }

  async function handoff(current: RfxWorkflowNode) {
    if (!workspace) return;
    if (current.fields?.length && !requiredFieldsComplete(current, workspace)) { setMessage("Complete the required handoff fields before continuing."); return; }
    let next = completeWorkspaceNode(workspace, current.id);
    if (current.handoff === "referrals") {
      const fields = current.fields ?? [];
      const organization = valueAsString(workspace.values[fields[0]?.id]).trim();
      const note = fields[1] ? valueAsString(workspace.values[fields[1].id]) : "";
      if (organization) next = { ...next, items: [...next.items, { id: `refer-${Date.now()}`, nodeId: current.id, label: organization, note: note || undefined, status: "created", createdAt: new Date().toISOString() }] };
      await persist(next, "Referral context saved");
      onOpenMenu();
      return;
    }
    if (current.handoff === "external-submission") {
      const reference = valueAsString(workspace.values["submission.externalReference"]).trim();
      if (!reference) { setMessage("Enter the external confirmation or reference after submitting in the issuer system."); return; }
      next = setPursuitState(next, "submitted");
      next = { ...next, items: [...next.items, { id: `external-submission-${Date.now()}`, nodeId: current.id, label: reference, status: "externally-confirmed", createdAt: new Date().toISOString() }] };
      await persist(next, "External submission confirmation recorded");
      return;
    }
    await persist(next, "RFx context saved before handoff");
    if (current.handoff === "capabilities") onLensHandoff("capabilities");
    if (current.handoff === "resources") onLensHandoff("resources");
  }

  if (!workspace || !node) return <div className={styles.backdrop}><section className={styles.panel}><div className={styles.loading}>Loading RFx workspace…</div></section></div>;

  const nodeItems = workspace.items.filter((item) => item.nodeId === node.id);
  const isComplete = workspace.completedNodeIds.includes(node.id);

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={`${node.label} RFx workflow`}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>{perspective === "issuer" ? "Issuer RFx" : "Responder RFx"}</p><h2>{record.title}</h2><span>{record.organization} · {record.geography}</span></div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close RFx workflow">×</button>
        </header>

        <div className={styles.contextRail} aria-label="RFx context actions">
          <button type="button" onClick={onOpenDetail}>View</button>
          <button type="button" onClick={() => setContextAction(contextAction === "match" ? undefined : "match")}>Match</button>
          <button type="button" onClick={() => setContextAction(contextAction === "refer" ? undefined : "refer")}>Refer</button>
          <button type="button" className={record.saved ? styles.active : ""} onClick={onToggleWatch}>{record.saved ? "Saved" : "Save"}</button>
        </div>

        {contextAction === "match" ? <div className={styles.contextPanel}><strong>Match context</strong>{detail?.match ? <><p>{detail.match.summary}</p><small>{detail.match.matched} of {detail.match.total} requirements represented · geography {detail.match.geographyMatched ? "aligned" : "not established"}</small></> : <p>No structured match context is available for this RFx.</p>}<p className={styles.boundary}>Match context supports discovery only. It is not qualification, endorsement, eligibility, or award prediction.</p></div> : null}
        {contextAction === "refer" ? <div className={styles.contextPanel}><strong>Refer from RFx context</strong><Field field={rfxContextActionTree[2].fields![0]} value={workspace.values["contextReferral.organization"]} onChange={(value) => updateValue("contextReferral.organization", value)} /><Field field={rfxContextActionTree[2].fields![1]} value={workspace.values["contextReferral.note"]} onChange={(value) => updateValue("contextReferral.note", value)} /><div className={styles.actions}><button type="button" className={styles.primary} onClick={() => void createContextReferral()}>Create referral</button><button type="button" onClick={onOpenMenu}>Open Referrals Management</button></div></div> : null}

        <nav className={styles.breadcrumbs} aria-label="RFx workflow location">
          <button type="button" onClick={goBack}>←</button>
          {crumbs.map((crumb, index) => <button key={`${crumb.id}-${index}`} type="button" className={index === crumbs.length - 1 ? styles.currentCrumb : ""} onClick={() => void navigate(workspace.activePath.slice(0, index + 1))}>{crumb.label}</button>)}
        </nav>

        <div className={styles.workspaceMeta}><span>{envelope.persistence === "postgres" ? "Shared Postgres workspace" : "Local device workspace"}</span><span>v{workspace.version}</span>{workspace.pursuitState ? <span>Pursuit: {workspace.pursuitState}</span> : null}{workspace.rfxStatus ? <span>RFx: {workspace.rfxStatus}</span> : null}</div>

        <main className={styles.body}>
          <div className={styles.titleRow}><div><p className={styles.eyebrow}>{node.kind}</p><h3>{node.label}</h3><p>{node.description}</p></div>{isComplete ? <span className={styles.complete}>Complete</span> : null}</div>

          {node.children?.length ? <div className={styles.childGrid}>{node.children.map((child) => <button key={child.id} type="button" className={styles.childCard} onClick={() => openChild(child)}><div><strong>{child.label}</strong><p>{child.description}</p></div><span>›</span></button>)}</div> : null}

          {!node.children?.length && node.kind === "list" && node.fields?.length ? <form className={styles.form} onSubmit={(event) => void addListItem(event)}>{node.fields.map((field) => <Field key={field.id} field={field} value={workspace.values[field.id]} onChange={(value) => updateValue(field.id, value)} />)}<button className={styles.primary} type="submit" disabled={saving}>Add item</button>{nodeItems.length ? <div className={styles.items}>{nodeItems.map((item) => <article key={item.id}><strong>{item.label}</strong>{item.note ? <small>{item.note}</small> : null}</article>)}</div> : null}</form> : null}
          {!node.children?.length && node.kind === "list" && !node.fields?.length ? <div className={styles.items}>{nodeItems.length ? nodeItems.map((item) => <article key={item.id}><strong>{item.label}</strong>{item.note ? <small>{item.note}</small> : null}</article>) : <article><strong>No records yet</strong><small>This list will populate from the RFx transaction workspace as activity occurs.</small></article>}</div> : null}

          {!node.children?.length && node.kind !== "list" && node.fields?.length ? <div className={styles.form}>{node.fields.map((field) => <Field key={field.id} field={field} value={workspace.values[field.id]} onChange={(value) => updateValue(field.id, value)} />)}</div> : null}

          {!node.children?.length && node.checklist?.length ? <div className={styles.checklist}>{node.checklist.map((item, index) => <label key={item}><input type="checkbox" checked={Boolean(workspace.values[`check:${node.id}:${index}`])} onChange={() => void toggleChecklist(index)} /><span>{item}</span></label>)}</div> : null}

          {!node.children?.length && node.kind === "review" ? <div className={styles.review}><strong>Current RFx context</strong><p>{detail?.scope ?? record.summary}</p><div className={styles.reviewGrid}><span>Type: {detail?.rfxType ?? "RFx"}</span><span>Status: {workspace.rfxStatus ?? detail?.status ?? "open"}</span><span>Geography: {detail?.performanceGeography ?? record.geography}</span><span>Requirements: {detail?.requirements.length ?? 0}</span></div></div> : null}

          {!node.children?.length && node.kind === "status" ? <div className={styles.review}><strong>Current state</strong>{workspace.pursuitState ? <p>Pursuit: {workspace.pursuitState}</p> : null}{workspace.rfxStatus ? <p>RFx: {workspace.rfxStatus}</p> : null}<p>{detail?.match?.summary ?? node.description}</p>{node.id === "outcome" ? <div className={styles.badges}>{[record.saved ? "Saved" : null, workspace.pursuitState === "submitted" ? "Submitted" : null, workspace.pursuitState === "teaming" ? "Teamed" : null, workspace.items.some((item) => item.nodeId.includes("refer")) ? "Referred" : null].filter(Boolean).map((state) => <span key={state}>{state}</span>)}</div> : null}</div> : null}

          {!node.children?.length && node.kind === "handoff" ? <div className={styles.handoff}><strong>{node.label}</strong><p>{node.description}</p>{node.fields?.map((field) => <Field key={field.id} field={field} value={workspace.values[field.id]} onChange={(value) => updateValue(field.id, value)} />)}<button type="button" className={styles.primary} onClick={() => void handoff(node)}>{node.handoff === "capabilities" ? "Open Capabilities" : node.handoff === "resources" ? "Open Resources" : node.handoff === "referrals" ? "Save referral & open management" : "Record external confirmation"}</button></div> : null}

          {(node.id === "invite" || node.id === "internal-collaborators" || node.id === "invite-team") ? <button type="button" className={styles.secondary} onClick={() => void shareInvitation()}>Share RFx collaboration link</button> : null}

          {!node.children?.length && node.kind !== "list" && node.kind !== "handoff" ? <div className={styles.actions}><button type="button" className={styles.primary} disabled={saving} onClick={() => void completeCurrent()}>{saving ? "Saving…" : isComplete ? "Save changes" : "Save & complete step"}</button></div> : null}
        </main>

        <footer className={styles.footer}><span>{message || "Changes are persisted as you move through the RFx workflow."}</span><button type="button" onClick={onClose}>Return to Exchange</button></footer>
      </section>
    </div>
  );
}
