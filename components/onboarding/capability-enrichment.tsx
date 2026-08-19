"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./capability-enrichment.module.css";
import {
  CAPABILITY_ENRICHMENT_LEAF_PATHS,
  CAPABILITY_ENRICHMENT_TREE,
  capabilityWorkflowHref,
  getCapabilityWorkflowSection,
  getCapabilityWorkflowTask,
  type AmacsCandidate,
  type CapabilityEnrichmentSnapshot,
  type CapabilityEvidenceKind,
} from "@/lib/onboarding/capability-enrichment";

interface Props {
  path: string[];
  organizationId?: string;
}

interface ServiceStatus {
  busy: boolean;
  message?: string;
  error?: string;
}

type InterpretationCandidate = AmacsCandidate & { confidence?: number; rationale?: string };

const evidenceKindByTask: Record<string, CapabilityEvidenceKind> = {
  certifications: "certification",
  licenses: "license",
  "case-studies": "case-study",
  "supporting-documents": "supporting-document",
};

function splitTerms(value: string) {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
}

export default function CapabilityEnrichment({ path, organizationId }: Props) {
  const [snapshot, setSnapshot] = useState<CapabilityEnrichmentSnapshot>();
  const [status, setStatus] = useState<ServiceStatus>({ busy: false });
  const section = getCapabilityWorkflowSection(path[0]);
  const task = getCapabilityWorkflowTask(path[0], path[1]);
  const currentLeaf = path.length === 2 ? path.join("/") : undefined;

  const load = useCallback(async () => {
    if (!organizationId) return;
    setStatus((current) => ({ ...current, busy: true, error: undefined }));
    try {
      const response = await fetch(`/api/onboarding/capabilities?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const body = await response.json() as CapabilityEnrichmentSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Capability service returned ${response.status}.`);
      setSnapshot(body);
      setStatus({ busy: false });
    } catch (error) {
      setSnapshot(undefined);
      setStatus({ busy: false, error: error instanceof Error ? error.message : "Capability service unavailable." });
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function postAction(payload: Record<string, unknown>, successMessage: string, completeLeaf = true) {
    if (!organizationId) {
      setStatus({ busy: false, error: "Complete organization selection/profile first so capability records have a canonical organization owner." });
      return false;
    }
    setStatus({ busy: true });
    try {
      const response = await fetch("/api/onboarding/capabilities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, organizationId }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Capability service returned ${response.status}.`);
      if (completeLeaf && currentLeaf) {
        const progress = await fetch("/api/onboarding/capabilities", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "save-progress", organizationId, path, completedLeafPath: currentLeaf }),
        });
        if (!progress.ok) {
          const progressBody = await progress.json() as { error?: string };
          throw new Error(progressBody.error ?? "The record saved, but onboarding progress could not be persisted.");
        }
      }
      await load();
      setStatus({ busy: false, message: successMessage });
      return true;
    } catch (error) {
      setStatus({ busy: false, error: error instanceof Error ? error.message : "Unable to save." });
      return false;
    }
  }

  const nextLeafHref = useMemo(() => {
    if (!currentLeaf) return undefined;
    const index = CAPABILITY_ENRICHMENT_LEAF_PATHS.findIndex(([sectionId, taskId]) => `${sectionId}/${taskId}` === currentLeaf);
    const next = CAPABILITY_ENRICHMENT_LEAF_PATHS[index + 1];
    return next ? capabilityWorkflowHref([...next], organizationId) : undefined;
  }, [currentLeaf, organizationId]);

  return (
    <main className={styles.shell}>
      <header className={styles.topBar}>
        <Link href="/onboarding">← Onboarding</Link>
        <strong>RFxchange</strong>
        <span>Capability Enrichment</span>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Identity &amp; Onboarding</p>
          <h1>Capability Enrichment</h1>
          <p className={styles.sidebarCopy}>Progressive enrichment. The source-defined branches can be revisited and expanded anytime.</p>
          <Link className={styles.rootLink} href={capabilityWorkflowHref([], organizationId)}>Capability Enrichment overview</Link>
          <nav aria-label="Capability Enrichment hierarchy" className={styles.treeNav}>
            {CAPABILITY_ENRICHMENT_TREE.map((item) => {
              const active = section?.id === item.id;
              const completed = item.children.filter((child) => snapshot?.progress.completedLeafPaths.includes(`${item.id}/${child.id}`)).length;
              return (
                <div className={styles.treeBranch} key={item.id}>
                  <Link className={active ? styles.activeBranch : ""} href={capabilityWorkflowHref([item.id], organizationId)}>
                    <span>{completed}/{item.children.length}</span>
                    <strong>{item.label}</strong>
                  </Link>
                  {active && (
                    <div className={styles.treeChildren}>
                      {item.children.map((child) => {
                        const childActive = task?.id === child.id;
                        const childComplete = snapshot?.progress.completedLeafPaths.includes(`${item.id}/${child.id}`);
                        return (
                          <Link key={child.id} className={childActive ? styles.activeChild : ""} href={capabilityWorkflowHref([item.id, child.id], organizationId)}>
                            <span>{childComplete ? "✓" : "•"}</span>{child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <section className={styles.workspace}>
          <Breadcrumbs path={path} organizationId={organizationId} />
          {!organizationId && <ServiceGate message="Capability Enrichment needs the organization created/selected earlier in onboarding. No reference organization is substituted." />}
          {organizationId && status.error && <ServiceGate message={status.error} />}
          {status.message && <div className={styles.success} role="status">{status.message}</div>}
          {status.busy && <div className={styles.loading} role="status">Saving or loading canonical data…</div>}

          {path.length === 0 && <Overview snapshot={snapshot} organizationId={organizationId} />}
          {path.length === 1 && section && <SectionOverview section={section} snapshot={snapshot} organizationId={organizationId} />}
          {path.length === 2 && section && task && (
            <WorkflowLeaf
              sectionId={section.id}
              taskId={task.id}
              organizationId={organizationId}
              snapshot={snapshot}
              postAction={postAction}
              setStatus={setStatus}
            />
          )}

          <footer className={styles.workflowFooter}>
            {path.length === 2 && nextLeafHref && <Link href={nextLeafHref}>Next source-defined task →</Link>}
            {path.length === 2 && !nextLeafHref && <Link className={styles.primaryLink} href={`/onboarding/completion${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`}>Continue to Review &amp; Completion Checkpoint →</Link>}
          </footer>
        </section>
      </div>
    </main>
  );
}

function Breadcrumbs({ path, organizationId }: Props) {
  const section = getCapabilityWorkflowSection(path[0]);
  const task = getCapabilityWorkflowTask(path[0], path[1]);
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <Link href={capabilityWorkflowHref([], organizationId)}>Capability Enrichment</Link>
      {section && <><span>›</span><Link href={capabilityWorkflowHref([section.id], organizationId)}>{section.label}</Link></>}
      {task && <><span>›</span><strong>{task.label}</strong></>}
    </nav>
  );
}

function Overview({ snapshot, organizationId }: { snapshot?: CapabilityEnrichmentSnapshot; organizationId?: string }) {
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Organization / Capabilities Enrichment (Multi-Step)</p>
      <h2>Build the organization’s capability identity</h2>
      <p className={styles.lead}>The hierarchy below mirrors the source flow. Review/completion is deliberately outside this module and follows after the six enrichment branches.</p>
      {snapshot && (
        <div className={styles.contextStrip}>
          <div><span>Organization</span><strong>{snapshot.organization.organizationName}</strong></div>
          <div><span>Capability claims</span><strong>{snapshot.claims.length}</strong></div>
          <div><span>AMACS release</span><strong>{snapshot.amacsRelease?.version ?? "Not deployed"}</strong></div>
        </div>
      )}
      <div className={styles.cardGrid}>
        {CAPABILITY_ENRICHMENT_TREE.map((section, index) => (
          <Link className={styles.workflowCard} key={section.id} href={capabilityWorkflowHref([section.id], organizationId)}>
            <span>0{index + 1}</span><h3>{section.label}</h3><p>{section.description}</p><small>{section.children.length} source-defined workflow{section.children.length === 1 ? "" : "s"} →</small>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionOverview({ section, snapshot, organizationId }: { section: (typeof CAPABILITY_ENRICHMENT_TREE)[number]; snapshot?: CapabilityEnrichmentSnapshot; organizationId?: string }) {
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Capability Enrichment</p>
      <h2>{section.label}</h2>
      <p className={styles.lead}>{section.description}</p>
      <div className={styles.childList}>
        {section.children.map((child) => (
          <Link key={child.id} href={capabilityWorkflowHref([section.id, child.id], organizationId)}>
            <div><strong>{child.label}</strong><p>{child.description}</p></div>
            <span>{snapshot?.progress.completedLeafPaths.includes(`${section.id}/${child.id}`) ? "✓" : "→"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WorkflowLeaf({
  sectionId,
  taskId,
  organizationId,
  snapshot,
  postAction,
  setStatus,
}: {
  sectionId: string;
  taskId: string;
  organizationId?: string;
  snapshot?: CapabilityEnrichmentSnapshot;
  postAction: (payload: Record<string, unknown>, successMessage: string, completeLeaf?: boolean) => Promise<boolean>;
  setStatus: (status: ServiceStatus) => void;
}) {
  const task = getCapabilityWorkflowTask(sectionId, taskId)!;
  if (task.owner === "organization-profile") return <ProfileOwnedTask taskId={taskId} organizationId={organizationId} snapshot={snapshot} />;
  if (taskId === "detailed-capabilities") return <CapabilityClaims snapshot={snapshot} postAction={postAction} />;
  if (taskId === "solutions") return <Solutions snapshot={snapshot} postAction={postAction} />;
  if (taskId === "ai-assistance") return <AmacsAssistance organizationId={organizationId} snapshot={snapshot} postAction={postAction} setStatus={setStatus} />;
  if (taskId === "suggestions") return <AmacsSuggestions snapshot={snapshot} postAction={postAction} setStatus={setStatus} />;
  if (evidenceKindByTask[taskId]) return <EvidenceWorkflow kind={evidenceKindByTask[taskId]} snapshot={snapshot} postAction={postAction} />;
  if (["tags", "keywords", "specialties"].includes(taskId)) return <TermsWorkflow field={taskId as "tags" | "keywords" | "specialties"} snapshot={snapshot} postAction={postAction} />;
  return null;
}

function ProfileOwnedTask({ taskId, organizationId, snapshot }: { taskId: string; organizationId?: string; snapshot?: CapabilityEnrichmentSnapshot }) {
  const org = snapshot?.organization;
  const returnTo = capabilityWorkflowHref([
    CAPABILITY_ENRICHMENT_TREE.find((section) => section.children.some((child) => child.id === taskId))!.id,
    taskId,
  ], organizationId);
  const profileHref = `/onboarding/organization-profile?${new URLSearchParams({ ...(organizationId ? { organizationId } : {}), returnTo }).toString()}`;
  let content: React.ReactNode;
  if (taskId === "organization-overview") content = <dl className={styles.dataList}><div><dt>Name</dt><dd>{org?.organizationName ?? "—"}</dd></div><div><dt>Legal name</dt><dd>{org?.legalName ?? "—"}</dd></div><div><dt>Website</dt><dd>{org?.website ?? "—"}</dd></div></dl>;
  else if (taskId === "contacts") content = org?.contacts.length ? <div className={styles.recordList}>{org.contacts.map((contact) => <article key={contact.id}><strong>{contact.name}</strong><span>{contact.title}</span><p>{contact.email}{contact.phone ? ` · ${contact.phone}` : ""}</p></article>)}</div> : <p className={styles.empty}>No canonical contacts loaded.</p>;
  else if (taskId === "description") content = <p className={styles.readOnlyValue}>{org?.description ?? "No canonical description loaded."}</p>;
  else if (taskId === "industries-served") content = <Pills values={org?.industries ?? []} empty="No industries loaded." />;
  else if (taskId === "service-offerings") content = <Pills values={org?.services ?? []} empty="No service offerings loaded." />;
  else content = <dl className={styles.dataList}><div><dt>Website</dt><dd>{org?.website ?? "—"}</dd></div><div><dt>Organization ID</dt><dd>{org?.organizationId ?? organizationId ?? "—"}</dd></div></dl>;

  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Canonical profile handoff</p>
      <h2>{getCapabilityWorkflowTask(CAPABILITY_ENRICHMENT_TREE.find((section) => section.children.some((child) => child.id === taskId))!.id, taskId)?.label}</h2>
      <p className={styles.lead}>This information belongs to Organization Profile. Capability Enrichment reads it; it does not maintain a duplicate copy.</p>
      {content}
      <Link className={styles.primaryLink} href={profileHref}>Open Organization Profile →</Link>
    </div>
  );
}

function CapabilityClaims({ snapshot, postAction }: { snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Capabilities Entry</p><h2>Detailed capabilities</h2>
      <p className={styles.lead}>Create organization capability claims in ordinary language. AMACS mapping happens in its own branch.</p>
      <form className={styles.form} onSubmit={async (event) => { event.preventDefault(); if (await postAction({ action: "upsert-claim", name, description }, "Capability claim saved.")) { setName(""); setDescription(""); } }}>
        <label>Capability name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Detailed capability description<textarea required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button type="submit">Add capability</button>
      </form>
      <ClaimList snapshot={snapshot} onArchive={(claimId) => postAction({ action: "archive-claim", claimId }, "Capability archived.", false)} />
    </div>
  );
}

function Solutions({ snapshot, postAction }: { snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean> }) {
  const [claimId, setClaimId] = useState("");
  const [solution, setSolution] = useState("");
  const selected = snapshot?.claims.find((claim) => claim.id === claimId);
  useEffect(() => { setSolution(selected?.solution ?? ""); }, [selected?.id, selected?.solution]);
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Capabilities Entry</p><h2>Solutions</h2>
      <p className={styles.lead}>Describe the solution or delivery approach associated with an existing capability claim.</p>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void postAction({ action: "save-solution", claimId, solution }, "Solution saved."); }}>
        <ClaimSelect claims={snapshot?.claims ?? []} value={claimId} onChange={setClaimId} />
        <label>Solution / approach<textarea required rows={6} value={solution} onChange={(event) => setSolution(event.target.value)} /></label>
        <button type="submit" disabled={!claimId}>Save solution</button>
      </form>
    </div>
  );
}

function AmacsSuggestions({ snapshot, postAction, setStatus }: { snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean>; setStatus: (status: ServiceStatus) => void }) {
  const [claimId, setClaimId] = useState("");
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<AmacsCandidate[]>([]);
  async function search() {
    setStatus({ busy: true });
    try {
      const response = await fetch(`/api/onboarding/capabilities/amacs?q=${encodeURIComponent(q)}`);
      const body = await response.json() as { candidates?: AmacsCandidate[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "AMACS search failed.");
      setCandidates(body.candidates ?? []); setStatus({ busy: false });
    } catch (error) { setStatus({ busy: false, error: error instanceof Error ? error.message : "AMACS search failed." }); }
  }
  return <AmacsCandidateSurface title="Suggestions" description="Search the immutable AMACS release deployed to RFxchange. Search terms and aliases help find concepts, but the organization explicitly confirms the mapping." snapshot={snapshot} claimId={claimId} setClaimId={setClaimId} q={q} setQ={setQ} candidates={candidates} run={search} runLabel="Search AMACS" postAction={postAction} />;
}

function AmacsAssistance({ organizationId, snapshot, postAction, setStatus }: { organizationId?: string; snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean>; setStatus: (status: ServiceStatus) => void }) {
  const [claimId, setClaimId] = useState("");
  const claim = snapshot?.claims.find((item) => item.id === claimId);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<InterpretationCandidate[]>([]);
  useEffect(() => { setText(claim ? [claim.name, claim.description, claim.solution].filter(Boolean).join("\n") : ""); }, [claim?.id]);
  async function interpret() {
    if (!organizationId) return;
    setStatus({ busy: true });
    try {
      const response = await fetch("/api/onboarding/capabilities/amacs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, text }) });
      const body = await response.json() as { candidates?: InterpretationCandidate[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Interpretation service failed.");
      setCandidates(body.candidates ?? []); setStatus({ busy: false });
    } catch (error) { setStatus({ busy: false, error: error instanceof Error ? error.message : "Interpretation service failed." }); }
  }
  return <AmacsCandidateSurface title="AI assistance" description="The configured interpretation provider may propose AMACS candidates, but returned IDs are validated against the active AMACS release and remain non-authoritative until you accept one." snapshot={snapshot} claimId={claimId} setClaimId={setClaimId} q={text} setQ={setText} candidates={candidates} run={interpret} runLabel="Request interpretation" postAction={postAction} multiline />;
}

function AmacsCandidateSurface({ title, description, snapshot, claimId, setClaimId, q, setQ, candidates, run, runLabel, postAction, multiline = false }: {
  title: string; description: string; snapshot?: CapabilityEnrichmentSnapshot; claimId: string; setClaimId: (id: string) => void; q: string; setQ: (value: string) => void; candidates: InterpretationCandidate[]; run: () => Promise<void>; runLabel: string; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean>; multiline?: boolean;
}) {
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>AMACS Mapping / AI-to-AMACS Assistance</p><h2>{title}</h2><p className={styles.lead}>{description}</p>
      <div className={styles.amacsRelease}><span>Deployed release</span><strong>{snapshot?.amacsRelease ? `AMACS ${snapshot.amacsRelease.version}` : "No AMACS release deployed"}</strong>{snapshot?.amacsRelease && <small>Source {snapshot.amacsRelease.sourceCommitSha.slice(0, 12)}</small>}</div>
      <div className={styles.form}>
        <ClaimSelect claims={snapshot?.claims ?? []} value={claimId} onChange={setClaimId} />
        <label>{multiline ? "Capability text for interpretation" : "Search AMACS"}{multiline ? <textarea rows={5} value={q} onChange={(event) => setQ(event.target.value)} /> : <input value={q} onChange={(event) => setQ(event.target.value)} />}</label>
        <button type="button" disabled={!claimId || q.trim().length < 2 || !snapshot?.amacsRelease} onClick={() => void run()}>{runLabel}</button>
      </div>
      <div className={styles.recordList}>
        {candidates.map((candidate) => <article key={candidate.conceptId}><span>{candidate.conceptId}</span><strong>{candidate.label}</strong><p>{candidate.definition}</p>{candidate.matchedAlias && <small>Matched alias: {candidate.matchedAlias}</small>}{candidate.rationale && <small>{candidate.rationale}</small>}<button type="button" disabled={!claimId} onClick={() => void postAction({ action: "accept-amacs-mapping", claimId, releaseId: candidate.releaseId, conceptId: candidate.conceptId }, "AMACS mapping accepted.")}>Accept mapping</button></article>)}
        {candidates.length === 0 && <p className={styles.empty}>No candidates loaded.</p>}
      </div>
    </div>
  );
}

function EvidenceWorkflow({ kind, snapshot, postAction }: { kind: CapabilityEvidenceKind; snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean> }) {
  const [claimId, setClaimId] = useState("");
  const [label, setLabel] = useState(""); const [issuer, setIssuer] = useState(""); const [sourceUrl, setSourceUrl] = useState(""); const [notes, setNotes] = useState("");
  const labels: Record<CapabilityEvidenceKind, string> = { certification: "Certifications", license: "Licenses", "case-study": "Case studies", "supporting-document": "Supporting documents" };
  const items = snapshot?.claims.flatMap((claim) => claim.evidence.filter((item) => item.kind === kind).map((item) => ({ ...item, claimName: claim.name }))) ?? [];
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Evidence / Certifications</p><h2>{labels[kind]}</h2>
      <p className={styles.lead}>Evidence is stored as a provenance-bearing record attached to a capability claim. Supporting documents use authoritative URLs rather than fake attachments.</p>
      <form className={styles.form} onSubmit={async (event) => { event.preventDefault(); if (await postAction({ action: "add-evidence", claimId, kind, label, issuer, sourceUrl, notes }, "Evidence saved.")) { setLabel(""); setIssuer(""); setSourceUrl(""); setNotes(""); } }}>
        <ClaimSelect claims={snapshot?.claims ?? []} value={claimId} onChange={setClaimId} />
        <label>Evidence title<input required value={label} onChange={(event) => setLabel(event.target.value)} /></label>
        {(kind === "certification" || kind === "license") && <label>Issuer<input value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>}
        <label>{kind === "supporting-document" ? "Document URL" : "Source URL (optional)"}<input required={kind === "supporting-document"} type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label>
        <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <button type="submit" disabled={!claimId}>Add evidence</button>
      </form>
      <div className={styles.recordList}>{items.map((item) => <article key={item.id}><span>{item.claimName}</span><strong>{item.label}</strong>{item.issuer && <p>{item.issuer}</p>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}<button type="button" className={styles.dangerButton} onClick={() => void postAction({ action: "delete-evidence", evidenceId: item.id }, "Evidence removed.", false)}>Remove</button></article>)}{items.length === 0 && <p className={styles.empty}>No {labels[kind].toLowerCase()} saved.</p>}</div>
    </div>
  );
}

function TermsWorkflow({ field, snapshot, postAction }: { field: "tags" | "keywords" | "specialties"; snapshot?: CapabilityEnrichmentSnapshot; postAction: (payload: Record<string, unknown>, message: string, complete?: boolean) => Promise<boolean> }) {
  const existing = snapshot?.[field] ?? [];
  const [value, setValue] = useState("");
  useEffect(() => { setValue(existing.join(", ")); }, [field, existing.join("|")]);
  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>Tags / Keywords / Specialties</p><h2>{field[0].toUpperCase() + field.slice(1)}</h2>
      <p className={styles.lead}>These terms improve discoverability. They remain separate from canonical AMACS concept mappings.</p>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void postAction({ action: "save-terms", field, values: splitTerms(value) }, `${field[0].toUpperCase() + field.slice(1)} saved.`); }}>
        <label>Comma- or line-separated {field}<textarea rows={6} value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <button type="submit">Save {field}</button>
      </form>
      <Pills values={existing} empty={`No ${field} saved.`} />
    </div>
  );
}

function ClaimList({ snapshot, onArchive }: { snapshot?: CapabilityEnrichmentSnapshot; onArchive: (id: string) => Promise<boolean> }) {
  if (!snapshot?.claims.length) return <p className={styles.empty}>No capability claims saved.</p>;
  return <div className={styles.recordList}>{snapshot.claims.map((claim) => <article key={claim.id}><span>{claim.mappingStatus === "accepted" ? claim.amacsLabel ?? claim.amacsConceptId : "Unmapped"}</span><strong>{claim.name}</strong><p>{claim.description}</p>{claim.solution && <small>Solution: {claim.solution}</small>}<button type="button" className={styles.dangerButton} onClick={() => void onArchive(claim.id)}>Archive</button></article>)}</div>;
}

function ClaimSelect({ claims, value, onChange }: { claims: CapabilityEnrichmentSnapshot["claims"]; value: string; onChange: (value: string) => void }) {
  return <label>Capability claim<select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select a capability</option>{claims.map((claim) => <option value={claim.id} key={claim.id}>{claim.name}</option>)}</select></label>;
}

function Pills({ values, empty }: { values: string[]; empty: string }) {
  return values.length ? <div className={styles.pills}>{values.map((value) => <span key={value}>{value}</span>)}</div> : <p className={styles.empty}>{empty}</p>;
}

function ServiceGate({ message }: { message: string }) {
  return <div className={styles.serviceGate} role="alert"><strong>Service connection required</strong><p>{message}</p><small>No mock or browser-only fallback is used.</small></div>;
}
