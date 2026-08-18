import { getRfxDetail } from "@/lib/rfx/catalog";

const stateLabel = { matched: "Matched", confirm: "Confirm", gap: "Gap" } as const;

export function RfxDetailContent({ recordId }: { recordId: string }) {
  const detail = getRfxDetail(recordId);
  if (!detail) {
    return <div className="rfx-detail-section"><p className="muted">Structured RFx detail is not available for this reference record.</p></div>;
  }

  return (
    <div className="rfx-detail-stack">
      <section className="rfx-detail-section rfx-summary-grid" aria-label="RFx summary">
        <div><span>Type</span><strong>{detail.rfxType}</strong></div>
        <div><span>Status</span><strong>{detail.status.replace("-", " ")}</strong></div>
        <div><span>Solicitation</span><strong>{detail.solicitationNumber}</strong></div>
        <div><span>Source</span><strong>{detail.source === "external" ? "External issuer" : "RFxchange hosted"}</strong></div>
        {detail.closesAt ? <div><span>Closes</span><strong>{new Date(detail.closesAt).toLocaleString()}</strong></div> : null}
        {detail.estimatedValue ? <div><span>Estimated value</span><strong>{detail.estimatedValue}</strong></div> : null}
      </section>

      <section className="rfx-detail-section">
        <p className="eyebrow">Scope</p>
        <p>{detail.scope}</p>
        <p className="muted"><strong>Performance geography:</strong> {detail.performanceGeography}</p>
      </section>

      {detail.match ? (
        <section className="rfx-detail-section rfx-match-panel" aria-label="Capability match context">
          <div className="rfx-match-heading"><div><p className="eyebrow">Why this matched</p><h2>{detail.match.matched} of {detail.match.total} requirements represented</h2></div><strong>{Math.round((detail.match.matched / detail.match.total) * 100)}%</strong></div>
          <p>{detail.match.summary}</p>
          <p className="muted">This is discovery context, not a qualification, eligibility, endorsement, or probability-of-award determination.</p>
        </section>
      ) : null}

      <section className="rfx-detail-section">
        <p className="eyebrow">Requirements</p>
        <div className="rfx-requirement-list">
          {detail.requirements.map((requirement) => (
            <div key={requirement.id} className="rfx-requirement-row">
              <div><strong>{requirement.label}</strong><small>{requirement.kind}{requirement.mandatory ? " · mandatory" : ""}</small></div>
              {requirement.profileState ? <span className={`rfx-state rfx-state-${requirement.profileState}`}>{stateLabel[requirement.profileState]}</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rfx-detail-section rfx-two-column">
        <div><p className="eyebrow">Deliverables</p><ul>{detail.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><p className="eyebrow">Response requirements</p><ul>{detail.responseRequirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>

      {detail.evaluationMethod ? <section className="rfx-detail-section"><p className="eyebrow">Evaluation</p><p>{detail.evaluationMethod}</p></section> : null}

      {detail.externalSubmissionRequired ? (
        <section className="rfx-detail-section rfx-boundary-note">
          <strong>External submission boundary</strong>
          <p>RFxchange can support discovery, fit assessment, teaming, and response readiness here. Formal submission remains with the authoritative issuer channel until an issuer-hosted RFxchange workflow is connected.</p>
        </section>
      ) : null}
    </div>
  );
}
