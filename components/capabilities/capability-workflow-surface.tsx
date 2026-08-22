"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import type { CapabilityWorkflowMode } from "@/lib/capabilities/actions";
import { publishCapabilityProfile } from "@/lib/capabilities/service-client";
import { capabilityNavigationById, type CapabilityNavigationNodeId } from "@/lib/capabilities/navigation";
import {
  createSharedReferral,
  getSharedReferralPolicy,
  requestSharedMatch,
  searchSharedOrganizations,
  setSharedRelationship,
} from "@/lib/exchange/shared-workflow-client";
import { CapabilityHierarchy } from "./capability-hierarchy";
import styles from "./capabilities.module.css";

type MatchResult = {
  recordId: string;
  title: string;
  organization: string;
  coverage: "strong" | "partial" | "gap" | "uncertain";
  aligned: number;
  missing: number;
  uncertain: number;
  total: number;
  summary: string;
};

const modeNode: Record<CapabilityWorkflowMode, CapabilityNavigationNodeId> = {
  "manage-capabilities": "manage-capabilities",
  "ai-amacs": "ai-amacs",
  "capability-evidence": "capability-evidence",
  "capability-gaps": "capability-gaps",
  "match-rfx": "match-rfx",
  refer: "refer",
};

function Claims({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.capabilities.map((capability) => <article className={styles.panel} key={capability.id}>
    <h3>{capability.name}</h3><p>{capability.description}</p>
    <div className={styles.panelMeta}><span>{capability.publicationStatus}</span><span>{capability.mappingStatus} mapping</span><span>{capability.evidence.length} evidence</span></div>
  </article>)}</div>;
}

function Evidence({ profile }: { profile: CapabilityOrganizationProfile }) {
  return <div className={styles.workflowGrid}>{profile.capabilities.map((capability) => <article className={styles.panel} key={capability.id}>
    <h3>{capability.name}</h3>
    {capability.evidence.length ? <div className={styles.evidenceList}>{capability.evidence.map((item) => <span className={styles.evidenceItem} key={item.id}>{item.kind}: {item.label}</span>)}</div> : <p>No supporting evidence is recorded yet.</p>}
  </article>)}</div>;
}

function Referral({ profile }: { profile: CapabilityOrganizationProfile }) {
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [recipient, setRecipient] = useState<{ id: string; name: string }>();
  const [note, setNote] = useState("");
  const [policy, setPolicy] = useState<{ published: boolean; active: boolean; policySummary: string | null; feeSummary: string | null }>();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (recipient || query.trim().length < 2) { setOrganizations([]); return; }
    let active = true;
    const timer = window.setTimeout(() => void searchSharedOrganizations(query.trim()).then((result) => { if (active) setOrganizations(result.organizations); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Organization search failed."); }), 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, recipient]);

  useEffect(() => {
    if (!recipient) { setPolicy(undefined); return; }
    let active = true;
    void getSharedReferralPolicy(recipient.id).then((result) => { if (active) setPolicy(result.policy); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Referral policy could not be loaded."); });
    return () => { active = false; };
  }, [recipient]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!recipient) { setMessage("Choose a receiving organization."); return; }
    setPending(true); setMessage("");
    try {
      await createSharedReferral(profile.exchangeRecordId, recipient.id, note, "detail");
      setMessage("Referral created and available in Referrals Management.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Referral could not be created."); }
    finally { setPending(false); }
  }

  return <form className={styles.operationForm} onSubmit={submit}>
    <label>Receiving organization<input value={query} onChange={(event) => { setRecipient(undefined); setQuery(event.target.value); }} placeholder="Start typing an organization name…" /></label>
    {organizations.length ? <div className={styles.organizationOptions}>{organizations.map((organization) => <button type="button" key={organization.id} onClick={() => { setRecipient(organization); setQuery(organization.name); setOrganizations([]); }}><strong>{organization.name}</strong><span>Select</span></button>)}</div> : null}
    {recipient ? <div className={styles.policyCard}><strong>Referral policy</strong>{policy?.published ? <><p>{policy.policySummary || "No additional policy text published."}</p><small>{policy.feeSummary || "No published fee terms"}</small></> : <p>No published policy or fee terms. RFxchange will not invent them.</p>}</div> : null}
    <label>Referral note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add useful context for the recipient." /></label>
    <button className={styles.primaryAction} type="submit" disabled={pending || !recipient || (policy?.published === true && !policy.active)}>{pending ? "Creating…" : "Create referral"}</button>
    {message ? <p className={styles.operationMessage} role="status">{message}</p> : null}
  </form>;
}

export function CapabilityWorkflowSurface({ profile: initialProfile, mode, onClose, onProfileChange }: {
  profile: CapabilityOrganizationProfile;
  mode: CapabilityWorkflowMode;
  onClose: () => void;
  onProfileChange?: (profile: CapabilityOrganizationProfile) => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [activeNodeId, setActiveNodeId] = useState<CapabilityNavigationNodeId>(modeNode[mode]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const node = capabilityNavigationById[activeNodeId];
  const selectedOtherAvailable = !profile.ownedByViewer;
  const published = profile.capabilities.length > 0 && profile.capabilities.every((claim) => claim.publicationStatus === "published");

  useEffect(() => { setProfile(initialProfile); }, [initialProfile]);
  useEffect(() => { setActiveNodeId(modeNode[mode]); setMessage(""); setMatches([]); }, [mode]);

  const title = node?.label ?? "Capabilities";
  const eyebrow = profile.ownedByViewer ? "Own organization" : "Other organization";
  const canPublish = Boolean(profile.ownedByViewer && profile.capabilities.length);

  async function publish() {
    setPending(true); setMessage("");
    try {
      const result = await publishCapabilityProfile();
      setProfile(result.profile); onProfileChange?.(result.profile);
      setMessage("Capability profile published to the Exchange.");
      setActiveNodeId("exchange-available");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Capability profile could not be published."); }
    finally { setPending(false); }
  }

  async function follow() {
    if (profile.exchangeRecordId.startsWith("cap-draft-")) return;
    setPending(true); setMessage("");
    try {
      const active = !profile.saved;
      await setSharedRelationship(profile.exchangeRecordId, "following", active, "detail");
      const next = { ...profile, saved: active };
      setProfile(next); onProfileChange?.(next);
      setMessage(active ? "Organization capability profile is now followed." : "Stopped following this capability profile.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Follow state could not be updated."); }
    finally { setPending(false); }
  }

  async function match() {
    setPending(true); setMessage(""); setMatches([]);
    try {
      const result = await requestSharedMatch(profile.exchangeRecordId, "detail") as { matches: MatchResult[] };
      setMatches(result.matches ?? []);
      if (!result.matches?.length) setMessage("No open RFx records currently have structured requirements available for comparison.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "RFx matching could not be completed."); }
    finally { setPending(false); }
  }

  function renderNode() {
    if (activeNodeId === "manage-capabilities" || activeNodeId === "current-profile") return <><Claims profile={profile} /><Link className={styles.primaryLink} href="/onboarding/capabilities">Edit capability claims</Link></>;
    if (activeNodeId === "ai-amacs") return <><Claims profile={profile} /><Link className={styles.primaryLink} href="/onboarding/capabilities?stage=amacs">Review AMACS mappings</Link></>;
    if (activeNodeId === "capability-evidence" || activeNodeId === "capability-detail") return <><Evidence profile={profile} />{profile.ownedByViewer ? <Link className={styles.primaryLink} href="/onboarding/capabilities?stage=evidence">Manage evidence</Link> : null}</>;
    if (activeNodeId === "capability-gaps") return <div className={styles.workflowGrid}>{profile.gaps.length ? profile.gaps.map((gap) => <article className={styles.panel} key={gap.id}><h3>{gap.label}</h3><p>{gap.reason}</p><div className={styles.panelMeta}><span>{gap.suggestedSearch}</span></div></article>) : <div className={styles.empty}>No profile-quality gaps are currently derived from the canonical capability state.</div>}</div>;
    if (activeNodeId === "save-publish") return <div className={styles.operationCard}><strong>{published ? "Published" : "Ready to publish"}</strong><p>Publishing makes the current canonical claims, accepted AMACS mappings, evidence summary, and organization media available through the Exchange projection.</p><button className={styles.primaryAction} type="button" disabled={!canPublish || pending} onClick={() => void publish()}>{pending ? "Publishing…" : "Publish capability profile"}</button></div>;
    if (activeNodeId === "exchange-available") return <div className={styles.operationCard}><strong>{published ? "Capability profile is available in the Exchange" : "Capability projection is not published yet"}</strong><p>Canonical capability assertions remain editable after publication; republishing refreshes the Exchange projection without creating a second capability truth.</p></div>;
    if (activeNodeId === "match-rfx") return <div className={styles.workflowGrid}><button className={styles.primaryAction} type="button" disabled={pending || profile.exchangeRecordId.startsWith("cap-draft-")} onClick={() => void match()}>{pending ? "Comparing…" : "Compare with open RFx requirements"}</button>{matches.map((item) => <article className={styles.panel} key={item.recordId}><h3>{item.title}</h3><p>{item.organization} · {item.summary}</p><div className={styles.panelMeta}><span className={item.coverage === "strong" ? styles.matchStrong : item.coverage === "partial" ? styles.matchPartial : styles.matchGap}>{item.coverage}</span><span>{item.aligned}/{item.total} aligned</span></div></article>)}</div>;
    if (activeNodeId === "decide-next-action") return <div className={styles.actionChoice}><button type="button" onClick={() => setActiveNodeId("refer")}>Refer</button><button type="button" onClick={() => setActiveNodeId("save-follow")}>Save / Follow</button><button type="button" onClick={() => setActiveNodeId("open-detail")}>Open detail</button></div>;
    if (activeNodeId === "refer" || activeNodeId === "cross-lens-referral") return <Referral profile={profile} />;
    if (activeNodeId === "save-follow" || activeNodeId === "saved-organizations") return <div className={styles.operationCard}><strong>{profile.saved ? "Following" : "Not followed"}</strong><p>Follow is stored in the same cross-lens relationship service used by Resources and Intelligence.</p><button className={styles.primaryAction} type="button" disabled={pending || profile.exchangeRecordId.startsWith("cap-draft-")} onClick={() => void follow()}>{pending ? "Saving…" : profile.saved ? "Stop following" : "Follow capability profile"}</button></div>;
    if (activeNodeId === "open-detail" || activeNodeId === "view-capabilities") return <Claims profile={profile} />;
    return <div className={styles.operationCard}><strong>{title}</strong><p>{node?.description}</p></div>;
  }

  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={title}>
    <header><button type="button" onClick={onClose}>← Back</button><span>CAPABILITIES</span></header>
    <div className="detail-hero record-media-capability"><p>{eyebrow}</p><h1>{title}</h1><span>{profile.organizationName}</span></div>
    <div className="detail-body">
      <div className={styles.workflowLayout}>
        <CapabilityHierarchy activeNodeId={activeNodeId} selectedOtherAvailable={selectedOtherAvailable} onNavigate={setActiveNodeId} />
        <div className={styles.workflowMain}>
          <p className={styles.workflowIntro}>{node?.description}</p>
          {renderNode()}
          {message ? <p className={styles.operationMessage} role="status">{message}</p> : null}
        </div>
      </div>
    </div>
  </section>;
}
