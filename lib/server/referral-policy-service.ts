import { queryDatabase } from "./postgres";

export interface ReferralPolicyResult {
  organizationId: string;
  organizationName: string;
  configured: boolean;
  policy: Record<string, unknown>;
  fee: Record<string, unknown>;
  publishedAt?: string;
}

type PolicyRow = {
  organization_id: string;
  organization_name: string;
  policy: unknown;
  fee: unknown;
  published_at: string | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toPolicy(row: PolicyRow): ReferralPolicyResult {
  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    configured: Boolean(row.published_at),
    policy: objectValue(row.policy),
    fee: objectValue(row.fee),
    publishedAt: row.published_at ?? undefined,
  };
}

export async function getReferralPolicyForOrganizationName(organizationName: string): Promise<ReferralPolicyResult | undefined> {
  const result = await queryDatabase<PolicyRow>(
    `SELECT o.id AS organization_id, o.name AS organization_name,
            COALESCE(rp.policy, '{}'::jsonb) AS policy,
            COALESCE(rp.fee, '{}'::jsonb) AS fee,
            rp.published_at::text
       FROM organizations o
       LEFT JOIN referral_policies rp ON rp.organization_id = o.id AND rp.published_at IS NOT NULL
      WHERE lower(o.name) = lower($1)
      LIMIT 1`,
    [organizationName.trim()],
  );
  return result.rows[0] ? toPolicy(result.rows[0]) : undefined;
}
