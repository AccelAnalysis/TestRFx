"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ORGANIZATION_GOAL_OPTIONS,
  ORGANIZATION_ROLE_OPTIONS,
  ORGANIZATION_TYPE_OPTIONS,
  organizationProfileContextFromSearchParams,
  type OrganizationGoal,
  type OrganizationProfileAccepted,
  type OrganizationProfileContext,
  type OrganizationProfileFieldErrors,
  type OrganizationProfileSnapshot,
  type OrganizationProfileSubmission,
  type OrganizationRole,
  type OrganizationType,
} from "@/lib/onboarding/organization-profile";
import {
  ORGANIZATION_PROFILE_TREE,
  organizationProfileBreadcrumbs,
  organizationProfileHref,
  resolveOrganizationProfilePath,
} from "@/lib/onboarding/organization-profile-navigation";
import styles from "./organization-profile-form.module.css";

type Props = { initialContext: OrganizationProfileContext; activePath?: string[] };
type ProfileState = Omit<OrganizationProfileSubmission, "context">;

function emptyProfile(context: OrganizationProfileContext): ProfileState {
  return {
    displayName: context.organizationName ?? "",
    legalName: "",
    organizationType: "",
    description: "",
    website: "",
    primaryDomain: "",
    industry: "",
    naics: "",
    roles: [],
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    brandName: "",
    logoUrl: "",
    searchable: true,
    mapVisible: true,
    publicContact: false,
    goals: [],
  };
}

function toggle<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function browserContext(fallback: OrganizationProfileContext) {
  if (typeof window === "undefined") return fallback;
  const values: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, key) => { values[key] = value; });
  const parsed = organizationProfileContextFromSearchParams(values);
  return parsed.organizationId ? { ...fallback, ...parsed } : fallback;
}

export function OrganizationProfileForm({ initialContext, activePath = [] }: Props) {
  const [context, setContext] = useState(initialContext);
  const [form, setForm] = useState<ProfileState>(() => emptyProfile(initialContext));
  const [snapshot, setSnapshot] = useState<OrganizationProfileSnapshot | null>(null);
  const [errors, setErrors] = useState<OrganizationProfileFieldErrors>({});
  const [loading, setLoading] = useState(Boolean(initialContext.organizationId));
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<OrganizationProfileAccepted | null>(null);
  const [inviteHref, setInviteHref] = useState<string | null>(null);

  const node = resolveOrganizationProfilePath(activePath);
  const pathKey = activePath.join("/");
  const breadcrumbs = organizationProfileBreadcrumbs(activePath);

  useEffect(() => setContext((current) => browserContext(current)), []);
  useEffect(() => {
    if (!context.organizationId) { setLoading(false); return; }
    void load(context.organizationId);
  }, [context.organizationId]);

  const percent = useMemo(() => {
    const checks = [
      Boolean(form.displayName.trim() && form.organizationType && form.description.trim().length >= 40),
      Boolean(form.contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())),
      form.roles.length > 0,
      form.goals.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  async function load(organizationId: string) {
    setLoading(true);
    setServiceError(null);
    try {
      const response = await fetch(`/api/onboarding/organization-profile?organization=${encodeURIComponent(organizationId)}`, { headers: { Accept: "application/json" } });
      const payload = await response.json() as OrganizationProfileSnapshot | { error?: string };
      if (!response.ok) {
        setServiceError("error" in payload && payload.error ? payload.error : "Organization Profile could not be loaded.");
        return;
      }
      const next = payload as OrganizationProfileSnapshot;
      setSnapshot(next);
      setForm(next.profile);
      setContext((current) => ({ ...current, organizationId: next.organizationId, organizationName: next.organizationName }));
    } catch {
      setServiceError("Organization Profile could not reach the runtime service.");
    } finally { setLoading(false); }
  }

  async function save(mode: "draft" | "complete") {
    if (!context.organizationId) return;
    setWorking(true); setErrors({}); setNotice(null); setServiceError(null);
    try {
      const response = await fetch("/api/onboarding/organization-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, profile: { ...form, context } }),
      });
      const payload = await response.json() as OrganizationProfileAccepted | { errors?: OrganizationProfileFieldErrors; error?: string };
      if (!response.ok) {
        if ("errors" in payload && payload.errors) setErrors(payload.errors);
        else setServiceError("error" in payload && payload.error ? payload.error : "The profile could not be saved.");
        return;
      }
      const accepted = payload as OrganizationProfileAccepted;
      setCompleted(accepted.status === "profile_complete" ? accepted : null);
      setNotice(accepted.status === "profile_complete" ? "Organization Profile is complete." : "Changes saved to the canonical organization profile.");
      await load(context.organizationId);
    } catch { setServiceError("The profile could not reach the runtime persistence service."); }
    finally { setWorking(false); }
  }

  async function action(body: Record<string, unknown>) {
    if (!context.organizationId) return null;
    setWorking(true); setNotice(null); setServiceError(null);
    try {
      const response = await fetch("/api/onboarding/organization-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: context.organizationId, ...body }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        setServiceError(typeof payload.error === "string" ? payload.error : "The organization action could not be completed.");
        return null;
      }
      await load(context.organizationId);
      return payload;
    } catch { setServiceError("The organization action could not reach the runtime service."); return null; }
    finally { setWorking(false); }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const data = new FormData(target);
    const result = await action({
      action: "create_invitation",
      email: String(data.get("email") ?? ""),
      role: String(data.get("role") ?? "member"),
      permissions: String(data.get("permissions") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    });
    if (result && typeof result.inviteHref === "string") {
      setInviteHref(result.inviteHref);
      setNotice("Invitation created. The secure link is shown once for sharing.");
      target.reset();
    }
  }

  async function updateMember(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await action({
      action: "update_member",
      userId,
      role: String(data.get("role") ?? ""),
      permissions: String(data.get("permissions") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    });
    if (result) setNotice("Member role and permissions updated.");
  }

  const geographyHref = context.organizationId
    ? `/onboarding/geography?organization=${encodeURIComponent(context.organizationId)}&returnTo=${encodeURIComponent(organizationProfileHref(["organization-details", "contact-address"], context.organizationId, context.returnTo))}`
    : "/onboarding/geography";
  const capabilitiesHref = context.organizationId ? `/onboarding/capabilities?organization=${encodeURIComponent(context.organizationId)}` : "/onboarding/capabilities";

  const guard = !context.organizationId ? <div className={styles.guard}><strong>Resolved organization required</strong><p>This workspace never manufactures an organization ID. Enter through Organization Selection / Creation so profile access can be authorized and persisted.</p><Link className="button button-primary" href="/onboarding/organization">Resolve organization</Link></div> : null;
  const error = (field: keyof OrganizationProfileFieldErrors) => errors[field] ? <small className={styles.error}>{errors[field]}</small> : null;
  const saveButton = context.organizationId ? <div className={styles.actionBar}><button className="button button-primary" type="button" disabled={working} onClick={() => void save("draft")}>{working ? "Saving…" : "Save Changes"}</button></div> : null;

  function heading(eyebrow: string, title: string, description: string) {
    return <div className={styles.sectionHeading}><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
  }

  function handoff(title: string, description: string, href: string, label: string) {
    return <>{heading("Organization Profile", title, description)}<div className={styles.handoff}><span className={styles.handoffIcon}>↗</span><div><p>This workflow is owned by its canonical onboarding domain; Organization Profile links to it rather than cloning its data.</p><Link className="button button-primary" href={href}>{label}</Link></div></div></>;
  }

  function overview() {
    return <>{heading("Organization Profile", "Manage the organization identity", "The source-defined hierarchy is addressable as child and grandchild routes while Geography, Capabilities, and verification retain their own truth boundaries.")}{guard}<div className={styles.nodeGrid}>{ORGANIZATION_PROFILE_TREE.map((item) => <Link className={styles.nodeCard} key={item.id} href={organizationProfileHref([item.id], context.organizationId, context.returnTo)}><strong>{item.label}</strong><span>{item.description}</span><em>{item.children?.length ? `${item.children.length} workflows` : "Open workflow"} →</em></Link>)}</div>{context.organizationId ? <div className={styles.completePanel}><div><strong>{snapshot?.profileStatus === "complete" ? "Profile complete" : `${percent}% of required profile facts complete`}</strong><p>Profile Complete does not mark the organization Verified.</p></div><button className="button button-primary" disabled={working || loading} onClick={() => void save("complete")}>Complete profile</button></div> : null}</>;
  }

  function nodeIndex() {
    if (!node?.children) return null;
    return <>{heading("Organization Profile", node.label, node.description)}{guard}<div className={styles.nodeGrid}>{node.children.map((child) => <Link className={styles.nodeCard} key={child.id} href={organizationProfileHref([...activePath, child.id], context.organizationId, context.returnTo)}><strong>{child.label}</strong><span>{child.description}</span><em>Open workflow →</em></Link>)}</div>{node.id === "organization-details" ? saveButton : null}</>;
  }

  function teamList() {
    return <>{heading("Team Members", "Team List", "Current membership comes from organization_memberships, not a profile-local list.")}{guard}<div className={styles.list}>{snapshot?.team.length ? snapshot.team.map((member) => <div className={styles.listRow} key={member.userId}><div><strong>{member.displayName}{member.isViewer ? " (you)" : ""}</strong><span>{member.email}</span></div><div><b>{member.role}</b><small>{member.permissions.join(", ") || "No additional permissions"}</small></div></div>) : <div className={styles.empty}>No members loaded.</div>}</div></>;
  }

  function rolesPermissions() {
    return <>{heading("Team Members", "Roles & Permissions", "Role and permission changes are authorized server-side against the active organization membership.")}{guard}<div className={styles.stack}>{snapshot?.team.map((member) => <form className={styles.memberForm} key={member.userId} onSubmit={(event) => void updateMember(event, member.userId)}><div><strong>{member.displayName}</strong><span>{member.email}</span></div><label>Role<input name="role" defaultValue={member.role} /></label><label>Permissions<input name="permissions" defaultValue={member.permissions.join(", ")} /></label><button className="button button-secondary" disabled={working}>Update access</button></form>)}</div></>;
  }

  function invitations() {
    return <>{heading("Team Members", "Invitations", "Create durable, expiring organization invitations. Only the token hash is stored; the raw share link is shown once.")}{guard}{context.organizationId ? <form className={styles.inviteForm} onSubmit={createInvite}><label>Email<input type="email" name="email" required /></label><label>Role<input name="role" defaultValue="member" required /></label><label>Permissions <span>comma separated</span><input name="permissions" /></label><button className="button button-primary" disabled={working}>Create invitation</button></form> : null}{inviteHref ? <div className={styles.inviteLink}><strong>Share this invitation link</strong><code>{inviteHref}</code><button className="button button-secondary" type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${inviteHref}`)}>Copy link</button></div> : null}<div className={styles.list}>{snapshot?.invitations.length ? snapshot.invitations.map((invite) => <div className={styles.listRow} key={invite.id}><div><strong>{invite.email}</strong><span>{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span></div><div><b>{invite.status}</b>{invite.status === "pending" ? <button className={styles.textButton} type="button" onClick={async () => { const result = await action({ action: "revoke_invitation", invitationId: invite.id }); if (result) setNotice("Invitation revoked."); }}>Revoke</button> : null}</div></div>) : <div className={styles.empty}>No invitations recorded.</div>}</div></>;
  }

  function accessManagement() {
    return <>{heading("Team Members", "Access Management", "Remove another member’s organization access. The API blocks self-removal and removal of the sole owner.")}{guard}<div className={styles.list}>{snapshot?.team.map((member) => <div className={styles.listRow} key={member.userId}><div><strong>{member.displayName}</strong><span>{member.email} · {member.role}</span></div><div>{member.isViewer ? <small>Use the separate Leave Organization workflow for your own membership.</small> : <button className={styles.dangerButton} type="button" onClick={async () => { if (!window.confirm(`Remove ${member.displayName} from this organization?`)) return; const result = await action({ action: "remove_member", userId: member.userId }); if (result) setNotice("Member access removed."); }}>Remove access</button>}</div></div>)}</div></>;
  }

  function visibility() {
    return <>{heading("Organization Profile", "Brand & Visibility Settings", "Control Exchange projection without changing the private canonical Geography or identity records.")}{guard}<div className={styles.switchList}><label><input type="checkbox" checked={form.searchable} onChange={(e) => setForm((current) => ({ ...current, searchable: e.target.checked }))} /><span><strong>Searchable in the Exchange</strong><small>Allow authorized search results to include the organization.</small></span></label><label><input type="checkbox" checked={form.mapVisible} onChange={(e) => setForm((current) => ({ ...current, mapVisible: e.target.checked }))} /><span><strong>Visible on the map</strong><small>Geography still owns the map point and precision.</small></span></label><label><input type="checkbox" checked={form.publicContact} onChange={(e) => setForm((current) => ({ ...current, publicContact: e.target.checked }))} /><span><strong>Show primary contact</strong><small>Off unless explicitly enabled by the organization.</small></span></label></div><div className={styles.subsection}><h2>Participation roles</h2><div className={styles.choiceGrid}>{ORGANIZATION_ROLE_OPTIONS.map((option) => <label className={form.roles.includes(option.id) ? styles.selectedChoice : ""} key={option.id}><input type="checkbox" checked={form.roles.includes(option.id)} onChange={() => setForm((current) => ({ ...current, roles: toggle<OrganizationRole>(current.roles, option.id) }))} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div>{error("roles")}</div><div className={styles.subsection}><h2>First-value goals</h2><div className={styles.choiceGrid}>{ORGANIZATION_GOAL_OPTIONS.map((option) => <label className={form.goals.includes(option.id) ? styles.selectedChoice : ""} key={option.id}><input type="checkbox" checked={form.goals.includes(option.id)} onChange={() => setForm((current) => ({ ...current, goals: toggle<OrganizationGoal>(current.goals, option.id) }))} /><span><strong>{option.label}</strong></span></label>)}</div>{error("goals")}</div>{saveButton}</>;
  }

  function content() {
    if (!pathKey) return overview();
    if (node?.children) return nodeIndex();
    switch (pathKey) {
      case "organization-details/basic-information":
        return <>{heading("Organization Details", "Basic Information", "Canonical organization facts shared across the Exchange.")}{guard}<div className={styles.formGrid}><label>RFxchange display name<input value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} />{error("displayName")}</label><label>Legal / registered name<input value={form.legalName} onChange={(e) => setForm((current) => ({ ...current, legalName: e.target.value }))} /></label><label>Organization type<select value={form.organizationType} onChange={(e) => setForm((current) => ({ ...current, organizationType: e.target.value as OrganizationType | "" }))}><option value="">Select type</option>{ORGANIZATION_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}</select>{error("organizationType")}</label><label>Website<input inputMode="url" value={form.website} onChange={(e) => setForm((current) => ({ ...current, website: e.target.value }))} placeholder="https://" />{error("website")}</label><label>Primary domain<input value={form.primaryDomain} onChange={(e) => setForm((current) => ({ ...current, primaryDomain: e.target.value }))} placeholder="example.com" />{error("primaryDomain")}</label></div><div className={styles.truthPanel}><strong>Authority context</strong><p>Entry: {context.claimMode}. Active membership role: {snapshot?.viewerRole ?? "runtime session required"}. Authorization is re-checked by the API on every mutation.</p></div>{saveButton}</>;
      case "organization-details/contact-address":
        return <>{heading("Organization Details", "Contact & Address", "Contact details are profile-owned; physical address and service geography remain canonical in Geography.")}{guard}<div className={styles.formGrid}><label>Primary contact<input value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} />{error("contactName")}</label><label>Role / title<input value={form.contactTitle} onChange={(e) => setForm((current) => ({ ...current, contactTitle: e.target.value }))} /></label><label>Business email<input type="email" value={form.contactEmail} onChange={(e) => setForm((current) => ({ ...current, contactEmail: e.target.value }))} />{error("contactEmail")}</label><label>Business phone<input type="tel" value={form.contactPhone} onChange={(e) => setForm((current) => ({ ...current, contactPhone: e.target.value }))} /></label></div><div className={styles.truthPanel}><strong>Canonical address</strong>{snapshot?.geography ? <><p>{snapshot.geography.label}{snapshot.geography.region ? ` · ${snapshot.geography.region}` : ""}</p><p>Map: {snapshot.geography.mapReady ? "confirmed point available" : "no confirmed point"} · Visibility: {snapshot.geography.visibility ?? "not set"}</p><p>Service geography: {snapshot.geography.serviceGeographies.join(", ") || "not set"}</p></> : <p>No canonical Geography record is available yet.</p>}<Link href={geographyHref}>Manage address and service geography →</Link></div>{saveButton}</>;
      case "organization-details/industry-codes":
        return <>{heading("Organization Details", "Industry & Codes", "Maintain industry context and classification codes.")}{guard}<div className={styles.formGrid}><label>Industry<input value={form.industry} onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))} /></label><label>NAICS / industry code<input value={form.naics} onChange={(e) => setForm((current) => ({ ...current, naics: e.target.value }))} /></label></div>{saveButton}</>;
      case "organization-details/certifications": return handoff("Certifications", "The onboarding source places certification evidence in Capability Enrichment.", capabilitiesHref, "Open Capability Enrichment");
      case "organization-details/description": return <>{heading("Organization Details", "Description", "Maintain the organization overview used across RFxchange.")}{guard}<label className={styles.fullField}>Organization overview<textarea rows={8} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /><span>{form.description.trim().length}/40 minimum characters for Profile Complete</span>{error("description")}</label>{saveButton}</>;
      case "organization-details/logo-branding": return <>{heading("Organization Details", "Logo & Branding", "Maintain the public brand name and an approved logo URL without faking a file upload.")}{guard}<div className={styles.formGrid}><label>Public brand name<input value={form.brandName} onChange={(e) => setForm((current) => ({ ...current, brandName: e.target.value }))} /></label><label>Logo URL<input inputMode="url" value={form.logoUrl} onChange={(e) => setForm((current) => ({ ...current, logoUrl: e.target.value }))} placeholder="https://" />{error("logoUrl")}</label></div>{form.logoUrl ? <div className={styles.logoPreview}><img src={form.logoUrl} alt={`${form.brandName || form.displayName || "Organization"} logo preview`} /></div> : null}{saveButton}</>;
      case "verified-information": return <>{heading("Organization Profile", "Verified Information", "Only independently persisted verification assertions appear here; Profile Complete never generates them.")}{guard}<div className={styles.list}>{snapshot?.verifications.length ? snapshot.verifications.map((item) => <div className={styles.listRow} key={item.id}><div><strong>{item.fieldLabel}</strong><span>{item.value}</span></div><div><b>{item.status}</b>{item.source ? <small>{item.source}</small> : null}</div></div>) : <div className={styles.empty}>No organization verification assertions are recorded.</div>}</div></>;
      case "capabilities-amacs": return handoff("Capabilities (AMACS)", "Capability claims, AMACS assistance, evidence, and publication stay in Capability Enrichment.", capabilitiesHref, "Open Capabilities");
      case "locations": return <>{heading("Organization Profile", "Locations", "Location truth remains in Geography rather than being duplicated in the profile.")}{guard}<div className={styles.truthPanel}>{snapshot?.geography ? <><strong>{snapshot.geography.label}</strong><p>{snapshot.geography.mapReady ? "Confirmed map point available." : "Map placement still needs confirmation."}</p><p>Service geography: {snapshot.geography.serviceGeographies.join(", ") || "not set"}</p></> : <><strong>No primary location</strong><p>Complete Geography before Exchange-ready completion.</p></>}<Link className="button button-primary" href={geographyHref}>Manage Locations</Link></div></>;
      case "team-members/team-list": return teamList();
      case "team-members/roles-permissions": return rolesPermissions();
      case "team-members/invitations": return invitations();
      case "team-members/access-management": return accessManagement();
      case "documents-evidence": return handoff("Documents & Evidence", "Supporting documents are owned by the Capability Enrichment evidence workflow.", capabilitiesHref, "Open Evidence Workflow");
      case "brand-visibility": return visibility();
      default: return overview();
    }
  }

  return <main className={styles.shell}><div className={styles.workspace}><aside className={styles.sidebar}><Link className={styles.brand} href={organizationProfileHref([], context.organizationId, context.returnTo)}><span>RF</span><strong>Organization Profile</strong></Link><nav aria-label="Organization Profile navigation">{ORGANIZATION_PROFILE_TREE.map((item) => <div className={styles.navGroup} key={item.id}><Link className={activePath[0] === item.id ? styles.navActive : ""} href={organizationProfileHref([item.id], context.organizationId, context.returnTo)}>{item.label}</Link>{item.children ? <div className={styles.navChildren}>{item.children.map((child) => <Link className={activePath[1] === child.id ? styles.navActive : ""} key={child.id} href={organizationProfileHref([item.id, child.id], context.organizationId, context.returnTo)}>{child.label}</Link>)}</div> : null}</div>)}</nav><Link className={styles.backLink} href="/onboarding">← Onboarding</Link></aside><section className={styles.content}><div className={styles.mobileTitle}><strong>Organization Profile</strong><Link href={organizationProfileHref([], context.organizationId, context.returnTo)}>All sections</Link></div><div className={styles.breadcrumbs}><Link href={organizationProfileHref([], context.organizationId, context.returnTo)}>Organization Profile</Link>{breadcrumbs.map((crumb, index) => <span key={crumb.id}><b>›</b><Link href={organizationProfileHref(activePath.slice(0, index + 1), context.organizationId, context.returnTo)}>{crumb.label}</Link></span>)}</div><div className={styles.statusStrip}><span><b>Organization</b>{snapshot?.organizationName || context.organizationName || "Not resolved"}</span><span><b>Authority</b>{snapshot?.viewerRole || context.claimMode}</span><span><b>Profile</b>{loading ? "Loading" : snapshot?.profileStatus || "Not loaded"}</span><span><b>Service</b>{snapshot?.service === "postgres" ? "PostgreSQL connected" : "Runtime required"}</span></div>{notice ? <div className={styles.notice} role="status">{notice}</div> : null}{serviceError ? <div className={styles.serviceError} role="alert"><strong>Service unavailable</strong><span>{serviceError}</span></div> : null}{completed ? <div className={styles.success}><div><strong>Profile Complete</strong><span>Profile Complete is not the same as Verified.</span></div><Link className="button button-primary" href={completed.handoffHref}>Continue to Capability Enrichment</Link></div> : null}{content()}</section></div></main>;
}
