"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ORGANIZATION_GOAL_OPTIONS,
  ORGANIZATION_ROLE_OPTIONS,
  organizationProfileContextFromSearchParams,
  type OrganizationGoal,
  type OrganizationProfileAccepted,
  type OrganizationProfileContext,
  type OrganizationProfileFieldErrors,
  type OrganizationProfileSnapshot,
  type OrganizationProfileSubmission,
  type OrganizationRole,
} from "@/lib/onboarding/organization-profile";
import {
  ORGANIZATION_PROFILE_TREE,
  organizationProfileBreadcrumbs,
  organizationProfileHref,
  resolveOrganizationProfilePath,
} from "@/lib/onboarding/organization-profile-navigation";
import styles from "./organization-profile-form.module.css";

type OrganizationProfileFormProps = {
  initialContext: OrganizationProfileContext;
  activePath?: string[];
};

type ProfileState = Omit<OrganizationProfileSubmission, "context">;

function blankProfile(context: OrganizationProfileContext): ProfileState {
  return {
    displayName: context.organizationName ?? "",
    legalName: "",
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

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function contextFromBrowser(fallback: OrganizationProfileContext) {
  if (typeof window === "undefined") return fallback;
  const entries: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, key) => { entries[key] = value; });
  const browser = organizationProfileContextFromSearchParams(entries);
  return browser.organizationId ? { ...fallback, ...browser } : fallback;
}

export function OrganizationProfileForm({ initialContext, activePath = [] }: OrganizationProfileFormProps) {
  const [context, setContext] = useState(initialContext);
  const [form, setForm] = useState<ProfileState>(() => blankProfile(initialContext));
  const [snapshot, setSnapshot] = useState<OrganizationProfileSnapshot | null>(null);
  const [errors, setErrors] = useState<OrganizationProfileFieldErrors>({});
  const [loading, setLoading] = useState(Boolean(initialContext.organizationId));
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<OrganizationProfileAccepted | null>(null);
  const [inviteHref, setInviteHref] = useState<string | null>(null);

  const activeNode = resolveOrganizationProfilePath(activePath);
  const pathKey = activePath.join("/");
  const breadcrumbs = organizationProfileBreadcrumbs(activePath);

  useEffect(() => {
    setContext((current) => contextFromBrowser(current));
  }, []);

  useEffect(() => {
    if (!context.organizationId) {
      setLoading(false);
      return;
    }
    void reloadSnapshot(context.organizationId);
  }, [context.organizationId]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(form.displayName.trim() && form.description.trim().length >= 40),
      Boolean(form.contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())),
      form.roles.length > 0,
      form.goals.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  async function reloadSnapshot(organizationId = context.organizationId) {
    if (!organizationId) return;
    setLoading(true);
    setServiceError(null);
    try {
      const response = await fetch(`/api/onboarding/organization-profile?organization=${encodeURIComponent(organizationId)}`, {
        headers: { Accept: "application/json" },
      });
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
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(mode: "draft" | "complete") {
    if (!context.organizationId) return;
    setWorking(true);
    setErrors({});
    setNotice(null);
    setServiceError(null);
    try {
      const response = await fetch("/api/onboarding/organization-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, profile: { ...form, context } }),
      });
      const payload = await response.json() as OrganizationProfileAccepted | { errors?: OrganizationProfileFieldErrors; error?: string };
      if (!response.ok) {
        if ("errors" in payload && payload.errors) setErrors(payload.errors);
        else setServiceError("error" in payload && payload.error ? payload.error : "The organization profile could not be saved.");
        return;
      }
      const accepted = payload as OrganizationProfileAccepted;
      setCompleted(accepted.status === "profile_complete" ? accepted : null);
      setNotice(accepted.status === "profile_complete" ? "Organization Profile is complete." : "Changes saved to the canonical organization profile.");
      await reloadSnapshot(context.organizationId);
    } catch {
      setServiceError("The organization profile could not reach the runtime persistence service.");
    } finally {
      setWorking(false);
    }
  }

  async function profileAction(body: Record<string, unknown>) {
    if (!context.organizationId) return null;
    setWorking(true);
    setNotice(null);
    setServiceError(null);
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
      await reloadSnapshot(context.organizationId);
      return payload;
    } catch {
      setServiceError("The organization action could not reach the runtime service.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const permissions = String(data.get("permissions") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const result = await profileAction({
      action: "create_invitation",
      email: String(data.get("email") ?? ""),
      role: String(data.get("role") ?? "member"),
      permissions,
    });
    if (result && typeof result.inviteHref === "string") {
      setInviteHref(result.inviteHref);
      setNotice("Invitation created. The secure link is shown once for sharing.");
      event.currentTarget.reset();
    }
  }

  async function updateMember(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const permissions = String(data.get("permissions") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const result = await profileAction({ action: "update_member", userId, role: String(data.get("role") ?? ""), permissions });
    if (result) setNotice("Member role and permissions updated.");
  }

  const geographyHref = context.organizationId
    ? `/onboarding/geography?organization=${encodeURIComponent(context.organizationId)}&returnTo=${encodeURIComponent(organizationProfileHref(["organization-details", "contact-address"], context.organizationId, context.returnTo))}`
    : "/onboarding/geography";
  const capabilityHref = context.organizationId
    ? `/onboarding/capabilities?organization=${encodeURIComponent(context.organizationId)}`
    : "/onboarding/capabilities";

  function renderGuard() {
    if (context.organizationId) return null;
    return (
      <div className={styles.guard}>
        <strong>Resolved organization required</strong>
        <p>This workspace does not manufacture an organization ID. Enter through Organization Selection / Creation so changes can be authorized and persisted.</p>
        <Link className="button button-primary" href="/onboarding/organization">Resolve organization</Link>
      </div>
    );
  }

  function fieldError(field: keyof OrganizationProfileFieldErrors) {
    return errors[field] ? <small className={styles.error}>{errors[field]}</small> : null;
  }

  function renderOverview() {
    return (
      <>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Organization Profile</p>
          <h1>Manage the organization identity</h1>
          <p>The source-defined profile tree is represented as real nested navigation. Profile, Geography, Capability Enrichment, and verification remain separate truth domains.</p>
        </div>
        {renderGuard()}
        <div className={styles.nodeGrid}>
          {ORGANIZATION_PROFILE_TREE.map((node) => (
            <Link className={styles.nodeCard} href={organizationProfileHref([node.id], context.organizationId, context.returnTo)} key={node.id}>
              <strong>{node.label}</strong>
              <span>{node.description}</span>
              <em>{node.children?.length ? `${node.children.length} workflows` : "Open workflow"} →</em>
            </Link>
          ))}
        </div>
        {context.organizationId ? (
          <div className={styles.completePanel}>
            <div><strong>{snapshot?.profileStatus === "complete" ? "Profile complete" : `${completion}% of required profile facts complete`}</strong><p>Completing this profile does not mark the organization Verified.</p></div>
            <button className="button button-primary" type="button" onClick={() => void saveProfile("complete")} disabled={working || loading}>Complete profile</button>
          </div>
        ) : null}
      </>
    );
  }

  function renderNodeIndex() {
    if (!activeNode?.children) return null;
    return (
      <>
        <div className={styles.sectionHeading}><p className="eyebrow">Organization Profile</p><h1>{activeNode.label}</h1><p>{activeNode.description}</p></div>
        {renderGuard()}
        <div className={styles.nodeGrid}>
          {activeNode.children.map((child) => (
            <Link className={styles.nodeCard} href={organizationProfileHref([...activePath, child.id], context.organizationId, context.returnTo)} key={child.id}>
              <strong>{child.label}</strong><span>{child.description}</span><em>Open workflow →</em>
            </Link>
          ))}
        </div>
        {activeNode.id === "organization-details" && context.organizationId ? (
          <div className={styles.actionBar}><button className="button button-primary" type="button" onClick={() => void saveProfile("draft")} disabled={working}>Save Changes</button></div>
        ) : null}
      </>
    );
  }

  function renderHandoff(title: string, copy: string, href: string, action: string) {
    return (
      <div className={styles.handoff}>
        <span className={styles.handoffIcon} aria-hidden="true">↗</span>
        <div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" href={href}>{action}</Link></div>
      </div>
    );
  }

  function renderContent() {
    if (!pathKey) return renderOverview();
    if (activeNode?.children) return renderNodeIndex();

    switch (pathKey) {
      case "organization-details/basic-information":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Details</p><h1>Basic Information</h1><p>Canonical organization facts shared across the Exchange.</p></div>{renderGuard()}<div className={styles.formGrid}><label>RFxchange display name<input value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} disabled={!context.organizationId} />{fieldError("displayName")}</label><label>Legal / registered name<input value={form.legalName} onChange={(e) => setForm((current) => ({ ...current, legalName: e.target.value }))} disabled={!context.organizationId} /></label><label>Website<input inputMode="url" placeholder="https://" value={form.website} onChange={(e) => setForm((current) => ({ ...current, website: e.target.value }))} disabled={!context.organizationId} />{fieldError("website")}</label><label>Primary domain<input placeholder="example.com" value={form.primaryDomain} onChange={(e) => setForm((current) => ({ ...current, primaryDomain: e.target.value }))} disabled={!context.organizationId} />{fieldError("primaryDomain")}</label></div>{renderSaveChanges()}</>;
      case "organization-details/contact-address":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Details</p><h1>Contact & Address</h1><p>Contact details are profile-owned. Physical address and service geography stay owned by Geography.</p></div>{renderGuard()}<div className={styles.formGrid}><label>Primary contact<input value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} disabled={!context.organizationId} />{fieldError("contactName")}</label><label>Role / title<input value={form.contactTitle} onChange={(e) => setForm((current) => ({ ...current, contactTitle: e.target.value }))} disabled={!context.organizationId} /></label><label>Business email<input type="email" value={form.contactEmail} onChange={(e) => setForm((current) => ({ ...current, contactEmail: e.target.value }))} disabled={!context.organizationId} />{fieldError("contactEmail")}</label><label>Business phone<input type="tel" value={form.contactPhone} onChange={(e) => setForm((current) => ({ ...current, contactPhone: e.target.value }))} disabled={!context.organizationId} /></label></div><div className={styles.truthPanel}><strong>Canonical address</strong>{snapshot?.geography ? <><p>{snapshot.geography.label}{snapshot.geography.region ? ` · ${snapshot.geography.region}` : ""}</p><p>Map: {snapshot.geography.mapReady ? "confirmed point available" : "no confirmed point"} · Visibility: {snapshot.geography.visibility ?? "not set"}</p><p>Service geography: {snapshot.geography.serviceGeographies.join(", ") || "not set"}</p></> : <p>No canonical Geography record is available yet.</p>}<Link href={geographyHref}>Manage address and service geography →</Link></div>{renderSaveChanges()}</>;
      case "organization-details/industry-codes":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Details</p><h1>Industry & Codes</h1><p>Maintain the organization’s industry context and classification code.</p></div>{renderGuard()}<div className={styles.formGrid}><label>Industry<input value={form.industry} onChange={(e) => setForm((current) => ({ ...current, industry: e.target.value }))} disabled={!context.organizationId} /></label><label>NAICS / industry code<input value={form.naics} onChange={(e) => setForm((current) => ({ ...current, naics: e.target.value }))} disabled={!context.organizationId} /></label></div>{renderSaveChanges()}</>;
      case "organization-details/certifications":
        return renderHandoff("Certifications", "The onboarding source places certifications with evidence during Capability Enrichment. Organization Profile does not create a second certification store.", capabilityHref, "Open Capability Enrichment");
      case "organization-details/description":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Details</p><h1>Description</h1><p>This overview is reused wherever the organization appears in RFxchange.</p></div>{renderGuard()}<label className={styles.fullField}>Organization overview<textarea rows={8} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} disabled={!context.organizationId} /><span>{form.description.trim().length}/40 minimum characters for Profile Complete</span>{fieldError("description")}</label>{renderSaveChanges()}</>;
      case "organization-details/logo-branding":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Details</p><h1>Logo & Branding</h1><p>Maintain the brand name and an approved public logo URL. This surface does not fake an object-storage upload.</p></div>{renderGuard()}<div className={styles.formGrid}><label>Public brand name<input value={form.brandName} onChange={(e) => setForm((current) => ({ ...current, brandName: e.target.value }))} disabled={!context.organizationId} /></label><label>Logo URL<input inputMode="url" placeholder="https://" value={form.logoUrl} onChange={(e) => setForm((current) => ({ ...current, logoUrl: e.target.value }))} disabled={!context.organizationId} />{fieldError("logoUrl")}</label></div>{form.logoUrl ? <div className={styles.logoPreview}><img src={form.logoUrl} alt={`${form.brandName || form.displayName || "Organization"} logo preview`} /></div> : null}{renderSaveChanges()}</>;
      case "verified-information":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Profile</p><h1>Verified Information</h1><p>Only independently recorded verification assertions appear here. Profile completion never creates verification.</p></div>{renderGuard()}<div className={styles.list}>{snapshot?.verifications.length ? snapshot.verifications.map((item) => <div className={styles.listRow} key={item.id}><div><strong>{item.fieldLabel}</strong><span>{item.value}</span></div><div><b>{item.status}</b>{item.source ? <small>{item.source}</small> : null}</div></div>) : <div className={styles.empty}>No organization verification assertions are recorded.</div>}</div></>;
      case "capabilities-amacs":
        return renderHandoff("Capabilities (AMACS)", "Capability claims, AMACS assistance, evidence, and publication are owned by Capability Enrichment and later the Capabilities lens.", capabilityHref, "Open Capabilities");
      case "locations":
        return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Profile</p><h1>Locations</h1><p>RFxchange keeps location truth in the Geography domain rather than duplicating it inside the profile.</p></div>{renderGuard()}<div className={styles.truthPanel}>{snapshot?.geography ? <><strong>{snapshot.geography.label}</strong><p>{snapshot.geography.mapReady ? "Confirmed map point available." : "Map placement still needs confirmation."}</p><p>Service geography: {snapshot.geography.serviceGeographies.join(", ") || "not set"}</p></> : <><strong>No primary location</strong><p>Complete the Geography workflow before Exchange-ready completion.</p></>}<Link className="button button-primary" href={geographyHref}>Manage Locations</Link></div></>;
      case "team-members/team-list":
        return renderTeamList();
      case "team-members/roles-permissions":
        return renderRolesPermissions();
      case "team-members/invitations":
        return renderInvitations();
      case "team-members/access-management":
        return renderAccessManagement();
      case "documents-evidence":
        return renderHandoff("Documents & Evidence", "The onboarding source associates supporting documents with capability evidence. This node hands off to that canonical evidence workflow instead of storing duplicate browser-only files.", capabilityHref, "Open Evidence Workflow");
      case "brand-visibility":
        return renderBrandVisibility();
      default:
        return renderOverview();
    }
  }

  function renderSaveChanges() {
    if (!context.organizationId) return null;
    return <div className={styles.actionBar}><button className="button button-primary" type="button" onClick={() => void saveProfile("draft")} disabled={working}>{working ? "Saving…" : "Save Changes"}</button></div>;
  }

  function renderTeamList() {
    return <><div className={styles.sectionHeading}><p className="eyebrow">Team Members</p><h1>Team List</h1><p>Current organization memberships are loaded from the canonical membership table.</p></div>{renderGuard()}<div className={styles.list}>{snapshot?.team.length ? snapshot.team.map((member) => <div className={styles.listRow} key={member.userId}><div><strong>{member.displayName}{member.isViewer ? " (you)" : ""}</strong><span>{member.email}</span></div><div><b>{member.role}</b><small>{member.permissions.join(", ") || "No additional permissions"}</small></div></div>) : <div className={styles.empty}>No members loaded.</div>}</div></>;
  }

  function renderRolesPermissions() {
    return <><div className={styles.sectionHeading}><p className="eyebrow">Team Members</p><h1>Roles & Permissions</h1><p>Updates are authorized server-side against the active organization membership.</p></div>{renderGuard()}<div className={styles.stack}>{snapshot?.team.map((member) => <form className={styles.memberForm} key={member.userId} onSubmit={(event) => void updateMember(event, member.userId)}><div><strong>{member.displayName}</strong><span>{member.email}</span></div><label>Role<input name="role" defaultValue={member.role} disabled={working} /></label><label>Permissions<input name="permissions" defaultValue={member.permissions.join(", ")} placeholder="permission:a, permission:b" disabled={working} /></label><button className="button button-secondary" type="submit" disabled={working}>Update access</button></form>)}</div></>;
  }

  function renderInvitations() {
    return <><div className={styles.sectionHeading}><p className="eyebrow">Team Members</p><h1>Invitations</h1><p>Create a durable, expiring invitation. The raw invite token is never stored; the shareable link is shown once.</p></div>{renderGuard()}{context.organizationId ? <form className={styles.inviteForm} onSubmit={createInvitation}><label>Email<input type="email" name="email" required /></label><label>Role<input name="role" defaultValue="member" required /></label><label>Permissions <span>comma separated</span><input name="permissions" /></label><button className="button button-primary" type="submit" disabled={working}>Create invitation</button></form> : null}{inviteHref ? <div className={styles.inviteLink}><strong>Share this invitation link</strong><code>{inviteHref}</code><button className="button button-secondary" type="button" onClick={() => navigator.clipboard?.writeText(`${location.origin}${inviteHref}`)}>Copy link</button></div> : null}<div className={styles.list}>{snapshot?.invitations.length ? snapshot.invitations.map((invite) => <div className={styles.listRow} key={invite.id}><div><strong>{invite.email}</strong><span>{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</span></div><div><b>{invite.status}</b>{invite.status === "pending" ? <button className={styles.textButton} type="button" disabled={working} onClick={async () => { const result = await profileAction({ action: "revoke_invitation", invitationId: invite.id }); if (result) setNotice("Invitation revoked."); }}>Revoke</button> : null}</div></div>) : <div className={styles.empty}>No invitations recorded.</div>}</div></>;
  }

  function renderAccessManagement() {
    return <><div className={styles.sectionHeading}><p className="eyebrow">Team Members</p><h1>Access Management</h1><p>Remove another member’s organization access. Self-removal and sole-owner removal are blocked by the server.</p></div>{renderGuard()}<div className={styles.list}>{snapshot?.team.map((member) => <div className={styles.listRow} key={member.userId}><div><strong>{member.displayName}</strong><span>{member.email} · {member.role}</span></div><div>{member.isViewer ? <small>Use Leave Organization for your own membership</small> : <button className={styles.dangerButton} type="button" disabled={working} onClick={async () => { if (!window.confirm(`Remove ${member.displayName} from this organization?`)) return; const result = await profileAction({ action: "remove_member", userId: member.userId }); if (result) setNotice("Member access removed."); }}>Remove access</button>}</div></div>)}</div></>;
  }

  function renderBrandVisibility() {
    return <><div className={styles.sectionHeading}><p className="eyebrow">Organization Profile</p><h1>Brand & Visibility Settings</h1><p>These choices control profile projection. Canonical private facts remain server-side.</p></div>{renderGuard()}<div className={styles.switchList}><label><input type="checkbox" checked={form.searchable} onChange={(e) => setForm((current) => ({ ...current, searchable: e.target.checked }))} disabled={!context.organizationId} /><span><strong>Searchable in the Exchange</strong><small>Allow this organization to appear in authorized search results.</small></span></label><label><input type="checkbox" checked={form.mapVisible} onChange={(e) => setForm((current) => ({ ...current, mapVisible: e.target.checked }))} disabled={!context.organizationId} /><span><strong>Visible on the map</strong><small>Geography still controls the actual location and precision.</small></span></label><label><input type="checkbox" checked={form.publicContact} onChange={(e) => setForm((current) => ({ ...current, publicContact: e.target.checked }))} disabled={!context.organizationId} /><span><strong>Show primary contact</strong><small>Off unless the organization explicitly enables it.</small></span></label></div><div className={styles.subsection}><h2>Participation roles</h2><div className={styles.choiceGrid}>{ORGANIZATION_ROLE_OPTIONS.map((option) => <label className={form.roles.includes(option.id) ? styles.selectedChoice : ""} key={option.id}><input type="checkbox" checked={form.roles.includes(option.id)} onChange={() => setForm((current) => ({ ...current, roles: toggleValue<OrganizationRole>(current.roles, option.id) }))} disabled={!context.organizationId} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div>{fieldError("roles")}</div><div className={styles.subsection}><h2>First-value goals</h2><div className={styles.choiceGrid}>{ORGANIZATION_GOAL_OPTIONS.map((option) => <label className={form.goals.includes(option.id) ? styles.selectedChoice : ""} key={option.id}><input type="checkbox" checked={form.goals.includes(option.id)} onChange={() => setForm((current) => ({ ...current, goals: toggleValue<OrganizationGoal>(current.goals, option.id) }))} disabled={!context.organizationId} /><span><strong>{option.label}</strong></span></label>)}</div>{fieldError("goals")}</div>{renderSaveChanges()}</>;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <Link className={styles.brand} href={organizationProfileHref([], context.organizationId, context.returnTo)}><span>RF</span><strong>Organization Profile</strong></Link>
          <nav aria-label="Organization Profile navigation">
            {ORGANIZATION_PROFILE_TREE.map((node) => {
              const parentActive = activePath[0] === node.id;
              return <div className={styles.navGroup} key={node.id}><Link className={parentActive ? styles.navActive : ""} href={organizationProfileHref([node.id], context.organizationId, context.returnTo)}>{node.label}</Link>{node.children ? <div className={styles.navChildren}>{node.children.map((child) => <Link className={activePath[1] === child.id ? styles.navActive : ""} href={organizationProfileHref([node.id, child.id], context.organizationId, context.returnTo)} key={child.id}>{child.label}</Link>)}</div> : null}</div>;
            })}
          </nav>
          <Link className={styles.backLink} href="/onboarding">← Onboarding</Link>
        </aside>

        <section className={styles.content}>
          <div className={styles.mobileTitle}><strong>Organization Profile</strong><Link href={organizationProfileHref([], context.organizationId, context.returnTo)}>All sections</Link></div>
          <div className={styles.breadcrumbs}><Link href={organizationProfileHref([], context.organizationId, context.returnTo)}>Organization Profile</Link>{breadcrumbs.map((crumb, index) => <span key={crumb.id}><b>›</b><Link href={organizationProfileHref(activePath.slice(0, index + 1), context.organizationId, context.returnTo)}>{crumb.label}</Link></span>)}</div>

          <div className={styles.statusStrip}>
            <span><b>Organization</b>{snapshot?.organizationName || context.organizationName || "Not resolved"}</span>
            <span><b>Profile</b>{loading ? "Loading" : snapshot?.profileStatus || "Not loaded"}</span>
            <span><b>Service</b>{snapshot?.service === "postgres" ? "PostgreSQL connected" : "Runtime required"}</span>
          </div>

          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          {serviceError ? <div className={styles.serviceError} role="alert"><strong>Service unavailable</strong><span>{serviceError}</span></div> : null}
          {completed ? <div className={styles.success}><div><strong>Profile Complete</strong><span>Profile Complete is not the same as Verified.</span></div><Link className="button button-primary" href={completed.handoffHref}>Continue to Capability Enrichment</Link></div> : null}

          {renderContent()}
        </section>
      </div>
    </main>
  );
}
