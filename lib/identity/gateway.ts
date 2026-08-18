import { createHash, randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { ActionCodeSettings } from "firebase-admin/auth";
import { getTransactionalEmailProvider } from "@/lib/communications/microsoft-graph-mail";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { LoginApiErrorCode, MagicLinkRequestInput, MagicLinkRequestResult } from "./contracts";
import { MAGIC_LINK_TTL_SECONDS } from "./login";

export interface IdentityGateway {
  requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult>;
}

export class IdentityGatewayError extends Error {
  constructor(public readonly code: LoginApiErrorCode, message: string) {
    super(message);
    this.name = "IdentityGatewayError";
  }
}

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function monitoredIp(ipAddress?: string) {
  const salt = process.env.RFX_LOGIN_MONITORING_SALT;
  return ipAddress && salt ? hash(`${salt}:${ipAddress}`) : undefined;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

class FirebaseIdentityGateway implements IdentityGateway {
  async requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult> {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    await this.enforceRateLimit(input.email, input.ipAddress);

    let user;
    try {
      user = await auth.getUserByEmail(input.email);
    } catch (error) {
      if ((error as { code?: string }).code === "auth/user-not-found") {
        throw new IdentityGatewayError("account_not_found", "No RFxchange account was found for that email address.");
      }
      throw error;
    }
    if (user.disabled) throw new IdentityGatewayError("account_restricted", "This RFxchange account cannot sign in right now.");

    const challengeId = randomUUID();
    const now = Date.now();
    const expiresAt = now + MAGIC_LINK_TTL_SECONDS * 1000;
    const continueUrl = new URL(input.continueUrl);
    continueUrl.searchParams.set("challenge", challengeId);
    if (input.rememberDevice) continueUrl.searchParams.set("remember", "1");

    const settings: ActionCodeSettings = {
      url: continueUrl.toString(),
      handleCodeInApp: true,
      ...(process.env.FIREBASE_AUTH_LINK_DOMAIN ? { linkDomain: process.env.FIREBASE_AUTH_LINK_DOMAIN } : {}),
    };

    const link = await auth.generateSignInWithEmailLink(input.email, settings);
    const challengeRef = db.collection("authChallenges").doc(challengeId);
    await challengeRef.set({
      type: "email_link_sign_in",
      firebaseUid: user.uid,
      email: input.email,
      status: "pending_delivery",
      rememberDevice: input.rememberDevice,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      userAgent: input.userAgent ?? null,
      ipHash: monitoredIp(input.ipAddress) ?? null,
      country: input.country ?? null,
    });

    try {
      await getTransactionalEmailProvider().send({
        to: input.email,
        subject: "Your RFxchange sign-in link",
        text: `Use this one-time link to sign in to RFxchange: ${link}\n\nThis RFxchange challenge expires in 15 minutes.`,
        html: `<p>Use the button below to sign in to RFxchange.</p><p><a href="${escapeHtml(link)}">Sign in to RFxchange</a></p><p>This RFxchange challenge expires in 15 minutes and can be used once.</p>`,
      });
      await challengeRef.update({ status: "sent", deliveredAt: Timestamp.now() });
    } catch (error) {
      await challengeRef.update({ status: "delivery_failed", failedAt: Timestamp.now() }).catch(() => undefined);
      throw new IdentityGatewayError("provider_unavailable", "RFxchange could not deliver the sign-in email. Try again shortly.");
    }

    return { challengeId, expiresInSeconds: MAGIC_LINK_TTL_SECONDS };
  }

  private async enforceRateLimit(email: string, ipAddress?: string) {
    const db = getFirebaseAdminFirestore();
    const windowSeconds = numberFromEnv("RFX_LOGIN_RATE_WINDOW_SECONDS", 600);
    const maxAttempts = numberFromEnv("RFX_LOGIN_RATE_MAX_ATTEMPTS", 5);
    const key = hash(`${email}|${ipAddress ?? "unknown"}`);
    const ref = db.collection("authRateLimits").doc(key);
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data() as { count?: number; windowStartedAt?: Timestamp } | undefined;
      const started = data?.windowStartedAt?.toMillis() ?? 0;
      if (!snapshot.exists || now - started >= windowSeconds * 1000) {
        transaction.set(ref, { count: 1, windowStartedAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now) });
        return;
      }
      if ((data?.count ?? 0) >= maxAttempts) {
        throw new IdentityGatewayError("rate_limited", "Too many sign-in attempts. Try again after the security window resets.");
      }
      transaction.update(ref, { count: (data?.count ?? 0) + 1, updatedAt: Timestamp.fromMillis(now) });
    });
  }
}

let gateway: IdentityGateway | undefined;
export function getIdentityGateway(): IdentityGateway {
  gateway ??= new FirebaseIdentityGateway();
  return gateway;
}
