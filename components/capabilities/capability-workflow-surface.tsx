"use client";

import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import styles from "./capabilities.module.css";

const workflowCopy: Record<CapabilityWorkflowMode, { eyebrow: string; title: string; intro: string }> = {
  "manage-capabilities": {
    eyebrow: "Own organization",
    title: "Manage capabilities",
    intro: "Review the capability inventory that the signed-in organization exposes to the Exchange. Production create/edit/publish writes plug into the canonical capability repository behind this surface.",
  },
  "ai-amacs": {
    eyebrow: "Own organization",
    title: "AI → AMACS mapping review",
    intro: "Use plain-language capability claims to review structured AMACS candidates. Suggestions remain suggestions until an authorized organization user accepts or changes them.",
  },
  "capability-evidence": {
    eyebrow: "Own organization",
    title: "Capability evidence",
    intro: "Associate licenses, certifications, case studies, past performance, documents, and links with capability claims without treating uploaded evidence as independent verification.",
  },
  "capability-gaps": {
    eyebrow: "Own organization",
    title: "Capability gaps",
    intro: "Surface profile gaps and requirement gaps, then use those gaps as a bridge back into Exchange discovery rather than turning Capabilities into a separate teaming application.",
  },
  "match-rfx": {
    eyebrow: "Other organization",
    title: "Match to RFx",
    intro: "Compare this organization’s published capabilities against RFx requirements while preserving requirement-level gaps and uncertainty.",
  },
  refer: {
    eyebrow: "Cross-lens workflow",
    title: "Refer this organization",
    intro: "Start a referral from capability context, but hand execution to the shared referral engine so referral management remains cross-lens and does not become another bottom-navigation lens.",
  },
};

function ManageView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      {profile.capabilities.map((capability) => (
        <article className={styles.panel} key={capability.id}>
          <h3>{capability.name}</h3>
          <p>{capability.description}</p>
          <div className={styles.panelMeta}>
            <span>{capability.publicationStatus}</span>
            <span>{capability.mappingStatus} mapping</span>
            <span>{capability.evidence.length} evidence</span>
          </div>
        </article>
      ))}
      <div className={styles.boundary}>Production add, edit, archive, and publish commands must be authorized server-side and persist to the same organization capability model initialized during onboarding.</div>
    </div>
  );
}

function AmacsView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      {profile.capabilities.map((capability) => (
        <article className={styles.panel} key={capability.id}>
          <h3>{capability.name}</h3>
          <p>{capability.amacsLabel ?? "No AMACS candidate is attached to this reference claim."}</p>
          <div className={styles.panelMeta}>
            <span>{capability.mappingStatus}</span>
            <span>{capability.amacsNodeId ?? "unmapped"}</span>
          </div>
        </article>
      ))}
      <div className={styles.boundary}>A production AMACS service should return candidates plus provenance. Authorized users accept, edit, or reject; RFxchange must not silently convert an AI suggestion into organization-asserted truth.</div>
    </div>
  );
}

function EvidenceView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      {profile.capabilities.map((capability) => (
        <article className={styles.panel} key={capability.id}>
          <h3>{capability.name}</h3>
          {capability.evidence.length ? (
            <div className={styles.evidenceList}>
              {capability.evidence.map((item) => <span className={styles.evidenceItem} key={item.id}>{item.kind}: {item.label}</span>)}
            </div>
          ) : <p>No supporting evidence is attached yet.</p>}
        </article>
      ))}
      <div className={styles.boundary}>Production evidence upload belongs behind object storage, metadata, authorization, visibility, and audit services. Evidence supports a claim; it does not automatically verify the claim.</div>
    </div>
  );
}

function GapView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      {profile.gaps.length ? profile.gaps.map((gap) => (
        <article className={styles.panel} key={gap.id}>
          <h3>{gap.label}</h3>
          <p>{gap.reason}</p>
          <div className={styles.panelMeta}><span>Suggested Exchange search: {gap.suggestedSearch}</span></div>
        </article>
      )) : <div className={styles.empty}>No capability gaps are present in this reference profile.</div>}
      <div className={styles.boundary}>Gap actions should feed Universal Search / RFx matching with preserved context so the user can find organizations that complement the missing capability.</div>
    </div>
  );
}

function MatchView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      {profile.rfxMatches.length ? profile.rfxMatches.map((match) => (
        <article className={styles.panel} key={match.id}>
          <h3>{match.title}</h3>
          <p>{match.issuer} · {match.summary}</p>
          <div className={styles.panelMeta}>
            <span className={match.coverage === "strong" ? styles.matchStrong : match.coverage === "partial" ? styles.matchPartial : styles.matchGap}>{match.coverage} coverage</span>
            <span>{match.id}</span>
          </div>
        </article>
      )) : <div className={styles.empty}>No deterministic RFx match is attached to this reference organization.</div>}
      <div className={styles.boundary}>Production matching should compare RFx requirement capabilities against organization capabilities through AMACS/semantic alignment and return aligned, partial, missing, and uncertain requirements—not a context-free score.</div>
    </div>
  );
}

function ReferView({ profile }: { profile: CapabilityOrganizationProfile }) {
  return (
    <div className={styles.workflowGrid}>
      <article className={styles.panel}>
        <h3>Referral context</h3>
        <p>Recipient: {profile.organizationName}</p>
        <div className={styles.panelMeta}>
          <span>source: capability profile</span>
          <span>record: {profile.exchangeRecordId}</span>
          <span>status: draft handoff</span>
        </div>
      </article>
      <article className={styles.panel}>
        <h3>Shared referral engine owns execution</h3>
        <p>The production workflow supplies sender organization, recipient organization, referenced entity, relationship context, terms, status, and audit trail. Menu owns ongoing referral management.</p>
      </article>
      <div className={styles.boundary}>This branch proves the Capabilities → Referral handoff contract only. It does not create referral, payment, or payout persistence.</div>
    </div>
  );
}

export function CapabilityWorkflowSurface({ profile, mode, onClose }: {
  profile: CapabilityOrganizationProfile;
  mode: CapabilityWorkflowMode;
  onClose: () => void;
}) {
  const copy = workflowCopy[mode];

  return (
    <section className="detail-surface" role="dialog" aria-modal="true" aria-label={copy.title}>
      <header><button type="button" onClick={onClose}>← Back</button><span>CAPABILITIES WORKFLOW</span></header>
      <div className="detail-hero record-media-capability">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span>{profile.organizationName}</span>
      </div>
      <div className="detail-body">
        <p className={styles.workflowIntro}>{copy.intro}</p>
        {mode === "manage-capabilities" ? <ManageView profile={profile} /> : null}
        {mode === "ai-amacs" ? <AmacsView profile={profile} /> : null}
        {mode === "capability-evidence" ? <EvidenceView profile={profile} /> : null}
        {mode === "capability-gaps" ? <GapView profile={profile} /> : null}
        {mode === "match-rfx" ? <MatchView profile={profile} /> : null}
        {mode === "refer" ? <ReferView profile={profile} /> : null}
      </div>
    </section>
  );
}
