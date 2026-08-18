import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { AuthenticatedIdentityContext, IdentityReadinessSnapshot, SessionCreationResult } from "./contracts";
import { resolvePostLoginDestination } from "./readiness";
import { SESSION_COOKIE_NAME } from "./session-constants";

export { SESSION_COOKIE_NAME };

export class IdentitySessionError extends Error {
  constructor(public readonly code: "invalid_session" | "expired_session" | "restricted" | "invalid_challenge", message: string) {
    super(message);
    this.name = "IdentitySessionError";
  }
}

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readinessFromData(data: Record<string, unknown>, organizationSelected: boolean, accountVerified: boolean): IdentityReadinessSnapshot {
  const onboarding = typeof data.onboarding === "object" && data.onboarding ? data.onboarding as Record<string, unknown> : data;
  return {
    accountVerified,
    organizationSelected,
    geographyComplete: onboarding.geographyComplete === true,
    organizationProfileComplete: onboarding.organizationProfileComplete === true,
    capabilityProfileStarted: onboarding.capabilityProfileStarted === true,
    membershipAccessSatisfied: onboarding.membershipAccessSatisfied === true,
    exchangeReady: onboarding.exchangeReady === true,
    restricted: data.status === "restricted" || data.status === "disabled",
  };
}

export async function resolveAuthenticatedIdentity(firebaseUid: string, providerEmailVerified: boolean): Promise<AuthenticatedIdentityContext> {
  const db = getFirebaseAdminFirestore();
  const identitySnapshot = await db.collection("userIdentities").doc(firebaseUid).get();
  const identity = identitySnapshot.data() as Record<string, unknown> | undefined;
  if (!identitySnapshot.exists || !identity || typeof identity.userId !== "string") {
    return { firebaseUid, userId: firebaseUid, permissions: [], readiness: { accountVerified: false, organizationSelected: false, geographyComplete: false, organizationProfileComplete: false, capabilityProfileStarted: false, membershipAccessSatisfied: false, exchangeReady: false, restricted: false } };
  }

  const userId = identity.userId;
  const userSnapshot = await db.collection("users").doc(userId).get();
  const user = (userSnapshot.data() ?? {}) as Record<string, unknown>;
  const membershipSnapshots = await db.collection("organizationMemberships").where("userId", "==", userId).limit(25).get();
  const memberships = membershipSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string })).filter((membership) => membership.status === "active");
  const preferredOrganization = typeof identity.activeOrganizationId === "string" ? identity.activeOrganizationId : undefined;
  const membership = memberships.find((item) => item.organizationId === preferredOrganization) ?? memberships[0];
  const activeOrganizationId = typeof membership?.organizationId === "string" ? membership.organizationId : undefined;
  const permissions = Array.isArray(membership?.permissions) ? membership.permissions.filter((value): value is string => typeof value === "string") : [];
  const organizationRole = typeof membership?.role === "string" ? membership.role : undefined;
  const accountVerified = identity.accountVerified === true || providerEmailVerified;
  const readiness = readinessFromData({ ...user, status: identity.status ?? user.status }, Boolean(activeOrganizationId), accountVerified);
  if (membership && membership.membershipAccessSatisfied === true) readiness.membershipAccessSatisfied = true;

  return { firebaseUid, userId, activeOrganizationId, organizationRole, permissions, readiness };
}

async function consumeChallenge(challengeId: string, email: string) {
  const db = getFirebaseAdminFirestore();
  const ref = db.collection("authChallenges").doc(challengeId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const challenge = snapshot.data() as { email?: string; status?: string; expiresAt?: Timestamp } | undefined;
    if (!snapshot.exists || !challenge || challenge.email !== email || challenge.status !== "sent") throw new IdentitySessionError("invalid_challenge", "The sign-in challenge is not valid.");
    if (!challenge.expiresAt || challenge.expiresAt.toMillis() <= Date.now()) {
      transaction.update(ref, { status: "expired", expiredAt: Timestamp.now() });
      throw new IdentitySessionError("invalid_challenge", "The sign-in challenge has expired.");
    }
    transaction.update(ref, { status: "consumed", consumedAt: Timestamp.now() });
  });
}

export async function createAuthenticatedSession(input: { idToken: string; challengeId: string; rememberDevice: boolean; returnTo?: string | null; userAgent?: string; country?: string }): Promise<SessionCreationResult> {
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  const decoded = await auth.verifyIdToken(input.idToken, true);
  const authTime = Number(decoded.auth_time ?? 0) * 1000;
  if (!authTime || Date.now() - authTime > 5 * 60 * 1000) throw new IdentitySessionError("invalid_session", "Recent authentication is required.");
  if (!decoded.email) throw new IdentitySessionError("invalid_session", "The authenticated identity does not contain an email address.");
  await consumeChallenge(input.challengeId, decoded.email.toLowerCase());
  const identity = await resolveAuthenticatedIdentity(decoded.uid, decoded.email_verified === true);
  if (identity.readiness.restricted) throw new IdentitySessionError("restricted", "This account is restricted.");

  const standardHours = numberFromEnv("RFX_SESSION_STANDARD_HOURS", 8);
  const rememberedDays = Math.min(14, numberFromEnv("RFX_SESSION_REMEMBERED_DAYS", 14));
  const expiresIn = input.rememberDevice ? rememberedDays * 24 * 60 * 60 * 1000 : standardHours * 60 * 60 * 1000;
  const sessionCookie = await auth.createSessionCookie(input.idToken, { expiresIn });
  const expiresAt = Date.now() + expiresIn;
  const sessionId = digest(sessionCookie);
  await db.collection("authSessions").doc(sessionId).set({ firebaseUid: decoded.uid, userId: identity.userId, activeOrganizationId: identity.activeOrganizationId ?? null, organizationRole: identity.organizationRole ?? null, permissions: identity.permissions, rememberedDevice: input.rememberDevice, userAgent: input.userAgent ?? null, country: input.country ?? null, status: "active", createdAt: Timestamp.now(), lastActivityAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(expiresAt) });
  return { sessionCookie, expiresAt, identity, destination: resolvePostLoginDestination(identity.readiness, input.returnTo) };
}

export async function verifyAuthenticatedSession(sessionCookie: string, touch = false): Promise<AuthenticatedIdentityContext> {
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  let decoded;
  try { decoded = await auth.verifySessionCookie(sessionCookie, true); } catch { throw new IdentitySessionError("invalid_session", "The RFxchange session is invalid or revoked."); }
  const ref = db.collection("authSessions").doc(digest(sessionCookie));
  const snapshot = await ref.get();
  const data = snapshot.data() as { status?: string; lastActivityAt?: Timestamp; expiresAt?: Timestamp } | undefined;
  if (!snapshot.exists || !data || data.status !== "active") throw new IdentitySessionError("invalid_session", "The RFxchange session is no longer active.");
  const now = Date.now();
  if (!data.expiresAt || data.expiresAt.toMillis() <= now) {
    await ref.update({ status: "expired", endedAt: Timestamp.now() }).catch(() => undefined);
    throw new IdentitySessionError("expired_session", "The RFxchange session has expired.");
  }
  const idleMinutes = numberFromEnv("RFX_SESSION_IDLE_MINUTES", 30);
  if (!data.lastActivityAt || now - data.lastActivityAt.toMillis() > idleMinutes * 60 * 1000) {
    await ref.update({ status: "timed_out", endedAt: Timestamp.now() }).catch(() => undefined);
    throw new IdentitySessionError("expired_session", "The RFxchange session timed out after inactivity.");
  }
  const identity = await resolveAuthenticatedIdentity(decoded.uid, decoded.email_verified === true);
  if (identity.readiness.restricted) throw new IdentitySessionError("restricted", "This account is restricted.");
  if (touch) await ref.update({ lastActivityAt: Timestamp.now() });
  return identity;
}

export async function endAuthenticatedSession(sessionCookie: string, allDevices = false) {
  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  let uid: string | undefined;
  try { uid = (await auth.verifySessionCookie(sessionCookie, false)).uid; } catch { uid = undefined; }
  await db.collection("authSessions").doc(digest(sessionCookie)).set({ status: "signed_out", endedAt: Timestamp.now() }, { merge: true }).catch(() => undefined);
  if (allDevices && uid) await auth.revokeRefreshTokens(uid);
}
