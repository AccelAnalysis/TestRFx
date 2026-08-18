"use client";

import { useState } from "react";
import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import styles from "./capabilities.module.css";

const workflowCopy: Record<CapabilityWorkflowMode, { eyebrow: string; title: string; intro: string }> = {
  "manage-capabilities": { eyebrow: "Own organization", title: "Manage capabilities", intro: "Review the capability inventory that the signed-in organization exposes to the Exchange." },
  "ai-amacs": { eyebrow: "Own organization", title: "AI → AMACS mapping review", intro: "Use plain-language capability claims to review structured AMACS candidates. Suggestions remain suggestions until an authorized organization user accepts or changes them." },
  "capability-evidence": { eyebrow: "Own organization", title: "Capability evidence", intro: "Associate licenses, certifications, case studies, past performance, documents, and links with capability claims without treating uploaded evidence as independent verification." },
  "capability-gaps": { eyebrow: "Own organization", title: "Capability gaps", intro: "Surface profile gaps and requirement gaps, then use those gaps as a bridge back into Exchange discovery." },
  "publish-updates": { eyebrow: "Own organization", title: "Save / Publish updates", intro: "Complete the source-defined handoff that makes the organization capability profile available in the Exchange." },
  "match-rfx": { eyebrow: "Other organization", title: "Match to RFx", intro: "Compare this organization’s published capabilities against RFx requirements while preserving requirement-level gaps and uncertainty." },
  refer: { eyebrow: "Cross-lens workflow", title: "Refer this organization", intro: "Start a referral from capability context and hand execution to the shared referral engine." },
};

function ManageView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.capabilities.map((capability) => <article className={styles.panel} key={capability.id}><h3>{capability.name}</h3><p>{capability.description}</p><div className={styles.panelMeta}><span>{capability.publicationStatus}</span><span>{capability.mappingStatus} mapping</span><span>{capability.evidence.length} evidence</span></div></article>)}<div className={styles.boundary}>Add/edit commands still belong to the canonical capability repository; publication is a separate server-authoritative step.</div></div>;
}

function AmacsView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.capabilities.map((capability) => <article className={styles.panel} key={capability.id}><h3>{capability.name}</h3><p>{capability.amacsLabel ?? "No AMACS candidate is attached to this reference claim."}</p><div className={styles.panelMeta}><span>{capability.mappingStatus}</span><span>{capability.amacsNodeId ?? "unmapped"}</span></div></article>)}<div className={styles.boundary}>AMACS suggestions remain a taxonomy-service boundary; RFxchange must not silently convert an AI suggestion into organization-asserted truth.</div></div>;
}

function EvidenceView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.capabilities.map((capability) => <article className={styles.panel} key={capability.id}><h3>{capability.name}</h3>{capability.evidence.length ? <div className={styles.evidenceList}>{capability.evidence.map((item) => <span className={styles.evidenceItem} key={item.id}>{item.kind}: {item.label}</span>)}</div> : <p>No supporting evidence is attached yet.</p>}</article>)}<div className={styles.boundary}>Evidence upload remains behind object storage, metadata, authorization, visibility, and audit services. Evidence supports a claim; it does not automatically verify the claim.</div></div>;
}

function GapView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.gaps.length ? profile.gaps.map((gap) => <article className={styles.panel} key={gap.id}><h3>{gap.label}</h3><p>{gap.reason}</p><div className={styles.panelMeta}><span>Suggested Exchange search: {gap.suggestedSearch}</span></div></article>) : <div className={styles.empty}>No capability gaps are present in this profile.</div>}<div className={styles.boundary}>Gap actions feed Universal Search / RFx matching with preserved context.</div></div>;
}

function MatchView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.rfxMatches.length ? profile.rfxMatches.map((match) => <article className={styles.panel} key={match.id}><h3>{match.title}</h3><p>{match.issuer} · {match.summary}</p><div className={styles.panelMeta}><span className={match.coverage === "strong" ? styles.matchStrong : match.coverage === "partial" ? styles.matchPartial : styles.matchGap}>{match.coverage} coverage</span><span>{match.id}</span></div></article>) : <div className={styles.empty}>No RFx match is attached to this organization.</div>}<div className={styles.boundary}>The shared Match action now uses the canonical PostgreSQL matching service for durable decisions; this view preserves the richer requirement-level AMACS projection supplied by the Capabilities domain.</div></div>;
}

function ReferView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}><article className={styles.panel}><h3>Referral context</h3><p>Recipient: {profile.organizationName}</p><div className={styles.panelMeta}><span>source: capability profile</span><span>record: {profile.exchangeRecordId}</span></div></article><div className={styles.boundary}>Referral execution is owned by the shared server workflow and Menu owns ongoing referral management.</div></div>;
}

function PublishView({ profile }: { profile: CapabilityOrganizationProfile }) {
  const [status, setStatus] = useState<"idle" | "saving" | "published" | "error">("idle");
  const [message, setMessage] = useState("");
  async function publish() {
    setStatus("saving"); setMessage("");
    try {
      const response = await fetch("/api/exchange/capabilities/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recordId: profile.exchangeRecordId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Capability publication failed.");
      setStatus("published"); setMessage("Capability profile available in Exchange.");
    } catch (caught) { setStatus("error"); setMessage(caught instanceof Error ? caught.message : "Capability publication failed."); }
  }
  return <div className={styles.workflowGrid}><article className={styles.panel}><h3>Save / Publish updates</h3><p>Publish the current organization capability profile through the canonical capability and Exchange record repositories.</p><div className={styles.panelMeta}><span>{profile.exchangeRecordId}</span><span>{status}</span></div></article>{message ? <div className={styles.boundary} role={status === "error" ? "alert" : "status"}>{message}</div> : null}<button type="button" onClick={() => void publish()} disabled={status === "saving"}>{status === "saving" ? "Publishing…" : status === "published" ? "Published" : "Save / Publish updates"}</button></div>;
}

export function CapabilityWorkflowSurface({ profile, mode, onClose }: { profile: CapabilityOrganizationProfile; mode: CapabilityWorkflowMode; onClose: () => void; }) {
  const copy = workflowCopy[mode];
  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={copy.title}><header><button type="button" onClick={onClose}>← Back</button><span>CAPABILITIES WORKFLOW</span></header><div className="detail-hero record-media-capability"><p>{copy.eyebrow}</p><h1>{copy.title}</h1><span>{profile.organizationName}</span></div><div className="detail-body"><p className={styles.workflowIntro}>{copy.intro}</p>{mode === "manage-capabilities" ? <ManageView profile={profile} /> : null}{mode === "ai-amacs" ? <AmacsView profile={profile} /> : null}{mode === "capability-evidence" ? <EvidenceView profile={profile} /> : null}{mode === "capability-gaps" ? <GapView profile={profile} /> : null}{mode === "publish-updates" ? <PublishView profile={profile} /> : null}{mode === "match-rfx" ? <MatchView profile={profile} /> : null}{mode === "refer" ? <ReferView profile={profile} /> : null}</div></section>;
}
