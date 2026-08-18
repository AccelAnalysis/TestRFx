import type { NextRequest, NextResponse } from "next/server";
import {
  createEmptyOnboardingProgress,
  mergeOnboardingProgress,
  type OnboardingProgressState,
  type OnboardingProgressUpdate,
} from "./progress";

export const ONBOARDING_PROGRESS_COOKIE = "rfxchange_onboarding_progress";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function decodeProgress(raw: string | undefined): OnboardingProgressState {
  if (!raw) return createEmptyOnboardingProgress();
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const value = JSON.parse(decoded) as Partial<OnboardingProgressState>;
    if (value.version !== 1 || !value.checkpoints || typeof value.checkpoints !== "object") {
      return createEmptyOnboardingProgress();
    }
    return {
      version: 1,
      checkpoints: value.checkpoints,
      context: value.context && typeof value.context === "object" ? value.context : {},
      activation: value.activation,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createEmptyOnboardingProgress();
  }
}

function encodeProgress(progress: OnboardingProgressState): string {
  return Buffer.from(JSON.stringify(progress), "utf8").toString("base64url");
}

export function readOnboardingProgressFromRequest(request: NextRequest): OnboardingProgressState {
  return decodeProgress(request.cookies.get(ONBOARDING_PROGRESS_COOKIE)?.value);
}

export function readOnboardingProgressCookie(raw: string | undefined): OnboardingProgressState {
  return decodeProgress(raw);
}

export function writeOnboardingProgressCookie(
  response: NextResponse,
  progress: OnboardingProgressState,
): void {
  response.cookies.set({
    name: ONBOARDING_PROGRESS_COOKIE,
    value: encodeProgress(progress),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function applyOnboardingProgressUpdate(
  request: NextRequest,
  response: NextResponse,
  update: OnboardingProgressUpdate,
): OnboardingProgressState {
  const current = readOnboardingProgressFromRequest(request);
  const next = mergeOnboardingProgress(current, update);
  writeOnboardingProgressCookie(response, next);
  return next;
}
