"use client";

import { useEffect, useState } from "react";
import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import { capabilityEvidenceCount, capabilityMappedCount } from "@/lib/capabilities/contracts";
import { withBasePath } from "@/lib/exchange/base-path";
import styles from "./capabilities.module.css";

function mappingClass(status: CapabilityOrganizationProfile["capabilities"][number]["mappingStatus"]) { if (status === "accepted") return styles.statusAccepted; if (status === "suggested") return styles.statusSuggested; return styles.statusReview; }

export function CapabilityDetailBody({ profile }: { profile: CapabilityOrganizationProfile }) {
  const [current, setCurrent] = useState(profile); const [serviceBacked, setServiceBacked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath(`/api/capabilities?recordId=${encodeURIComponent(profile.exchangeRecordId)}`), { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Capability service unavailable"); return response.json(); })
      .then((data) => { if (!cancelled && data.profile) { setCurrent(data.profile); setServiceBacked(true); } })
      .catch(() => { if (!cancelled) { setCurrent(profile); setServiceBacked(false); } });
    return () => { cancelled = true; };
  }, [profile]);
  const mapped = capabilityMappedCount(current); const evidence = capabilityEvidenceCount(current);
  return <>
    <p className={styles.detailIntro}>{current.summary}</p>
    <div className={styles.metricGrid} aria-label="Capability profile summary"><div className={styles.metricCard}><strong>{current.capabilities.length}</strong><span>capability claims</span></div><div className={styles.metricCard}><strong>{mapped}</strong><span>accepted AMACS mappings</span></div><div className={styles.metricCard}><strong>{evidence}</strong><span>supporting evidence items</span></div></div>
    <section className={styles.section}><h2>Capability profile</h2><div className={styles.claimList}>{current.capabilities.map((capability) => <article className={styles.claimCard} key={capability.id}>
      <div className={styles.claimHeader}><h3>{capability.name}</h3><span className={`${styles.status} ${mappingClass(capability.mappingStatus)}`}>{capability.mappingStatus}</span></div><p>{capability.description}</p><div className={styles.mapping}>{capability.amacsNodeId?.startsWith("amacs.reference.") ? "Legacy reference mapping — review against the configured AMACS release" : capability.amacsLabel ?? "No AMACS mapping selected"}</div>
      <div className={styles.chips}>{capability.specialties.map((specialty) => <span className={styles.chip} key={specialty}>{specialty}</span>)}</div>{capability.evidence.length ? <div className={styles.evidenceList}>{capability.evidence.map((item) => <span className={styles.evidenceItem} key={item.id}>{item.label}</span>)}</div> : <div className={styles.empty}>No supporting evidence is attached.</div>}
    </article>)}</div></section>
    <section className={styles.section}><h2>Service geography</h2><div className={styles.chips}>{current.serviceAreas.map((area) => <span className={styles.chip} key={area}>{area}</span>)}</div></section>
    <section className={styles.section}><h2>Discoverability</h2><div className={styles.chips}>{current.keywords.map((keyword) => <span className={styles.chip} key={keyword}>{keyword}</span>)}</div></section>
    <div className={styles.boundary}>{serviceBacked ? "Loaded from the Capabilities service. " : "Static preview fallback. "}AMACS interpretation, participant acceptance, evidence support, and independent verification remain distinct truth states.</div>
  </>;
}
