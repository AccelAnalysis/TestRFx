"use client";

import { useEffect, useState } from "react";
import type { ExchangeRecord } from "@/lib/exchange/contracts";

interface RfxDetailPayload {
  recordId: string;
  title: string;
  summary: string;
  organizationName: string;
  solicitationType: string;
  solicitationNumber: string;
  status: string;
  dueAt: string;
  geography: string;
  scope: string;
  deliverables: string[];
  responseRequirements: string[];
  evaluationMethod: string;
  externalSubmissionRequired: boolean;
  ownedByViewer: boolean;
}

export function RfxRuntimeDetail({ record }: { record: ExchangeRecord }) {
  const [detail, setDetail] = useState<RfxDetailPayload>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`/api/exchange/rfx-workflows?recordId=${encodeURIComponent(record.id)}&view=detail`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to load RFx detail.");
        setDetail(body.detail as RfxDetailPayload);
      })
      .catch((failure) => { if (failure instanceof DOMException && failure.name === "AbortError") return; setError(failure instanceof Error ? failure.message : "Unable to load RFx detail."); });
    return () => controller.abort();
  }, [record.id]);

  if (error) return <section className="rfx-detail-section"><p className="muted">{error}</p></section>;
  if (!detail) return <section className="rfx-detail-section"><p className="muted">Loading authoritative RFx detail…</p></section>;

  return <div className="rfx-detail-stack">
    <section className="rfx-detail-section rfx-summary-grid" aria-label="RFx summary">
      <div><span>Type</span><strong>{detail.solicitationType}</strong></div>
      <div><span>Status</span><strong>{detail.status}</strong></div>
      {detail.solicitationNumber ? <div><span>Solicitation</span><strong>{detail.solicitationNumber}</strong></div> : null}
      {detail.dueAt ? <div><span>Due</span><strong>{new Date(detail.dueAt).toLocaleString()}</strong></div> : null}
      <div><span>Geography</span><strong>{detail.geography || record.geography}</strong></div>
    </section>
    <section className="rfx-detail-section"><p className="eyebrow">Scope</p><p>{detail.scope || detail.summary}</p></section>
    {detail.deliverables.length || detail.responseRequirements.length ? <section className="rfx-detail-section rfx-two-column"><div><p className="eyebrow">Deliverables</p>{detail.deliverables.length ? <ul>{detail.deliverables.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">No deliverables published.</p>}</div><div><p className="eyebrow">Response requirements</p>{detail.responseRequirements.length ? <ul>{detail.responseRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">No response requirements published.</p>}</div></section> : null}
    {detail.evaluationMethod ? <section className="rfx-detail-section"><p className="eyebrow">Evaluation</p><p>{detail.evaluationMethod}</p></section> : null}
    {detail.externalSubmissionRequired ? <section className="rfx-detail-section rfx-boundary-note"><strong>External submission boundary</strong><p>Formal submission remains with the authoritative issuer channel. RFxchange records a submission only when the respondent provides the external confirmation/reference.</p></section> : null}
  </div>;
}
