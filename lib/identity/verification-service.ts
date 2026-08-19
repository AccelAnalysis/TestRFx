import { createHash, randomBytes } from "node:crypto";
import {
  ACCOUNT_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  buildOnboardingContinuation,
  maskEmail,
  normalizeEmail,
  type AccountVerificationContext,
} from "@/lib/identity/account-verification";
import type { RegistrationEntryContext } from "@/lib/identity/registration";
import { deliverVerificationEmail } from "@/lib/identity/identity-email";
import { getDatabase } from "@/lib/server/database";

export class VerificationNotFoundError extends Error {
  constructor(message = "Registration could not be found.") {
    super(message);
    this.name = "VerificationNotFoundError";
  }
}

export class VerificationEmailConflictError extends Error {
  constructor(message = "That email address already belongs to another RFxchange identity.") {
    super(message);
    this.name = "VerificationEmailConflictError";
  }
}

export type VerificationRequestMetadata = {
  requestIp?: string;
  userAgent?: string;
  appOrigin: string;
};

export type IssueVerificationResult =
  | {
      kind: "sent";
      maskedEmail: string;
      expiresInSeconds: number;
    }
  | {
      kind: "rate_limited";
      maskedEmail: string;
      retryAfterSeconds: number;
    };

export type VerifyTokenResult =
  | {
      kind: "verified";
      email: string;
      context: AccountVerificationContext;
      nextPath: string;
    }
  | { kind: "expired" }
  | { kind: "invalid" };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function verificationContextFromRegistration(context: RegistrationEntryContext): AccountVerificationContext {
  const source = context.invitation
    ? "invitation"
    : context.referral
      ? "referral"
      : context.campaign
        ? "campaign"
        : "registration";

  return {
    source,
    invitationId: context.invitation,
    referralId: context.referral,
    campaignId: context.campaign,
    organization: context.organization,
    membership: context.membership,
    geography: context.geography,
    record: context.record,
    returnTo: context.returnTo,
  };
}

function publicOrigin(requestOrigin: string) {
  const configured = process.env.RFXCHANGE_APP_URL?.trim() || requestOrigin;
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("RFXCHANGE_APP_URL must use http or https.");
  }
  return parsed.origin;
}

export async function issueAccountVerification(input: {
  registrationId: string;
  action: "request" | "resend" | "change_email";
  newEmail?: string;
  metadata: VerificationRequestMetadata;
}): Promise<IssueVerificationResult> {
  const sql = getDatabase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ACCOUNT_VERIFICATION_TTL_SECONDS * 1000);

  const challenge = await sql.begin(async (tx) => {
    const registrations = await tx`
      SELECT r.id, r.user_id, r.email, r.context, r.state, u.email_verified_at
      FROM registration_transactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ${input.registrationId}
      LIMIT 1
      FOR UPDATE
    `;
    const registration = registrations[0] as
      | {
          id: string;
          user_id: string;
          email: string;
          context: RegistrationEntryContext;
          state: string;
          email_verified_at: Date | null;
        }
      | undefined;
    if (!registration) throw new VerificationNotFoundError();
    if (registration.email_verified_at || registration.state === "verified") {
      return {
        kind: "already_verified" as const,
        email: registration.email,
      };
    }

    let email = normalizeEmail(registration.email);
    if (input.action === "change_email") {
      const requestedEmail = normalizeEmail(input.newEmail ?? "");
      if (!requestedEmail) throw new VerificationEmailConflictError("Enter a valid replacement email address.");
      const collisions = await tx`
        SELECT id
        FROM users
        WHERE lower(btrim(email)) = ${requestedEmail}
          AND id <> ${registration.user_id}
        LIMIT 1
      `;
      if (collisions[0]) throw new VerificationEmailConflictError();
      email = requestedEmail;
      await tx`
        UPDATE users
        SET email = ${email}
        WHERE id = ${registration.user_id}
      `;
      await tx`
        UPDATE registration_transactions
        SET email = ${email}, updated_at = now()
        WHERE id = ${registration.id}
      `;
    }

    await tx`
      UPDATE email_verification_challenges
      SET state = 'expired'
      WHERE user_id = ${registration.user_id}
        AND state = 'issued'
        AND expires_at <= now()
    `;

    const recentChallenges = await tx`
      SELECT issued_at, extract(epoch from (now() - issued_at)) AS age_seconds
      FROM email_verification_challenges
      WHERE user_id = ${registration.user_id}
        AND state = 'issued'
      ORDER BY issued_at DESC
      LIMIT 1
    `;
    const recent = recentChallenges[0] as { issued_at: Date; age_seconds: number | string } | undefined;
    if (recent) {
      const ageSeconds = Number(recent.age_seconds);
      if (Number.isFinite(ageSeconds) && ageSeconds < ACCOUNT_VERIFICATION_RESEND_COOLDOWN_SECONDS) {
        return {
          kind: "rate_limited" as const,
          email,
          retryAfterSeconds: Math.max(1, Math.ceil(ACCOUNT_VERIFICATION_RESEND_COOLDOWN_SECONDS - ageSeconds)),
        };
      }
    }

    await tx`
      UPDATE email_verification_challenges
      SET state = 'superseded'
      WHERE user_id = ${registration.user_id}
        AND state = 'issued'
    `;

    const context = verificationContextFromRegistration(registration.context);
    const inserted = await tx`
      INSERT INTO email_verification_challenges(
        user_id, registration_id, email, token_hash, state, expires_at,
        request_context, request_ip, request_user_agent
      )
      VALUES (
        ${registration.user_id}, ${registration.id}, ${email}, ${tokenHash}, 'issued', ${expiresAt},
        ${tx.json(context)}, ${input.metadata.requestIp ?? null}, ${input.metadata.userAgent ?? null}
      )
      RETURNING id
    `;

    return {
      kind: "created" as const,
      challengeId: String(inserted[0].id),
      userId: registration.user_id,
      registrationId: registration.id,
      email,
      context,
    };
  });

  if (challenge.kind === "already_verified") {
    return { kind: "sent", maskedEmail: maskEmail(challenge.email), expiresInSeconds: 0 };
  }
  if (challenge.kind === "rate_limited") {
    return {
      kind: "rate_limited",
      maskedEmail: maskEmail(challenge.email),
      retryAfterSeconds: challenge.retryAfterSeconds,
    };
  }

  const verificationUrl = `${publicOrigin(input.metadata.appOrigin)}/onboarding/account-verification?token=${encodeURIComponent(token)}&registration=${encodeURIComponent(challenge.registrationId)}`;

  try {
    await deliverVerificationEmail({
      to: challenge.email,
      verificationUrl,
      expiresInMinutes: Math.ceil(ACCOUNT_VERIFICATION_TTL_SECONDS / 60),
    });
    await sql`
      INSERT INTO identity_email_deliveries(
        challenge_id, user_id, registration_id, recipient_email, message_type, delivery_state
      )
      VALUES (
        ${challenge.challengeId}, ${challenge.userId}, ${challenge.registrationId}, ${challenge.email},
        'account_verification', 'sent'
      )
    `;
    await sql`
      INSERT INTO activity_events(event_name, actor_user_id, payload)
      VALUES ('RegistrationVerificationSent', ${challenge.userId}, ${sql.json({ registrationId: challenge.registrationId })})
    `;
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Identity email delivery failed.";
    await sql.begin(async (tx) => {
      await tx`
        UPDATE email_verification_challenges
        SET state = 'revoked', revoked_at = now()
        WHERE id = ${challenge.challengeId}
          AND state = 'issued'
      `;
      await tx`
        INSERT INTO identity_email_deliveries(
          challenge_id, user_id, registration_id, recipient_email, message_type, delivery_state, detail
        )
        VALUES (
          ${challenge.challengeId}, ${challenge.userId}, ${challenge.registrationId}, ${challenge.email},
          'account_verification', 'failed', ${detail}
        )
      `;
    });
    throw error;
  }

  return {
    kind: "sent",
    maskedEmail: maskEmail(challenge.email),
    expiresInSeconds: ACCOUNT_VERIFICATION_TTL_SECONDS,
  };
}

export async function verifyAccountVerificationToken(token: string): Promise<VerifyTokenResult> {
  if (!token) return { kind: "invalid" };
  const sql = getDatabase();
  const tokenHash = hashToken(token);

  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT c.id, c.user_id, c.registration_id, c.email, c.state, c.expires_at, c.request_context
      FROM email_verification_challenges c
      WHERE c.token_hash = ${tokenHash}
      LIMIT 1
      FOR UPDATE
    `;
    const challenge = rows[0] as
      | {
          id: string;
          user_id: string;
          registration_id: string | null;
          email: string;
          state: string;
          expires_at: Date;
          request_context: AccountVerificationContext;
        }
      | undefined;
    if (!challenge || challenge.state !== "issued") return { kind: "invalid" as const };

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await tx`
        UPDATE email_verification_challenges
        SET state = 'expired'
        WHERE id = ${challenge.id}
      `;
      return { kind: "expired" as const };
    }

    await tx`
      UPDATE email_verification_challenges
      SET state = 'consumed', consumed_at = now()
      WHERE id = ${challenge.id}
    `;
    await tx`
      UPDATE users
      SET email_verified_at = now(), account_status = 'verified'
      WHERE id = ${challenge.user_id}
    `;
    if (challenge.registration_id) {
      await tx`
        UPDATE registration_transactions
        SET state = 'verified', completed_at = now(), updated_at = now()
        WHERE id = ${challenge.registration_id}
      `;
    }
    await tx`
      INSERT INTO activity_events(event_name, actor_user_id, payload)
      VALUES (
        'RegistrationEmailVerified', ${challenge.user_id},
        ${tx.json({ registrationId: challenge.registration_id })}
      )
    `;

    return {
      kind: "verified" as const,
      email: challenge.email,
      context: challenge.request_context,
      nextPath: buildOnboardingContinuation(challenge.request_context),
    };
  });
}
