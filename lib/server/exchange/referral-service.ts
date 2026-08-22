import { getDatabase } from "@/lib/server/database";
import type { ExchangeServerActor } from "@/lib/server/exchange/actor";

export interface ExchangeReferralSummary {
  id: string;
  direction: "sent" | "received";
  status: string;
  sourceLens: string;
  recordId?: string;
  recordTitle?: string;
  senderOrganization: string;
  recipientOrganization: string;
  note?: string;
  policySummary?: string;
  feeSummary?: string;
  createdAt: string;
  updatedAt: string;
}

type ReferralRow = {
  id: string;
  sender_organization_id: string;
  sender_organization: string;
  recipient_organization_id: string;
  recipient_organization: string;
  status: string;
  source_lens: string;
  public_id: string | null;
  record_title: string | null;
  note: string | null;
  policy_summary: string | null;
  fee_summary: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listExchangeReferrals(actor: ExchangeServerActor): Promise<ExchangeReferralSummary[]> {
  const sql = getDatabase();
  const rows = await sql<ReferralRow[]>`
    SELECT
      r.id::text,
      r.sender_organization_id::text,
      sender.name AS sender_organization,
      r.recipient_organization_id::text,
      recipient.name AS recipient_organization,
      r.status,
      r.source_lens,
      er.public_id,
      er.title AS record_title,
      r.note,
      r.policy_snapshot ->> 'policySummary' AS policy_summary,
      r.fee_snapshot ->> 'summary' AS fee_summary,
      r.created_at,
      r.updated_at
    FROM referrals r
    JOIN organizations sender ON sender.id = r.sender_organization_id
    JOIN organizations recipient ON recipient.id = r.recipient_organization_id
    LEFT JOIN exchange_records er ON er.id = r.exchange_record_id
    WHERE r.sender_organization_id = ${actor.organizationId}::uuid
       OR r.recipient_organization_id = ${actor.organizationId}::uuid
    ORDER BY r.updated_at DESC, r.created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: row.id,
    direction: row.sender_organization_id === actor.organizationId ? "sent" : "received",
    status: row.status,
    sourceLens: row.source_lens,
    recordId: row.public_id ?? undefined,
    recordTitle: row.record_title ?? undefined,
    senderOrganization: row.sender_organization,
    recipientOrganization: row.recipient_organization,
    note: row.note ?? undefined,
    policySummary: row.policy_summary ?? undefined,
    feeSummary: row.fee_summary ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}
