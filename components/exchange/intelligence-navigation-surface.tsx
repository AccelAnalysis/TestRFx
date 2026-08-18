"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExchangeLens, ExchangeRecord } from "@/lib/exchange/contracts";
import { getIntelligenceNavigationNode, getIntelligenceNavigationPath, type IntelligenceMatchCandidate, type IntelligenceNavigationNode } from "@/lib/exchange/intelligence";
import { createIntelligenceReferral, getIntelligenceMatchCandidates, IntelligenceServiceError } from "@/lib/exchange/intelligence-client";
import { IntelligenceDetailContent } from "./intelligence-detail-content";

function nodeButton(node: IntelligenceNavigationNode, onNavigate: (id: string) => void) {
  return <button type="button" className="intelligence-nav-node" key={node.id} onClick={() => onNavigate(node.id)}>
    <span><strong>{node.label}</strong><small>{node.description}</small></span><span aria-hidden>›</span>
  </button>;
}

export function IntelligenceNavigationSurface({
  nodeId,
  record,
  refreshKey,
  onNavigate,
  onBack,
  onClose,
  onOpenEdit,
  onOpenMatch,
}: {
  nodeId: string;
  record?: ExchangeRecord;
  refreshKey?: number;
  onNavigate: (nodeId: string) => void;
  onBack: () => void;
  onClose: () => void;
  onOpenEdit: () => void;
  onOpenMatch: (lens: Extract<ExchangeLens, "rfx" | "capabilities">, recordId: string) => void;
}) {
  const node = getIntelligenceNavigationNode(nodeId);
  const path = useMemo(() => getIntelligenceNavigationPath(nodeId), [nodeId]);
  const [matches, setMatches] = useState<IntelligenceMatchCandidate[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState<string>();
  const [recipientOrganizationId, setRecipientOrganizationId] = useState("");
  const [referralNote, setReferralNote] = useState("");
  const [referralStatus, setReferralStatus] = useState<string>();
  const [creatingReferral, setCreatingReferral] = useState(false);

  const needsMatches = node?.outcomeAction === "matching" || node?.outcomeAction === "create-referral";
  const recipientOptions = useMemo(() => {
    const seen = new Set<string>();
    return matches.filter((match) => {
      if (seen.has(match.organizationId)) return false;
      seen.add(match.organizationId);
      return true;
    });
  }, [matches]);

  useEffect(() => {
    if (!needsMatches || !record) return;
    let cancelled = false;
    setLoadingMatches(true); setMatchError(undefined); setReferralStatus(undefined);
    getIntelligenceMatchCandidates(record.id)
      .then((next) => {
        if (cancelled) return;
        setMatches(next);
        setRecipientOrganizationId((current) => current || next[0]?.organizationId || "");
      })
      .catch((caught) => { if (!cancelled) setMatchError(caught instanceof IntelligenceServiceError ? caught.message : "Matching could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingMatches(false); });
    return () => { cancelled = true; };
  }, [needsMatches, record]);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (path.length > 1) onBack();
      else onClose();
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [path.length, onBack, onClose]);

  if (!node) return null;

  async function submitReferral(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !recipientOrganizationId || creatingReferral) return;
    setCreatingReferral(true); setMatchError(undefined); setReferralStatus(undefined);
    try {
      const result = await createIntelligenceReferral(record.id, { recipientOrganizationId, note: referralNote.trim() || undefined });
      setReferralStatus(`Referral ${result.referralId} created · ${result.status}`);
    } catch (caught) {
      setMatchError(caught instanceof IntelligenceServiceError ? caught.message : "The referral could not be created.");
    } finally {
      setCreatingReferral(false);
    }
  }

  return <section className="intelligence-nav-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="intelligence-nav-surface" role="dialog" aria-modal="true" aria-label={node.label}>
      <header className="intelligence-nav-header">
        <button type="button" onClick={path.length > 1 ? onBack : onClose} aria-label={path.length > 1 ? "Back one Intelligence level" : "Close Intelligence menu"}>←</button>
        <div><p className="eyebrow">Intelligence</p><h2>{node.label}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close Intelligence menu">×</button>
      </header>

      <nav className="intelligence-breadcrumbs" aria-label="Intelligence hierarchy">
        {path.map((item, index) => <span key={item.id}>{index ? <i aria-hidden>›</i> : null}<button type="button" onClick={() => onNavigate(item.id)} aria-current={item.id === node.id ? "page" : undefined}>{item.label}</button></span>)}
      </nav>

      <p className="intelligence-nav-description">{node.description}</p>
      {record ? <div className="intelligence-nav-subject"><small>Selected intelligence</small><strong>{record.title}</strong><span>{record.organization} · {record.geography}</span></div> : null}

      {node.kind === "root" || node.kind === "view" || node.kind === "result" || node.outcomeAction === "referral-trigger" ? <div className="intelligence-nav-list">{node.children?.map((child) => nodeButton(child, onNavigate))}</div> : null}

      {node.kind === "action" && node.id === "intelligence.own.edit" ? <div className="intelligence-nav-action"><p>Edit is a source-defined Menu action. The form writes through the authenticated Intelligence API and then advances to <strong>Insight record updated</strong>.</p><button className="workflow-primary" type="button" onClick={onOpenEdit} disabled={!record}>Edit Insight</button></div> : null}

      {node.kind === "action" && node.id === "intelligence.other.view" ? <div className="intelligence-nav-list">{node.children?.map((child) => nodeButton(child, onNavigate))}</div> : null}

      {node.kind === "result" && (node.id.endsWith("view.context") || node.id.endsWith("track.activity") || node.id.endsWith("follow.monitor")) && record ? <div className="intelligence-nav-detail"><IntelligenceDetailContent recordId={record.id} refreshKey={refreshKey} /></div> : null}

      {node.outcomeAction === "decision-support" && record ? <div className="intelligence-nav-detail"><IntelligenceDetailContent recordId={record.id} refreshKey={refreshKey} /></div> : null}

      {node.outcomeAction === "matching" ? <div className="intelligence-match-panel">
        {loadingMatches ? <div className="intelligence-service-state" role="status">Finding source-backed RFx and capability matches…</div> : null}
        {matchError ? <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Matching unavailable</strong><p>{matchError}</p></div> : null}
        {!loadingMatches && !matchError && matches.length === 0 ? <div className="intelligence-service-state"><strong>No relevant RFx or capability records found.</strong></div> : null}
        {matches.map((match) => <button key={`${match.lens}:${match.id}`} type="button" className="intelligence-match" onClick={() => onOpenMatch(match.lens, match.id)}><span><small>{match.lens === "rfx" ? "RFx" : "Capability"}</small><strong>{match.title}</strong><em>{match.organization} · {match.geography}</em>{match.reasons.length ? <i>{match.reasons.join(" · ")}</i> : null}</span><span aria-hidden>›</span></button>)}
      </div> : null}

      {node.outcomeAction === "create-referral" ? <form className="intelligence-referral-form" onSubmit={submitReferral}>
        {loadingMatches ? <div className="intelligence-service-state" role="status">Loading eligible organizations…</div> : null}
        {matchError ? <div className="intelligence-service-state intelligence-service-error" role="alert"><strong>Referral unavailable</strong><p>{matchError}</p></div> : null}
        {referralStatus ? <div className="intelligence-service-state intelligence-service-success" role="status"><strong>{referralStatus}</strong><p>The referral is now in the shared referral lifecycle.</p></div> : null}
        <label>Recipient organization<select required value={recipientOrganizationId} onChange={(event) => setRecipientOrganizationId(event.target.value)} disabled={loadingMatches || creatingReferral}>{recipientOptions.map((match) => <option key={match.organizationId} value={match.organizationId}>{match.organization}</option>)}</select></label>
        <label>Referral note (optional)<textarea rows={4} value={referralNote} onChange={(event) => setReferralNote(event.target.value)} /></label>
        <div className="workflow-actions"><button type="button" onClick={onBack} disabled={creatingReferral}>Cancel</button><button className="workflow-primary" type="submit" disabled={!recipientOrganizationId || creatingReferral}>{creatingReferral ? "Creating…" : "Create Referral"}</button></div>
      </form> : null}

      {node.outcomeAction === "return-exchange" ? <div className="intelligence-nav-action"><p>Your persisted tracking/follow state remains attached to the record. Closing this surface returns to the same map, result sheet, selection, search, and drawer state.</p><button className="workflow-primary" type="button" onClick={onClose}>Return to Exchange</button></div> : null}
    </div>
  </section>;
}
