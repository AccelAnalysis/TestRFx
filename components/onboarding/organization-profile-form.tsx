"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import {
  ORGANIZATION_GOAL_OPTIONS,
  ORGANIZATION_ROLE_OPTIONS,
  type LocationVisibility,
  type OrganizationGoal,
  type OrganizationProfileAccepted,
  type OrganizationProfileContext,
  type OrganizationProfileFieldErrors,
  type OrganizationRole,
} from "@/lib/onboarding/organization-profile";
import styles from "./organization-profile-form.module.css";

type OrganizationProfileFormProps = {
  initialContext: OrganizationProfileContext;
};

type FormState = {
  displayName: string;
  legalName: string;
  description: string;
  website: string;
  industry: string;
  naics: string;
  roles: OrganizationRole[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  serviceGeographies: string;
  locationVisibility: LocationVisibility;
  searchable: boolean;
  mapVisible: boolean;
  publicContact: boolean;
  goals: OrganizationGoal[];
  capabilitySeed: string;
};

function initialForm(context: OrganizationProfileContext): FormState {
  return {
    displayName: context.organizationName ?? "",
    legalName: "",
    description: "",
    website: "",
    industry: "",
    naics: "",
    roles: [],
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "United States",
    serviceGeographies: context.geography ?? "",
    locationVisibility: "locality",
    searchable: true,
    mapVisible: true,
    publicContact: false,
    goals: [],
    capabilitySeed: "",
  };
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function claimLabel(context: OrganizationProfileContext) {
  if (context.claimMode === "claimed") return "Claimed existing organization";
  if (context.claimMode === "created") return "New organization";
  return "Selected organization";
}

export function OrganizationProfileForm({ initialContext }: OrganizationProfileFormProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(initialContext));
  const [errors, setErrors] = useState<OrganizationProfileFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState<OrganizationProfileAccepted | null>(null);

  const roleLabels = useMemo(
    () => ORGANIZATION_ROLE_OPTIONS.filter((option) => form.roles.includes(option.id)).map((option) => option.label),
    [form.roles],
  );

  const completion = useMemo(() => {
    const checks = [
      Boolean(form.displayName.trim()),
      form.description.trim().length >= 40,
      form.roles.length > 0,
      Boolean(form.contactName.trim() && form.contactEmail.trim()),
      Boolean(form.addressLine1.trim() && form.city.trim() && form.region.trim() && form.postalCode.trim()),
      Boolean(form.serviceGeographies.trim()),
      form.goals.length > 0,
      form.capabilitySeed.trim().length >= 10,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/onboarding/organization-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, context: initialContext }),
      });
      const payload = (await response.json()) as OrganizationProfileAccepted | { errors?: OrganizationProfileFieldErrors };

      if (!response.ok) {
        setErrors("errors" in payload && payload.errors ? payload.errors : { form: "The organization profile could not be saved." });
        return;
      }

      setAccepted(payload as OrganizationProfileAccepted);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors({ form: "The organization profile could not be saved. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <main className={styles.shell}>
        <section className={`${styles.card} ${styles.successCard}`} aria-live="polite">
          <div className={styles.progressRail} aria-label="Onboarding progress">
            <span className={styles.done}>Account</span>
            <span className={styles.done}>Organization</span>
            <span className={styles.active}>Profile</span>
            <span>Capabilities</span>
            <span>Exchange ready</span>
          </div>

          <p className="eyebrow">Organization profile</p>
          <h1>{accepted.organizationName} is profile complete</h1>
          <p className="muted">
            The organization now has the minimum canonical identity RFxchange needs before capability enrichment: identity, contact, location, service geography, participation role, visibility, and a plain-language capability seed.
          </p>

          <div className={styles.successGrid}>
            {Object.entries(accepted.completion).map(([key]) => (
              <div className={styles.successItem} key={key}>
                <span aria-hidden="true">✓</span>
                <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
              </div>
            ))}
          </div>

          <div className={styles.boundaryNote}>
            <strong>Next: Capability Enrichment</strong>
            <p>Detailed capabilities, AMACS mapping, evidence, certifications, specialties, and publishing remain downstream. This profile does not claim that those capabilities are independently verified.</p>
          </div>

          <Link className="button button-primary button-full" href={accepted.handoffHref}>
            Continue to capability enrichment
          </Link>
          <p className="identity-footer"><Link href="/onboarding">Return to onboarding overview</Link></p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <form className={styles.card} onSubmit={submit} noValidate>
        <div className={styles.progressRail} aria-label="Onboarding progress">
          <span className={styles.done}>Account</span>
          <span className={styles.done}>Organization</span>
          <span className={styles.active}>Profile</span>
          <span>Capabilities</span>
          <span>Exchange ready</span>
        </div>

        <header className={styles.header}>
          <div>
            <p className="eyebrow">Organization profile</p>
            <h1>Establish your Exchange identity</h1>
            <p className="muted">Tell RFxchange who this organization is, where it operates, and enough about what it does to begin capability enrichment.</p>
          </div>
          <div className={styles.completionBadge} aria-label={`${completion}% of profile requirements complete`}>
            <strong>{completion}%</strong>
            <span>ready</span>
          </div>
        </header>

        <div className={styles.contextBar}>
          <div>
            <span>Organization context</span>
            <strong>{initialContext.organizationName || "Organization selected in the prior step"}</strong>
          </div>
          <div>
            <span>Authority path</span>
            <strong>{claimLabel(initialContext)}</strong>
          </div>
          <div>
            <span>Primary geography</span>
            <strong>{initialContext.geography || "Confirm below"}</strong>
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.formColumn}>
            <section className={styles.section} aria-labelledby="identity-heading">
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div><h2 id="identity-heading">Organization identity</h2><p>Canonical facts used across RFx, Resources, Intelligence, Capabilities, referrals, and organization detail.</p></div>
              </div>

              <div className={styles.twoColumn}>
                <label>
                  RFxchange display name
                  <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} aria-invalid={Boolean(errors.displayName)} required />
                  {errors.displayName ? <small className={styles.error}>{errors.displayName}</small> : null}
                </label>
                <label>
                  Legal / registered name <span className={styles.optional}>Optional</span>
                  <input value={form.legalName} onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))} />
                </label>
              </div>

              <label>
                Organization overview
                <textarea rows={4} placeholder="Describe what the organization does, who it serves, and its operating focus." value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} aria-invalid={Boolean(errors.description)} required />
                <span className={styles.help}>{form.description.trim().length}/40 minimum characters</span>
                {errors.description ? <small className={styles.error}>{errors.description}</small> : null}
              </label>

              <div className={styles.threeColumn}>
                <label>
                  Website <span className={styles.optional}>Optional</span>
                  <input inputMode="url" placeholder="https://" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
                </label>
                <label>
                  Industry <span className={styles.optional}>Optional</span>
                  <input placeholder="Construction, IT, education…" value={form.industry} onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))} />
                </label>
                <label>
                  NAICS / industry code <span className={styles.optional}>Optional</span>
                  <input value={form.naics} onChange={(event) => setForm((current) => ({ ...current, naics: event.target.value }))} />
                </label>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="roles-heading">
              <div className={styles.sectionHeading}>
                <span>02</span>
                <div><h2 id="roles-heading">How does this organization participate?</h2><p>Roles are multi-select. RFxchange should not force an organization into one account type.</p></div>
              </div>
              <div className={styles.optionGrid}>
                {ORGANIZATION_ROLE_OPTIONS.map((option) => {
                  const selected = form.roles.includes(option.id);
                  return (
                    <label className={`${styles.optionCard} ${selected ? styles.selectedOption : ""}`} key={option.id}>
                      <input type="checkbox" checked={selected} onChange={() => setForm((current) => ({ ...current, roles: toggleValue(current.roles, option.id) }))} />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </label>
                  );
                })}
              </div>
              {errors.roles ? <small className={styles.error}>{errors.roles}</small> : null}
            </section>

            <section className={styles.section} aria-labelledby="contact-heading">
              <div className={styles.sectionHeading}>
                <span>03</span>
                <div><h2 id="contact-heading">Primary organization contact</h2><p>This is an organizational contact, not a replacement for the signed-in user's personal identity.</p></div>
              </div>
              <div className={styles.twoColumn}>
                <label>
                  Contact name
                  <input autoComplete="name" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} aria-invalid={Boolean(errors.contactName)} required />
                  {errors.contactName ? <small className={styles.error}>{errors.contactName}</small> : null}
                </label>
                <label>
                  Role / title <span className={styles.optional}>Optional</span>
                  <input autoComplete="organization-title" value={form.contactTitle} onChange={(event) => setForm((current) => ({ ...current, contactTitle: event.target.value }))} />
                </label>
                <label>
                  Business email
                  <input type="email" autoComplete="email" inputMode="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} aria-invalid={Boolean(errors.contactEmail)} required />
                  {errors.contactEmail ? <small className={styles.error}>{errors.contactEmail}</small> : null}
                </label>
                <label>
                  Business phone <span className={styles.optional}>Optional</span>
                  <input type="tel" autoComplete="tel" value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} />
                </label>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="geography-heading">
              <div className={styles.sectionHeading}>
                <span>04</span>
                <div><h2 id="geography-heading">Location and service geography</h2><p>Where the organization is based and where it can work are separate facts.</p></div>
              </div>

              <label>
                Primary operating address
                <input autoComplete="street-address" value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} aria-invalid={Boolean(errors.addressLine1)} required />
                {errors.addressLine1 ? <small className={styles.error}>{errors.addressLine1}</small> : null}
              </label>
              <label>
                Address line 2 <span className={styles.optional}>Optional</span>
                <input value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} />
              </label>
              <div className={styles.fourColumn}>
                <label>City / locality<input autoComplete="address-level2" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} aria-invalid={Boolean(errors.city)} required />{errors.city ? <small className={styles.error}>{errors.city}</small> : null}</label>
                <label>State / region<input autoComplete="address-level1" value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} aria-invalid={Boolean(errors.region)} required />{errors.region ? <small className={styles.error}>{errors.region}</small> : null}</label>
                <label>Postal code<input autoComplete="postal-code" value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} aria-invalid={Boolean(errors.postalCode)} required />{errors.postalCode ? <small className={styles.error}>{errors.postalCode}</small> : null}</label>
                <label>Country<input autoComplete="country-name" value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} aria-invalid={Boolean(errors.country)} required />{errors.country ? <small className={styles.error}>{errors.country}</small> : null}</label>
              </div>

              <div className={styles.mapPlaceholder} role="img" aria-label="Reference map placement preview">
                <div className={styles.mapGrid} />
                <span className={styles.mapPin}>●</span>
                <div><strong>Map placement confirmation seam</strong><small>Production geocoding resolves and confirms the authoritative point here. This reference form does not invent coordinates.</small></div>
              </div>

              <label>
                Where can this organization provide service?
                <textarea rows={3} placeholder="Hampton Roads; Richmond Metro; statewide Virginia; North Carolina…" value={form.serviceGeographies} onChange={(event) => setForm((current) => ({ ...current, serviceGeographies: event.target.value }))} aria-invalid={Boolean(errors.serviceGeographies)} required />
                {errors.serviceGeographies ? <small className={styles.error}>{errors.serviceGeographies}</small> : null}
              </label>

              <label>
                Public location precision
                <select value={form.locationVisibility} onChange={(event) => setForm((current) => ({ ...current, locationVisibility: event.target.value as LocationVisibility }))}>
                  <option value="exact">Exact location</option>
                  <option value="approximate">Approximate location</option>
                  <option value="locality">Locality only</option>
                </select>
                <span className={styles.help}>The authoritative location can remain private even when the public profile shows only a locality.</span>
              </label>
            </section>

            <section className={styles.section} aria-labelledby="goals-heading">
              <div className={styles.sectionHeading}>
                <span>05</span>
                <div><h2 id="goals-heading">What should RFxchange help you do first?</h2><p>These goals configure the first-value pathway; they are not just profile decoration.</p></div>
              </div>
              <div className={styles.goalGrid}>
                {ORGANIZATION_GOAL_OPTIONS.map((option) => {
                  const selected = form.goals.includes(option.id);
                  return (
                    <label className={`${styles.goalCard} ${selected ? styles.selectedOption : ""}`} key={option.id}>
                      <input type="checkbox" checked={selected} onChange={() => setForm((current) => ({ ...current, goals: toggleValue(current.goals, option.id) }))} />
                      <strong>{option.label}</strong>
                    </label>
                  );
                })}
              </div>
              {errors.goals ? <small className={styles.error}>{errors.goals}</small> : null}
            </section>

            <section className={styles.section} aria-labelledby="capability-heading">
              <div className={styles.sectionHeading}>
                <span>06</span>
                <div><h2 id="capability-heading">Capability seed</h2><p>Use plain language. Detailed capability structure, AMACS mapping, evidence, and publishing happen in Capability Enrichment.</p></div>
              </div>
              <label>
                What does this organization actually do?
                <textarea rows={5} placeholder="Commercial HVAC installation; preventive maintenance; building automation controls…" value={form.capabilitySeed} onChange={(event) => setForm((current) => ({ ...current, capabilitySeed: event.target.value }))} aria-invalid={Boolean(errors.capabilitySeed)} required />
                {errors.capabilitySeed ? <small className={styles.error}>{errors.capabilitySeed}</small> : null}
              </label>
            </section>

            <section className={styles.section} aria-labelledby="visibility-heading">
              <div className={styles.sectionHeading}>
                <span>07</span>
                <div><h2 id="visibility-heading">Visibility and public presentation</h2><p>Private administrative truth and public Exchange presentation stay separate.</p></div>
              </div>
              <div className={styles.visibilityGrid}>
                <label className={styles.switchRow}><input type="checkbox" checked={form.searchable} onChange={(event) => setForm((current) => ({ ...current, searchable: event.target.checked }))} /><span><strong>Searchable in the Exchange</strong><small>Allow the organization to appear in relevant Exchange searches.</small></span></label>
                <label className={styles.switchRow}><input type="checkbox" checked={form.mapVisible} onChange={(event) => setForm((current) => ({ ...current, mapVisible: event.target.checked }))} /><span><strong>Visible on the map</strong><small>Use the public location precision selected above.</small></span></label>
                <label className={styles.switchRow}><input type="checkbox" checked={form.publicContact} onChange={(event) => setForm((current) => ({ ...current, publicContact: event.target.checked }))} /><span><strong>Show primary contact publicly</strong><small>Keep off by default unless the organization chooses otherwise.</small></span></label>
              </div>
            </section>

            {errors.form ? <div className={styles.formError} role="alert">{errors.form}</div> : null}

            <div className={styles.actions}>
              <Link className="button button-secondary" href="/onboarding">Back to onboarding</Link>
              <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Saving profile…" : "Complete organization profile"}</button>
            </div>
          </div>

          <aside className={styles.previewColumn} aria-label="Organization profile preview">
            <div className={styles.stickyPreview}>
              <div className={styles.previewHeader}><span>Exchange preview</span><strong>{completion}% ready</strong></div>
              <div className={styles.previewMedia}><span>{form.displayName ? form.displayName.slice(0, 2).toUpperCase() : "RF"}</span></div>
              <div className={styles.previewBody}>
                <p className={styles.previewOrg}>ORGANIZATION</p>
                <h2>{form.displayName || "Your organization"}</h2>
                <p>{form.city || initialContext.geography || "Primary geography"}{form.region ? `, ${form.region}` : ""}</p>
                <div className={styles.previewTags}>
                  {roleLabels.slice(0, 3).map((role) => <span key={role}>{role}</span>)}
                  {roleLabels.length === 0 ? <span>Participation role</span> : null}
                </div>
                <p className={styles.previewDescription}>{form.description || "Your organization overview will appear here."}</p>
                <div className={styles.previewCapability}><span>Capability seed</span><strong>{form.capabilitySeed || "Add what your organization does"}</strong></div>
              </div>
              <div className={styles.readinessList}>
                <div><span className={form.mapVisible ? styles.readyDot : styles.neutralDot} />Map presence <strong>{form.mapVisible ? "On" : "Off"}</strong></div>
                <div><span className={form.searchable ? styles.readyDot : styles.neutralDot} />Exchange search <strong>{form.searchable ? "On" : "Off"}</strong></div>
                <div><span className={styles.pendingDot} />AMACS enrichment <strong>Next</strong></div>
                <div><span className={styles.pendingDot} />Verification <strong>Separate</strong></div>
              </div>
              <p className={styles.previewNote}>Profile Complete does not mean Verified. Capability claims remain claims until the applicable evidence and verification processes are completed.</p>
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}
