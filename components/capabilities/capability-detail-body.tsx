"use client";

import type { CapabilityOrganizationProfile } from "@/lib/capabilities/contracts";
import { capabilityEvidenceCount, capabilityMappedCount } from "@/lib/capabilities/contracts";
import styles from "./capabilities.module.css";

function mappingClass(status: CapabilityOrganizationProfile["capabilities"][number]["mappingStatus"]) {
  if (status === "accepted") return styles.statusAccepted;
  if (status === "suggested") return styles.statusSuggested;
  return styles.statusReview;
}

export function CapabilityDetailBody({ profile }: { profile: CapabilityOrganizationProfile }) {
  const mapped = capabilityMappedCount(profile); const evidence = capabilityEvidenceCount(profile);
  return <>
    <p className={styles.detailIntro}>{profile.summary}</p>
    <div className={styles.metricGrid} aria-label="Capability profile summary">
      <div className={styles.metricCard}><strong>{profile.capabilities.length}</strong><span>capability claims</span></div>
      <div className={styles.metricCard}><strong>{mapped}</strong><span>accepted AMACS mappings</span></div>
      <div className={styles.metricCard}><strong>{evidence}</strong><span>supporting evidence items</span></div>
    </div>
    <section className={styles.section}>
      <h2>Capability profile</h2>
      <div className={styles.claimList}>{profile.capabilities.map((capability) => <article className={styles.claimCard} key={capability.id}>
        <div className={styles.claimHeader}><h3>{capability.name}</h3><span className={`${styles.status} ${mappingClass(capability.mappingStatus)}`}>{capability.mappingStatus}</span></div>
        <p>{capability.description}</p><div className={styles.mapping}>{capability.amacsLabel ?? "No AMACS mapping selected"}</div>
        <div className={styles.chips}>{capability.specialties.map((specialty) => <span className={styles.chip} key={specialty}>{specialty}</span>)}</div>
        {capability.evidence.length ? <div className={styles.evidenceList}>{capability.evidence.map((item) => <span className={styles.evidenceItem} key={item.id}>{item.label}</span>)}</div> : <div className={styles.empty}>No supporting evidence is attached in the reference profile.</div>}
      </article>)}</div>
    </section>
    <section className={styles.section}><h2>Service geography</h2><div className={styles.chips}>{profile.serviceAreas.map((area) => <span className={styles.chip} key={area}>{area}</span>)}</div></section>
    <section className={styles.section}><h2>Discoverability</h2><div className={styles.chips}>{profile.keywords.map((keyword) => <span className={styles.chip} key={keyword}>{keyword}</span>)}</div></section>
    <div className={styles.boundary}>AMACS alignment, evidence, and profile-strength values are deterministic reference data. Suggestions, organization acceptance, evidence support, and independent verification remain distinct truth states.</div>
  </>;
}
