"use client";

import { useState } from "react";
import type { ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import type { RecordNavigationNode } from "@/lib/exchange/record-navigation";
import { ActionRail } from "./action-rail";
import { CapabilityRuntimePanel, type CapabilityRuntimeMode } from "./capability-runtime-panel";
import { RecordWorkflowNavigator } from "./record-workflow-navigator";
import { ResourceDetail } from "./resource-detail";
import { RfxRuntimeDetail } from "./rfx-runtime-detail";

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
  onRecordChanged,
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
  onRecordChanged?: () => void;
  onClose: () => void;
}) {
  const [capabilityMode, setCapabilityMode] = useState<CapabilityRuntimeMode>();

  function back() {
    if (capabilityMode) { setCapabilityMode(undefined); return; }
    if (navigationPath.length) { onNavigationPathChange(navigationPath.slice(0, -1)); return; }
    onClose();
  }

  function executeNode(node: RecordNavigationNode) {
    if (record.type === "capability" && node.command === "capability-evidence") { setCapabilityMode("evidence"); return; }
    if (record.type === "capability" && node.command === "publish-capabilities") { setCapabilityMode("publish"); return; }
    onWorkflowNode(node);
  }

  return <section className="detail-surface" role="dialog" aria-modal="true" aria-label={`${record.title} details`}>
    <header><button type="button" onClick={back}>← Back</button><span>{record.type.toUpperCase()}</span></header>
    <div className={`detail-hero record-media-${record.type}`}><p>{record.organization}</p><h1>{record.type === "capability" ? record.organization : record.title}</h1><span>{record.geography}</span></div>
    <div className="detail-body">
      <ActionRail actions={actions} activeActionIds={activeActionIds} onAction={onAction} />
      <RecordWorkflowNavigator record={record} path={navigationPath} onPathChange={onNavigationPathChange} onExecute={executeNode} />
      {record.type === "resource" ? <ResourceDetail record={record} /> : null}
      {record.type === "rfx" ? <RfxRuntimeDetail record={record} /> : null}
      {record.type === "capability" ? <CapabilityRuntimePanel record={record} mode={capabilityMode} onModeChange={setCapabilityMode} onChanged={onRecordChanged} /> : null}
      {record.type === "intelligence" ? <GenericDomainDetail record={record} /> : null}
      <h2>State continuity</h2><p>The mounted Exchange retains lens, query, map, drawer, selected record, list position, and the nested workflow path. Back moves up the workflow hierarchy before closing the record.</p>
    </div>
  </section>;
}
