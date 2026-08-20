import { getDatabase } from "@/lib/server/database";
import type { RegistrationEntryContext, RegistrationSubmission } from "@/lib/identity/registration";

export class RegistrationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationConfigurationError";
  }
}

export type RegistrationRequestMetadata = {
  requestIp?: string;
  userAgent?: string;
};

export type RegistrationResolution =
  | {
      kind: "existing_verified";
      userId: string;
      email: string;
    }
  | {
      kind: "pending_verification";
      userId: string;
      registrationId: string;
      email: string;
      context: RegistrationEntryContext;
      resumed: boolean;
    };

type PolicyVersions = {
  terms: string;
  privacy: string;
};

function requiredPolicyVersions(): PolicyVersions {
  const terms = process.env.RFX_TERMS_VERSION?.trim();
  const privacy = process.env.RFX_PRIVACY_VERSION?.trim();
  if (!terms || !privacy) {
    throw new RegistrationConfigurationError(
      "RFX_TERMS_VERSION and RFX_PRIVACY_VERSION are required before accepting registrations.",
    );
  }
  return { terms, privacy };
}

export async function resolveRegistration(
  submission: RegistrationSubmission,
  metadata: RegistrationRequestMetadata,
): Promise<RegistrationResolution> {
  const policyVersions = requiredPolicyVersions();
  const sql = getDatabase();
  const displayName = `${submission.firstName} ${submission.lastName}`.trim();

  return sql.begin(async (tx) => {
    const existingUsers = await tx`
      SELECT id, email, email_verified_at, account_status
      FROM users
      WHERE lower(btrim(email)) = ${submission.email}
      LIMIT 1
      FOR UPDATE
    `;
    const existingUser = existingUsers[0] as
      | { id: string; email: string; email_verified_at: Date | null; account_status: string }
      | undefined;

    if (existingUser?.email_verified_at) {
      await tx`
        INSERT INTO activity_events(event_name, actor_user_id, payload)
        VALUES ('RegistrationExistingIdentityDetected', ${existingUser.id}, ${tx.json({ entryKind: submission.context.entryKind })})
      `;
      return {
        kind: "existing_verified" as const,
        userId: existingUser.id,
        email: existingUser.email,
      };
    }

    let userId = existingUser?.id;
    if (!userId) {
      const createdUsers = await tx`
        INSERT INTO users(email, display_name, first_name, last_name, account_status)
        VALUES (${submission.email}, ${displayName}, ${submission.firstName}, ${submission.lastName}, 'pending_verification')
        RETURNING id
      `;
      userId = String(createdUsers[0].id);
    } else {
      await tx`
        UPDATE users
        SET display_name = ${displayName},
            first_name = ${submission.firstName},
            last_name = ${submission.lastName},
            account_status = 'pending_verification'
        WHERE id = ${userId}
      `;
    }

    const activeRegistrations = await tx`
      SELECT id
      FROM registration_transactions
      WHERE user_id = ${userId}
        AND state = 'pending_verification'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    const resumed = Boolean(activeRegistrations[0]);
    let registrationId: string;
    if (resumed) {
      registrationId = String(activeRegistrations[0].id);
      await tx`
        UPDATE registration_transactions
        SET email = ${submission.email},
            first_name = ${submission.firstName},
            last_name = ${submission.lastName},
            entry_kind = ${submission.context.entryKind},
            context = ${tx.json(submission.context)},
            updated_at = now()
        WHERE id = ${registrationId}
      `;
    } else {
      const createdRegistrations = await tx`
        INSERT INTO registration_transactions(
          user_id, email, first_name, last_name, state, entry_kind, context
        )
        VALUES (
          ${userId}, ${submission.email}, ${submission.firstName}, ${submission.lastName},
          'pending_verification', ${submission.context.entryKind}, ${tx.json(submission.context)}
        )
        RETURNING id
      `;
      registrationId = String(createdRegistrations[0].id);
    }

    await tx`
      INSERT INTO registration_attributions(
        registration_id, source, campaign, referral, invitation,
        organization_intent, membership_intent, geography_intent, record_intent, return_to
      )
      VALUES (
        ${registrationId}, ${submission.context.source ?? null}, ${submission.context.campaign ?? null},
        ${submission.context.referral ?? null}, ${submission.context.invitation ?? null},
        ${submission.context.organization ?? null}, ${submission.context.membership ?? null},
        ${submission.context.geography ?? null}, ${submission.context.record ?? null},
        ${submission.context.returnTo ?? null}
      )
      ON CONFLICT (registration_id) DO UPDATE SET
        source = EXCLUDED.source,
        campaign = EXCLUDED.campaign,
        referral = EXCLUDED.referral,
        invitation = EXCLUDED.invitation,
        organization_intent = EXCLUDED.organization_intent,
        membership_intent = EXCLUDED.membership_intent,
        geography_intent = EXCLUDED.geography_intent,
        record_intent = EXCLUDED.record_intent,
        return_to = EXCLUDED.return_to,
        captured_at = now()
    `;

    await tx`
      INSERT INTO identity_policy_acceptances(
        user_id, registration_id, policy_kind, policy_version, request_ip, request_user_agent
      )
      VALUES
        (${userId}, ${registrationId}, 'terms', ${policyVersions.terms}, ${metadata.requestIp ?? null}, ${metadata.userAgent ?? null}),
        (${userId}, ${registrationId}, 'privacy', ${policyVersions.privacy}, ${metadata.requestIp ?? null}, ${metadata.userAgent ?? null})
      ON CONFLICT (user_id, policy_kind, policy_version) DO NOTHING
    `;

    await tx`
      INSERT INTO identity_marketing_consents(user_id, registration_id, consented, recorded_at)
      VALUES (${userId}, ${registrationId}, ${submission.marketingConsent}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        registration_id = EXCLUDED.registration_id,
        consented = EXCLUDED.consented,
        recorded_at = now()
    `;

    await tx`
      INSERT INTO activity_events(event_name, actor_user_id, payload)
      VALUES (
        ${resumed ? "RegistrationResumed" : "RegistrationCreated"},
        ${userId},
        ${tx.json({ registrationId, entryKind: submission.context.entryKind })}
      )
    `;

    return {
      kind: "pending_verification" as const,
      userId,
      registrationId,
      email: submission.email,
      context: submission.context,
      resumed,
    };
  });
}

export async function readRegistration(registrationId: string) {
  const sql = getDatabase();
  const rows = await sql`
    SELECT id, user_id, email, state, context
    FROM registration_transactions
    WHERE id = ${registrationId}
    LIMIT 1
  `;
  const row = rows[0] as
    | { id: string; user_id: string; email: string; state: string; context: RegistrationEntryContext }
    | undefined;
  return row ?? null;
}
