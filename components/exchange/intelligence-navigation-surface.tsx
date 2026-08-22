"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { IntelligenceWorkflow } from "@/lib/exchange/intelligence-runtime";
import { getIntelligenceNavigationNode, getIntelligenceNavigationPath } from "@/lib/exchange/intelligence-runtime";
import { createIntelligenceReferral, getIntelligenceMatches, getIntelligenceReferralPolicy, searchIntelligenceReferralOrganizations, setIntelligenceTracking } from "@/lib/exchange/intelligence-client";
import { IntelligenceDetailContent } from "./intelligence-detail-content";

export function IntelligenceNavigationSurface({ nodeId, record, onNavigate, onBack, onClose, onRunWorkflow }: { nodeId: string; record?: ExchangeRecord; onNavigate: (nodeId: string) => void; onBack: () => void; onClose: () => void; onRunWorkflow: (workflow: IntelligenceWorkflow, record?: ExchangeRecord) => void; }) {
  const node = getIntelligenceNavigationNode(nodeId);
  const path = useMemo(() => getIntelligenceNavigationPath(nodeId), [nodeId]);
  const [matches, setMatches] = useState<Array<{ recordId: string; lens: "rfx" | "capabilities"; title: string; organization: string; reason: string }>>([]);
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [recipient, setRecipient] = useState<{ id: string; name: string }>();
  const [policy, setPolicy] = useState<{ published: boolean; active: boolean; policySummary: string | null; feeSummary: string | null }>();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (node?.outcomeAction !== "matching" || !record) return;
    let active = true; setPending(true); setMessage("");
    void getIntelligenceMatches(record.id).then((result) => { if (active) setMatches(result.matches); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Related records could not be loaded."); }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [node?.outcomeAction, record]);

  useEffect(() => {
    if (node?.outcomeAction !== "create-referral" || recipient || query.trim().length < 2) { setOrganizations([]); return; }
    let active = true; const timer = window.setTimeout(() => void searchIntelligenceReferralOrganizations(query.trim()).then((result) => { if (active) setOrganizations(result.organizations); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Organization search failed."); }), 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [node?.outcomeAction, query, recipient]);

  useEffect(() => {
    if (!recipient) { setPolicy(undefined); return; }
    let active = true; void getIntelligenceReferralPolicy(recipient.id).then((result) => { if (active) setPolicy(result.policy); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Referral policy could not be loaded."); });
    return () => { active = false; };
  }, [recipient]);

  if (!node) return null;
  async function track(mode: "track" | "follow", advance = false) { if (!record) return; setPending(true); setMessage(""); try { await setIntelligenceTracking(record.id, mode, true); setMessage(mode === "track" ? "Tracking enabled." : "Following enabled."); if (advance && node.children?.[0]) onNavigate(node.children[0].id); } catch (error) { setMessage(error instanceof Error ? error.message : "Tracking could not be updated."); } finally { setPending(false); } }
  async function refer() { if (!record || !recipient) return; setPending(true); setMessage(""); try { await createIntelligenceReferral(record.id, recipient.id, note); setMessage("Referral created in the shared referral lifecycle."); } catch (error) { setMessage(error instanceof Error ? error.message : "Referral could not be created."); } finally { setPending(false); } }

  const showChildren = node.kind === "root" || node.kind === "view" || node.kind === "result" || node.outcomeAction === "referral-trigger";
  const actionWorkflow: IntelligenceWorkflow | undefined = node.id === "intelligence.own.add" ? "add" : node.id === "intelligence.own.edit" ? "edit" : node.id === "intelligence.other.note" ? "note" : node.id === "intelligence.own.compare" || node.id === "intelligence.other.compare" ? "compare" : undefined;
  const directTrack = node.id === "intelligence.own.track" ? "track" : node.id === "intelligence.other.follow" ? "follow" : undefined;

  return <section className="intelligence-nav-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="intelligence-nav-surface" role="dialog" aria-modal="true" aria-label={node.label}>
    <header className="intelligence-nav-header"><button type="button" onClick={path.length > 1 ? onBack : onClose}>←</button><div><p className="eyebrow">Intelligence</p><h2>{node.label}</h2></div><button type="button" onClick={onClose}>×</button></header>
    <nav className="intelligence-breadcrumbs" aria-label="Intelligence hierarchy">{path.map((item, index) => <span key={item.id}>{index ? <i aria-hidden>›</i> : null}<button type="button" onClick={() => onNavigate(item.id)} aria-current={item.id === node.id ? "page" : undefined}>{item.label}</button></span>)}</nav>
    <p className="intelligence-nav-description">{node.description}</p>{record ? <div className="intelligence-nav-subject"><small>Selected intelligence</small><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}
    {showChildren ? <div className="intelligence-nav-list">{node.children?.map((child) => <button type="button" className="intelligence-nav-node" key={child.id} onClick={() => onNavigate(child.id)}><span><strong>{child.label}</strong><small>{child.description}</small></span><span aria-hidden>›</span></button>)}</div> : null}
    {actionWorkflow ? <div className="intelligence-nav-action"><button className="workflow-primary" type="button" disabled={actionWorkflow !== "add" && !record} onClick={() => onRunWorkflow(actionWorkflow, record)}>{node.label}</button></div> : null}
    {directTrack ? <div className="intelligence-nav-action"><button className="workflow-primary" type="button" disabled={!record || pending} onClick={() => void track(directTrack, true)}>{pending ? "Saving…" : node.label}</button></div> : null}
    {node.id === "intelligence.other.view" && record ? <button className="workflow-primary" type="button" onClick={() => onNavigate(node.children?.[0]?.id ?? node.id)}>View detail</button> : null}
    {(node.outcomeAction === "decision-support" || node.id.endsWith("view.context") || node.id.endsWith("track.activity") || node.id.endsWith("follow.monitor")) && record ? <IntelligenceDetailContent recordId={record.id} /> : null}
    {node.outcomeAction === "matching" ? <div className="intelligence-match-panel">{pending ? <p>Loading related records…</p> : null}{matches.map((match) => <div className="intelligence-match" key={`${match.lens}:${match.recordId}`}><span><small>{match.lens === "rfx" ? "RFx" : "Capability"}</small><strong>{match.title}</strong><em>{match.organization} · {match.reason}</em></span></div>)}{!pending && !matches.length ? <p>No explicit related RFx or capability records are recorded. RFxchange will not invent a match.</p> : null}</div> : null}
    {node.outcomeAction === "create-referral" ? <div className="intelligence-referral-form"><label>Receiving organization<input value={query} onChange={(event) => { setRecipient(undefined); setQuery(event.target.value); }} /></label>{organizations.map((organization) => <button type="button" key={organization.id} onClick={() => { setRecipient(organization); setQuery(organization.name); setOrganizations([]); }}>{organization.name}</button>)}{recipient ? <div className="provenance-panel"><strong>Referral policy</strong><p>{policy?.published ? policy.policySummary || "No additional policy text." : "No published policy or fee terms. None will be invented."}</p>{policy?.feeSummary ? <p>{policy.feeSummary}</p> : null}</div> : null}<label>Referral note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="workflow-primary" type="button" disabled={!recipient || pending || (policy?.published === true && !policy.active)} onClick={() => void refer()}>{pending ? "Creating…" : "Create Referral"}</button></div> : null}
    {node.outcomeAction === "return-exchange" && record ? <div className="intelligence-nav-action"><button className="workflow-primary" type="button" disabled={pending} onClick={() => void track(record.ownedByViewer ? "track" : "follow")}>{pending ? "Saving…" : record.ownedByViewer ? "Track intelligence" : "Follow intelligence"}</button><button type="button" onClick={onClose}>Return to Exchange</button></div> : null}
    {message ? <div className="intelligence-service-state" role="status">{message}</div> : null}
  </div></section>;
}
