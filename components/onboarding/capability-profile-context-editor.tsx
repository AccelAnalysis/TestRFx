"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./capability-enrichment.module.css";
import { capabilityWorkflowHref, type CapabilityEnrichmentSnapshot } from "@/lib/onboarding/capability-enrichment";

export default function CapabilityProfileContextEditor({
  organizationId,
  field,
}: {
  organizationId?: string;
  field: "industries" | "service_offerings";
}) {
  const [snapshot, setSnapshot] = useState<CapabilityEnrichmentSnapshot>();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const label = field === "industries" ? "Industries served" : "Service offerings";
  const path = ["industry-services", field === "industries" ? "industries-served" : "service-offerings"];
  const next = field === "industries"
    ? capabilityWorkflowHref(["industry-services", "service-offerings"], organizationId)
    : capabilityWorkflowHref(["capabilities-entry", "detailed-capabilities"], organizationId);

  async function load() {
    if (!organizationId) return;
    setError("");
    const response = await fetch(`/api/onboarding/capabilities?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
    const body = await response.json() as CapabilityEnrichmentSnapshot & { error?: string };
    if (!response.ok) { setError(body.error ?? "Capability service unavailable."); return; }
    setSnapshot(body);
    const values = field === "industries" ? body.organization.industries : body.organization.services;
    setValue(values.join(", "));
  }

  useEffect(() => { void load(); }, [organizationId, field]);

  async function save() {
    if (!organizationId) { setError("A canonical organization is required."); return; }
    const values = [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
    setError(""); setMessage("");
    const response = await fetch("/api/onboarding/capabilities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-profile-list", organizationId, field, values }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setError(body.error ?? "Unable to save."); return; }
    const progress = await fetch("/api/onboarding/capabilities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-progress", organizationId, path, completedLeafPath: path.join("/") }),
    });
    if (!progress.ok) { const progressBody = await progress.json() as { error?: string }; setError(progressBody.error ?? "Saved, but progress could not be recorded."); return; }
    setMessage(`${label} saved to the canonical Organization Profile.`);
    await load();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topBar}><Link href="/onboarding">← Onboarding</Link><strong>RFxchange</strong><span>Capability Enrichment</span></header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Capability Enrichment</p>
          <h1>Industry &amp; Services</h1>
          <p className={styles.sidebarCopy}>These source-defined values remain canonical Organization Profile data and are edited here without creating a second copy.</p>
          <Link className={styles.rootLink} href={capabilityWorkflowHref(["industry-services"], organizationId)}>← Industry &amp; Services</Link>
          <nav className={styles.treeChildren} aria-label="Industry and Services workflows">
            <Link className={field === "industries" ? styles.activeChild : ""} href={capabilityWorkflowHref(["industry-services", "industries-served"], organizationId)}>Industries served</Link>
            <Link className={field === "service_offerings" ? styles.activeChild : ""} href={capabilityWorkflowHref(["industry-services", "service-offerings"], organizationId)}>Service offerings</Link>
          </nav>
        </aside>
        <section className={styles.workspace}>
          <nav className={styles.breadcrumbs}><Link href={capabilityWorkflowHref([], organizationId)}>Capability Enrichment</Link><span>›</span><Link href={capabilityWorkflowHref(["industry-services"], organizationId)}>Industry &amp; Services</Link><span>›</span><strong>{label}</strong></nav>
          {!organizationId && <div className={styles.serviceGate}><strong>Canonical organization required</strong><p>Return to Organization Profile or organization selection before editing this workflow.</p></div>}
          {error && <div className={styles.serviceGate} role="alert"><strong>Service connection required</strong><p>{error}</p><small>No local or mock fallback is used.</small></div>}
          {message && <div className={styles.success} role="status">{message}</div>}
          <div className={styles.panel}>
            <p className={styles.kicker}>Industry &amp; Services</p><h2>{label}</h2>
            <p className={styles.lead}>{field === "industries" ? "Select the industries the organization serves." : "List the service offerings the organization provides."}</p>
            <div className={styles.form}>
              <label>Comma- or line-separated {label.toLowerCase()}<textarea rows={7} value={value} onChange={(event) => setValue(event.target.value)} /></label>
              <button type="button" disabled={!organizationId || !snapshot} onClick={() => void save()}>Save {label.toLowerCase()}</button>
            </div>
          </div>
          <footer className={styles.workflowFooter}><Link href={next}>Next source-defined task →</Link></footer>
        </section>
      </div>
    </main>
  );
}
