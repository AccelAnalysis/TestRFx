import { withTransaction } from "@/lib/server/postgres";

export async function saveOrganizationProfileContext(input: {
  organizationId: string;
  actorUserId: string;
  field: "industries" | "service_offerings";
  values: string[];
}) {
  await withTransaction(async (client) => {
    if (input.field === "industries") {
      await client.query(
        `UPDATE organization_profiles SET industries = $1::jsonb, updated_at = now()
         WHERE organization_id = $2::uuid`,
        [JSON.stringify(input.values), input.organizationId],
      );
    } else {
      await client.query(
        `UPDATE organization_profiles SET service_offerings = $1::text[], updated_at = now()
         WHERE organization_id = $2::uuid`,
        [input.values, input.organizationId],
      );
    }
    await client.query(
      `INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload)
       VALUES ('OrganizationCapabilityContextUpdated', $1::uuid, $2::uuid, $3::jsonb)`,
      [input.actorUserId, input.organizationId, JSON.stringify({ field: input.field, count: input.values.length })],
    );
  });
}
