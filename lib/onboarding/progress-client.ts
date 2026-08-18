"use client";

import type { OnboardingProgressState, OnboardingProgressUpdate } from "./progress";

export async function recordOnboardingProgress(update: OnboardingProgressUpdate): Promise<OnboardingProgressState> {
  const response = await fetch("/api/onboarding/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
    cache: "no-store",
  });

  const payload = (await response.json()) as { error?: string; progress?: OnboardingProgressState };
  if (!response.ok || !payload.progress) {
    throw new Error(payload.error ?? "Onboarding progress could not be saved.");
  }
  return payload.progress;
}
