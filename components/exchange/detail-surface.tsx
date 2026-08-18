"use client";

import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import type { RecordNavigationNode } from "@/lib/exchange/record-navigation";
import { ActionRail } from "./action-rail";
import { RecordWorkflowNavigator } from "./record-workflow-navigator";
import { ResourceDetail } from "./resource-detail";

function GenericDomainDetail({ record }: { record: ExchangeRecord }) {
  const classifications = record.card?.classifications ?? [];
  return <>
    <p>{record.summary}</p>
    <h2>Record context</h2>
    <div className="detail-tags">{record.metadata.map((item) => <span key={item}>{item}</span>)}</div>
    {classifications.length ? <><h2>Classification</h2><div className="detail-tags">{classifications.map((item) => <span key={item}>{item}</span>)}</div></> : null}
    {record.card?.status ? <><h2>Status</h2><p>{record.card.status.label}</p></> : null}
  </>;
}

export function DetailSurface({
  record,
  actions,
  activeActionIds,
  navigationPath = [],
  onNavigationPathChange,
  onWorkflowNode,
  onAction,
  onClose,
}: {
  record: ExchangeRecord;
  actions: LensAction[];
  activeActionIds?: string[];
  notes?: string[];
  navigationPath?: string[];
  onNavigationPathChange: (path: string[]) => void;
  onWorkflowNode: (node: RecordNavigationNode) => void;
  onAction: (action: LensAction) => void;
  onClose: () => void;
}) {
  function back() {
    if (navigationPath.length) {
      onNavigationPathChange(navigationPath.slice(0, -1));
      return;
    }
    onClose();
  }

  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={`${record.title} details`}>
    <header><button type="button" onClick={back}>← Back</button><span>{record.type.toUpperCase()}</span></header>
    <div className={`detail-hero record-media-${record.type}`}><p>{record.organization}</p><h1>{record.type === "capability" ? record.organization : record.title}</h1><span>{record.geography}</span></div>
    <div className="detail-body">
      <ActionRail actions={actions} activeActionIds={activeActionIds} onAction={onAction} />
      <RecordWorkflowNavigator record={record} path={navigationPath} onPathChange={onNavigationPathChange} onExecute={onWorkflowNode} />
      {record.type === "resource" ? <ResourceDetail record={record} /> : <GenericDomainDetail record={record} />}
      <h2>State continuity</h2><p>The mounted Exchange retains lens, query, map, drawer, selected record, list position, and the nested workflow path. Back moves up the workflow hierarchy before closing the record.</p>
    </div>
  </section>;
}
