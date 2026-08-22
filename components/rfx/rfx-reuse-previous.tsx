"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock, Copy, FileText, WifiOff } from "lucide-react";
import styles from "./rfx-reuse-previous.module.css";

export interface ReusableRfxRecord {
  id: string;
  title: string;
  summary: string;
  rfxType: string;
  status: string;
  updatedAt?: string;
  dueAt?: string;
  geography: unknown;
  estimatedValue: unknown;
  scope: unknown;
  deliverables: unknown;
  responseRequirements: unknown;
  evaluationMethod: unknown;
  requirements: unknown;
}

function updatedLabel(value?: string) {
  if (!value) return "Previous RFx";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Previous RFx" : `Updated ${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

export function RfxReusePrevious({ currentRecordId, onCancel, onApply }: {
  currentRecordId: string;
  onCancel: () => void;
  onApply: (record: ReusableRfxRecord) => void;
}) {
  const [records, setRecords] = useState<ReusableRfxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetch(`/api/rfx/reusable?exclude=${encodeURIComponent(currentRecordId)}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { records?: ReusableRfxRecord[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Previous RFx records are unavailable.");
        if (active) setRecords(body.records ?? []);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Previous RFx records are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentRecordId]);

  const selected = records.find((record) => record.id === selectedId);

  return <section className={styles.panel} aria-label="Reuse a previous RFx">
    <header className={styles.header}><button type="button" onClick={onCancel} aria-label="Back to creation options"><ArrowLeft size={20} /></button><div><small>Start another way</small><h3>Reuse a previous RFx</h3></div></header>
    <p className={styles.intro}>Choose an RFx from your active organization. RFxchange copies editable structure only—the previous lifecycle, responses, dates, acknowledgements, and award state are not carried forward.</p>
    {loading ? <div className={styles.state}><span /><strong>Loading your RFx records</strong></div> : null}
    {error ? <div className={styles.error}><WifiOff size={20} /><div><strong>Previous RFx is unavailable</strong><p>{error}</p></div></div> : null}
    {!loading && !error && !records.length ? <div className={styles.empty}><FileText size={25} /><strong>No reusable RFx yet</strong><p>Create this RFx from your description or a governed template. Published and prior organization RFx records will appear here when available.</p></div> : null}
    {records.length ? <div className={styles.list}>{records.map((record) => { const selectedRecord = selectedId === record.id; return <button key={record.id} type="button" className={selectedRecord ? styles.selected : styles.card} aria-pressed={selectedRecord} onClick={() => setSelectedId(record.id)}><span className={styles.icon}><Copy size={19} /></span><span className={styles.copy}><strong>{record.title}</strong><small>{record.rfxType} · {record.status}</small><span><Clock size={13} />{updatedLabel(record.updatedAt)}</span></span>{selectedRecord ? <Check size={20} /> : null}</button>; })}</div> : null}
    <footer className={styles.footer}><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={!selected} onClick={() => selected && onApply(selected)} className={styles.primary}>Use this RFx</button></footer>
  </section>;
}
