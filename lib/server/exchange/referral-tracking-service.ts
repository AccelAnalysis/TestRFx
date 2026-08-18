import type { ReferralTrackingRecord } from "@/lib/exchange/referrals";
import type { ExchangeServerActor } from "./actor";
import { getExchangeDatabase } from "./database";

export async function listReferralsForActor(actor: ExchangeServerActor): Promise<ReferralTrackingRecord[]> {
  const sql = getExchangeDatabase();
  const rows = await sql<{
    id: string;
    status: string;
    sender_organization_id: string;
    sender_organization: string;
    recipient_organization: string;
    record_id: string | null;
    record_title: string | null;
    record_type: string | null;
    message: string | null;
    policy_summary: string | null;
    fee_summary: string | null;
    created_at: Date | string;
  }[]>`
    SELECT
      r.id::text AS id,
      r.status,
      r.sender_organization_id::text AS sender_organization_id,
      sender.name AS sender_organization,
      recipient.name AS recipient_organization,
      er.public_id AS record_id,
      er.title AS record_title,
      er.record_type::text AS record_type,
      r.message,
      r.policy_snapshot ->> 'summary' AS policy_summary,
      r.fee_snapshot ->> 'summary' AS fee_summary,
      r.created_at
    FROM referrals r
    JOIN organizations sender ON sender.id = r.sender_organization_id
    JOIN organizations recipient ON recipient.id = r.recipient_organization_id
    LEFT JOIN exchange_records er ON er.id = r.exchange_record_id
    WHERE r.sender_organization_id = ${actor.organizationId}::uuid
       OR r.recipient_organization_id = ${actor.organizationId}::uuid
    ORDER BY r.created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.sender_organization_id === actor.organizationId ? "sent" : "received",
    senderOrganization: row.sender_organization,
    recipientOrganization: row.recipient_organization,
    recordId: row.record_id ?? undefined,
    recordTitle: row.record_title ?? undefined,
    recordType: row.record_type ?? undefined,
    message: row.message ?? undefined,
    policySummary: row.policy_summary ?? undefined,
    feeSummary: row.fee_summary ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
