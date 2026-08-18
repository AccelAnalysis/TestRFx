import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  normalizeEmail,
  type AccountVerificationContext,
  type VerificationChallengeState,
} from "@/lib/identity/account-verification";
import {
  createOnboardingSessionToken,
  createOpaqueVerificationToken,
  hashIdentityToken,
} from "@/lib/identity/account-verification-token";

export const ONBOARDING_SESSION_COOKIE = "rfxchange_onboarding_session";
export const ONBOARDING_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type AccountStatus = "pending_verification" | "onboarding" | "restricted";
type ChallengeReason = "send" | "resend" | "email_change";
type DeliveryState = "pending" | "sent" | "failed";

type StoredAccount = {
  id: string;
  registrationId: string;
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  acceptedTermsAt: string;
  marketingConsent: boolean;
  accountStatus: AccountStatus;
  emailVerifiedAt?: string;
  context: AccountVerificationContext;
  createdAt: string;
  updatedAt: string;
};

type StoredChallenge = {
  id: string;
  accountId: string;
  emailNormalized: string;
  tokenHash: string;
  state: VerificationChallengeState;
  reason: ChallengeReason;
  deliveryState: DeliveryState;
  issuedAt: string;
  expiresAt: string;
  deliveredAt?: string;
  consumedAt?: string;
  revokedAt?: string;
  revokedReason?: string;
  supersededAt?: string;
  supersededBy?: string;
  requestIp?: string;
  requestUserAgent?: string;
};

type StoredSession = {
  id: string;
  accountId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
};

type StoredIdentityEvent = {
  id: string;
  accountId?: string;
  eventName: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

type IdentityStore = {
  version: 1;
  accounts: StoredAccount[];
  challenges: StoredChallenge[];
  sessions: StoredSession[];
  events: StoredIdentityEvent[];
};

export type PendingAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  marketingConsent: boolean;
  context: AccountVerificationContext;
};

export type AccountSnapshot = Pick<
  StoredAccount,
  "id" | "registrationId" | "email" | "emailNormalized" | "accountStatus" | "emailVerifiedAt" | "context"
>;

export type ChallengeSnapshot = Pick<
  StoredChallenge,
  "id" | "state" | "deliveryState" | "issuedAt" | "expiresAt" | "reason"
>;

export type VerificationStatusSnapshot = {
  account: AccountSnapshot;
  latestChallenge?: ChallengeSnapshot;
};

export type IssuedChallenge = {
  challengeId: string;
  token: string;
  email: string;
  registrationId: string;
  context: AccountVerificationContext;
  expiresAt: string;
};

export type ConsumedChallenge = {
  account: AccountSnapshot;
  sessionToken: string;
};

export type IdentityStoreErrorCode =
  | "persistence_not_configured"
  | "storage_corrupt"
  | "account_not_found"
  | "session_invalid"
  | "account_exists"
  | "restricted"
  | "duplicate_email"
  | "rate_limited"
  | "invalid_challenge"
  | "expired_challenge";

export class IdentityStoreError extends Error {
  readonly code: IdentityStoreErrorCode;
  readonly retryAfterSeconds?: number;
  readonly registrationId?: string;

  constructor(
    code: IdentityStoreErrorCode,
    message: string,
    options: { retryAfterSeconds?: number; registrationId?: string } = {},
  ) {
    super(message);
    this.name = "IdentityStoreError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.registrationId = options.registrationId;
  }
}

const emptyStore = (): IdentityStore => ({
  version: 1,
  accounts: [],
  challenges: [],
  sessions: [],
  events: [],
});

let mutationQueue: Promise<void> = Promise.resolve();

function configuredDataDirectory(): string {
  const configured = process.env.RFXCHANGE_DATA_DIR?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new IdentityStoreError(
      "persistence_not_configured",
      "RFXCHANGE_DATA_DIR must be configured for durable identity persistence.",
    );
  }
  return join(process.cwd(), ".data");
}

function storePath(): string {
  return join(configuredDataDirectory(), "identity-verification.json");
}

async function readStore(): Promise<IdentityStore> {
  const path = storePath();
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<IdentityStore>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.challenges) ||
      !Array.isArray(parsed.sessions) ||
      !Array.isArray(parsed.events)
    ) {
      throw new Error("Invalid store shape");
    }
    return parsed as IdentityStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    if (error instanceof IdentityStoreError) throw error;
    throw new IdentityStoreError("storage_corrupt", "Identity persistence could not be read safely.");
  }
}

async function writeStore(store: IdentityStore): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

async function mutateStore<T>(mutation: (store: IdentityStore) => T | Promise<T>): Promise<T> {
  const result = mutationQueue.then(async () => {
    const store = await readStore();
    try {
      const value = await mutation(store);
      await writeStore(store);
      return value;
    } catch (error) {
      // Expected security-state transitions (for example marking a challenge
      // expired or revoked) must survive the error returned to the caller.
      await writeStore(store);
      throw error;
    }
  });
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function accountSnapshot(account: StoredAccount): AccountSnapshot {
  return {
    id: account.id,
    registrationId: account.registrationId,
    email: account.email,
    emailNormalized: account.emailNormalized,
    accountStatus: account.accountStatus,
    emailVerifiedAt: account.emailVerifiedAt,
    context: account.context,
  };
}

function challengeSnapshot(challenge: StoredChallenge): ChallengeSnapshot {
  return {
    id: challenge.id,
    state: challenge.state,
    deliveryState: challenge.deliveryState,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
    reason: challenge.reason,
  };
}

function addEvent(
  store: IdentityStore,
  eventName: string,
  accountId?: string,
  payload: Record<string, unknown> = {},
) {
  store.events.push({
    id: randomUUID(),
    accountId,
    eventName,
    occurredAt: new Date().toISOString(),
    payload,
  });
}

function issueSession(store: IdentityStore, accountId: string, now: Date): string {
  for (const session of store.sessions) {
    if (session.accountId === accountId && !session.revokedAt) session.revokedAt = now.toISOString();
  }

  const raw = createOnboardingSessionToken();
  store.sessions.push({
    id: randomUUID(),
    accountId,
    tokenHash: hashIdentityToken(raw),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ONBOARDING_SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  return raw;
}

function assertSession(store: IdentityStore, account: StoredAccount, rawToken: string | undefined, now: Date) {
  if (!rawToken) throw new IdentityStoreError("session_invalid", "The onboarding session is missing or expired.");
  const tokenHash = hashIdentityToken(rawToken);
  const session = store.sessions.find(
    (item) => item.accountId === account.id && item.tokenHash === tokenHash && !item.revokedAt,
  );
  if (!session || new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw new IdentityStoreError("session_invalid", "The onboarding session is missing or expired.");
  }
}

function findAccountByRegistration(store: IdentityStore, registrationId: string): StoredAccount {
  const account = store.accounts.find((item) => item.registrationId === registrationId);
  if (!account) throw new IdentityStoreError("account_not_found", "The pending registration could not be found.");
  return account;
}

function assertPending(account: StoredAccount) {
  if (account.accountStatus === "restricted") {
    throw new IdentityStoreError("restricted", "This account cannot continue onboarding.");
  }
  if (account.emailVerifiedAt || account.accountStatus === "onboarding") {
    throw new IdentityStoreError("account_exists", "This account email is already verified.", {
      registrationId: account.registrationId,
    });
  }
}

function resendCooldownSeconds(): number {
  const configured = Number(process.env.ACCOUNT_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? "60");
  return Number.isFinite(configured) && configured >= 10 && configured <= 3600 ? Math.floor(configured) : 60;
}

function challengeTtlSeconds(): number {
  const configured = Number(process.env.ACCOUNT_VERIFICATION_TTL_SECONDS ?? ACCOUNT_VERIFICATION_TTL_SECONDS);
  return Number.isFinite(configured) && configured >= 300 && configured <= 86400
    ? Math.floor(configured)
    : ACCOUNT_VERIFICATION_TTL_SECONDS;
}

function createChallenge(
  store: IdentityStore,
  account: StoredAccount,
  reason: ChallengeReason,
  now: Date,
  requestIp?: string,
  requestUserAgent?: string,
): IssuedChallenge {
  const id = randomUUID();
  const rawToken = createOpaqueVerificationToken();

  for (const challenge of store.challenges) {
    if (challenge.accountId === account.id && challenge.state === "issued") {
      challenge.state = "superseded";
      challenge.supersededAt = now.toISOString();
      challenge.supersededBy = id;
    }
  }

  const expiresAt = new Date(now.getTime() + challengeTtlSeconds() * 1000).toISOString();
  store.challenges.push({
    id,
    accountId: account.id,
    emailNormalized: account.emailNormalized,
    tokenHash: hashIdentityToken(rawToken),
    state: "issued",
    reason,
    deliveryState: "pending",
    issuedAt: now.toISOString(),
    expiresAt,
    requestIp,
    requestUserAgent,
  });
  addEvent(
    store,
    reason === "resend" ? "VerificationResent" : reason === "email_change" ? "VerificationEmailChanged" : "VerificationRequested",
    account.id,
    { challengeId: id },
  );

  return {
    challengeId: id,
    token: rawToken,
    email: account.email,
    registrationId: account.registrationId,
    context: account.context,
    expiresAt,
  };
}

export async function createOrResumePendingAccount(input: PendingAccountInput): Promise<{
  account: AccountSnapshot;
  sessionToken: string;
  resumed: boolean;
}> {
  return mutateStore((store) => {
    const now = new Date();
    const normalized = normalizeEmail(input.email);
    const existing = store.accounts.find((item) => item.emailNormalized === normalized);

    if (existing) {
      if (existing.accountStatus === "restricted") {
        throw new IdentityStoreError("restricted", "This account cannot continue registration.");
      }
      if (existing.emailVerifiedAt || existing.accountStatus === "onboarding") {
        throw new IdentityStoreError("account_exists", "An account already exists for this email.");
      }

      existing.updatedAt = now.toISOString();
      const sessionToken = issueSession(store, existing.id, now);
      addEvent(store, "RegistrationResumed", existing.id);
      return { account: accountSnapshot(existing), sessionToken, resumed: true };
    }

    const account: StoredAccount = {
      id: randomUUID(),
      registrationId: `reg_${randomUUID()}`,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.trim(),
      emailNormalized: normalized,
      acceptedTermsAt: now.toISOString(),
      marketingConsent: input.marketingConsent,
      accountStatus: "pending_verification",
      context: input.context,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    store.accounts.push(account);
    const sessionToken = issueSession(store, account.id, now);
    addEvent(store, "AccountCreated", account.id);
    return { account: accountSnapshot(account), sessionToken, resumed: false };
  });
}

export async function getVerificationStatus(
  registrationId: string,
  sessionToken: string | undefined,
): Promise<VerificationStatusSnapshot> {
  const store = await readStore();
  const now = new Date();
  const account = findAccountByRegistration(store, registrationId);
  assertSession(store, account, sessionToken, now);

  const latest = store.challenges
    .filter((challenge) => challenge.accountId === account.id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];

  if (latest && latest.state === "issued" && new Date(latest.expiresAt).getTime() <= now.getTime()) {
    return {
      account: accountSnapshot(account),
      latestChallenge: { ...challengeSnapshot(latest), state: "expired" },
    };
  }

  return {
    account: accountSnapshot(account),
    latestChallenge: latest ? challengeSnapshot(latest) : undefined,
  };
}

export async function issueVerificationChallenge(input: {
  registrationId: string;
  sessionToken?: string;
  reason: "send" | "resend";
  allowWithoutSession?: boolean;
  requestIp?: string;
  requestUserAgent?: string;
}): Promise<IssuedChallenge> {
  return mutateStore((store) => {
    const now = new Date();
    const account = findAccountByRegistration(store, input.registrationId);
    assertPending(account);
    if (!input.allowWithoutSession) assertSession(store, account, input.sessionToken, now);

    const latest = store.challenges
      .filter((challenge) => challenge.accountId === account.id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
    if (latest) {
      const elapsed = Math.floor((now.getTime() - new Date(latest.issuedAt).getTime()) / 1000);
      const cooldown = resendCooldownSeconds();
      if (elapsed < cooldown) {
        throw new IdentityStoreError("rate_limited", "Wait before requesting another verification email.", {
          retryAfterSeconds: cooldown - elapsed,
          registrationId: account.registrationId,
        });
      }
    }

    return createChallenge(store, account, input.reason, now, input.requestIp, input.requestUserAgent);
  });
}

export async function changePendingAccountEmail(input: {
  registrationId: string;
  sessionToken?: string;
  newEmail: string;
  requestIp?: string;
  requestUserAgent?: string;
}): Promise<IssuedChallenge> {
  return mutateStore((store) => {
    const now = new Date();
    const account = findAccountByRegistration(store, input.registrationId);
    assertPending(account);
    assertSession(store, account, input.sessionToken, now);

    const normalized = normalizeEmail(input.newEmail);
    const duplicate = store.accounts.find(
      (item) => item.id !== account.id && item.emailNormalized === normalized,
    );
    if (duplicate) {
      throw new IdentityStoreError("duplicate_email", "Another RFxchange account already uses that email address.");
    }

    account.email = input.newEmail.trim();
    account.emailNormalized = normalized;
    account.updatedAt = now.toISOString();
    return createChallenge(store, account, "email_change", now, input.requestIp, input.requestUserAgent);
  });
}

export async function markChallengeDelivered(challengeId: string): Promise<void> {
  await mutateStore((store) => {
    const challenge = store.challenges.find((item) => item.id === challengeId);
    if (!challenge || challenge.state !== "issued") return;
    challenge.deliveryState = "sent";
    challenge.deliveredAt = new Date().toISOString();
    addEvent(store, "VerificationDeliveryQueued", challenge.accountId, { challengeId });
  });
}

export async function revokeChallengeAfterDeliveryFailure(challengeId: string, reason: string): Promise<void> {
  await mutateStore((store) => {
    const challenge = store.challenges.find((item) => item.id === challengeId);
    if (!challenge || challenge.state !== "issued") return;
    challenge.state = "revoked";
    challenge.deliveryState = "failed";
    challenge.revokedAt = new Date().toISOString();
    challenge.revokedReason = reason.slice(0, 160);
    addEvent(store, "VerificationDeliveryFailed", challenge.accountId, {
      challengeId,
      reason: challenge.revokedReason,
    });
  });
}

export async function consumeVerificationChallenge(rawToken: string): Promise<ConsumedChallenge> {
  return mutateStore((store) => {
    const now = new Date();
    const tokenHash = hashIdentityToken(rawToken);
    const challenge = store.challenges.find((item) => item.tokenHash === tokenHash);
    if (!challenge) throw new IdentityStoreError("invalid_challenge", "This verification link is invalid.");

    const account = store.accounts.find((item) => item.id === challenge.accountId);
    if (!account) throw new IdentityStoreError("invalid_challenge", "This verification link is invalid.");

    // A consumed token is never a reusable authentication/session credential.
    if (challenge.state !== "issued") {
      throw new IdentityStoreError("invalid_challenge", "This verification link is no longer active.", {
        registrationId: account.registrationId,
      });
    }

    if (new Date(challenge.expiresAt).getTime() <= now.getTime()) {
      challenge.state = "expired";
      addEvent(store, "VerificationExpired", account.id, { challengeId: challenge.id });
      throw new IdentityStoreError("expired_challenge", "This verification link has expired.", {
        registrationId: account.registrationId,
      });
    }

    if (challenge.emailNormalized !== account.emailNormalized) {
      challenge.state = "revoked";
      challenge.revokedAt = now.toISOString();
      challenge.revokedReason = "account_email_changed";
      addEvent(store, "VerificationFailed", account.id, {
        challengeId: challenge.id,
        reason: "account_email_changed",
      });
      throw new IdentityStoreError("invalid_challenge", "This verification link is no longer active.", {
        registrationId: account.registrationId,
      });
    }

    challenge.state = "consumed";
    challenge.consumedAt = now.toISOString();
    account.emailVerifiedAt = now.toISOString();
    account.accountStatus = "onboarding";
    account.updatedAt = now.toISOString();

    for (const other of store.challenges) {
      if (other.accountId === account.id && other.id !== challenge.id && other.state === "issued") {
        other.state = "revoked";
        other.revokedAt = now.toISOString();
        other.revokedReason = "account_verified";
      }
    }

    const sessionToken = issueSession(store, account.id, now);
    addEvent(store, "EmailVerified", account.id, { challengeId: challenge.id });
    return { account: accountSnapshot(account), sessionToken };
  });
}

export async function recordIdentityEvent(
  eventName: string,
  accountId?: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await mutateStore((store) => {
    addEvent(store, eventName, accountId, payload);
  });
}
