import {
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  buildOnboardingContinuation,
  maskEmail,
  type VerificationRequestResponse,
  type VerificationStatusResponse,
  type VerificationSuccessResponse,
} from "@/lib/identity/account-verification";
import {
  EmailDeliveryError,
  resolveApplicationOrigin,
  sendAccountVerificationEmail,
  sendAccountVerifiedConfirmation,
} from "@/lib/identity/account-verification-mailer";
import {
  changePendingAccountEmail,
  consumeVerificationChallenge,
  getVerificationStatus,
  issueVerificationChallenge,
  markChallengeDelivered,
  recordIdentityEvent,
  revokeChallengeAfterDeliveryFailure,
} from "@/lib/identity/account-verification-store";

export async function readAccountVerificationStatus(input: {
  registrationId: string;
  sessionToken?: string;
}): Promise<VerificationStatusResponse> {
  const snapshot = await getVerificationStatus(input.registrationId, input.sessionToken);
  const verified = Boolean(snapshot.account.emailVerifiedAt);
  return {
    state: verified ? "verified" : "pending",
    registrationId: snapshot.account.registrationId,
    maskedEmail: maskEmail(snapshot.account.email),
    latestDeliveryState: snapshot.latestChallenge?.deliveryState,
    latestChallengeState: snapshot.latestChallenge?.state,
    ...(verified ? { nextPath: buildOnboardingContinuation(snapshot.account.context) } : {}),
  };
}

async function deliverChallenge(input: {
  challenge: Awaited<ReturnType<typeof issueVerificationChallenge>>;
  requestOrigin: string;
}): Promise<VerificationRequestResponse> {
  const origin = resolveApplicationOrigin(input.requestOrigin);
  const path = "/onboarding/account-verification/verify-email-access/verification-link";
  const verificationUrl = new URL(path, origin);
  verificationUrl.searchParams.set("token", input.challenge.token);
  verificationUrl.searchParams.set("registration", input.challenge.registrationId);

  try {
    const expiresInSeconds = Math.max(
      1,
      Math.floor((new Date(input.challenge.expiresAt).getTime() - Date.now()) / 1000),
    );
    await sendAccountVerificationEmail({
      to: input.challenge.email,
      verificationUrl: verificationUrl.toString(),
      expiresInMinutes: Math.max(1, Math.ceil(expiresInSeconds / 60)),
    });
    await markChallengeDelivered(input.challenge.challengeId);
    return {
      state: "pending",
      registrationId: input.challenge.registrationId,
      maskedEmail: maskEmail(input.challenge.email),
      expiresInSeconds,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "verification_delivery_failed";
    await revokeChallengeAfterDeliveryFailure(input.challenge.challengeId, reason);
    throw error;
  }
}

export async function sendVerification(input: {
  registrationId: string;
  sessionToken?: string;
  reason: "send" | "resend";
  requestOrigin: string;
  requestIp?: string;
  requestUserAgent?: string;
}): Promise<VerificationRequestResponse> {
  const challenge = await issueVerificationChallenge({
    registrationId: input.registrationId,
    sessionToken: input.sessionToken,
    reason: input.reason,
    allowWithoutSession: input.reason === "resend",
    requestIp: input.requestIp,
    requestUserAgent: input.requestUserAgent,
  });
  return deliverChallenge({ challenge, requestOrigin: input.requestOrigin });
}

export async function changeVerificationEmail(input: {
  registrationId: string;
  sessionToken?: string;
  newEmail: string;
  requestOrigin: string;
  requestIp?: string;
  requestUserAgent?: string;
}): Promise<VerificationRequestResponse> {
  const challenge = await changePendingAccountEmail({
    registrationId: input.registrationId,
    sessionToken: input.sessionToken,
    newEmail: input.newEmail,
    requestIp: input.requestIp,
    requestUserAgent: input.requestUserAgent,
  });
  return deliverChallenge({ challenge, requestOrigin: input.requestOrigin });
}

export async function verifyAccountEmail(token: string): Promise<{
  response: VerificationSuccessResponse;
  sessionToken: string;
}> {
  const result = await consumeVerificationChallenge(token);
  const response: VerificationSuccessResponse = {
    state: "verified",
    registrationId: result.account.registrationId,
    maskedEmail: maskEmail(result.account.email),
    context: result.account.context,
    nextPath: buildOnboardingContinuation(result.account.context),
  };

  try {
    await sendAccountVerifiedConfirmation(result.account.email);
  } catch (error) {
    await recordIdentityEvent("VerificationConfirmationDeliveryFailed", result.account.id, {
      reason: error instanceof EmailDeliveryError ? error.code : "delivery_failed",
    }).catch(() => undefined);
  }

  return { response, sessionToken: result.sessionToken };
}

export function configuredVerificationTtlSeconds(): number {
  const configured = Number(process.env.ACCOUNT_VERIFICATION_TTL_SECONDS ?? ACCOUNT_VERIFICATION_TTL_SECONDS);
  return Number.isFinite(configured) && configured >= 300 && configured <= 86400
    ? Math.floor(configured)
    : ACCOUNT_VERIFICATION_TTL_SECONDS;
}
