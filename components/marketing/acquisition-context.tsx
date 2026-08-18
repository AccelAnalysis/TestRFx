"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "rfxchange:acquisition-context";
const PASSTHROUGH_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "partner",
  "referral",
  "invitation",
  "opportunity",
  "geography",
] as const;

type AcquisitionContext = {
  source?: string;
  medium?: string;
  campaign?: string;
  partner?: string;
  referral?: string;
  invitation?: string;
  opportunity?: string;
  geography?: string;
  landingPath: string;
  firstSeenAt: string;
};

function readContext(): AcquisitionContext | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as AcquisitionContext) : null;
  } catch {
    return null;
  }
}

function inferSource(params: URLSearchParams) {
  const explicit = params.get("utm_source");
  if (explicit) return explicit;
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "referral";
  }
}

export function AcquisitionContextCapture() {
  useEffect(() => {
    if (readContext()) return;
    const params = new URLSearchParams(window.location.search);
    const context: AcquisitionContext = {
      source: inferSource(params),
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      partner: params.get("partner") ?? undefined,
      referral: params.get("referral") ?? undefined,
      invitation: params.get("invitation") ?? undefined,
      opportunity: params.get("opportunity") ?? undefined,
      geography: params.get("geography") ?? undefined,
      landingPath: `${window.location.pathname}${window.location.search}`,
      firstSeenAt: new Date().toISOString(),
    };
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      // Session storage is an enhancement. The marketing journey still works without it.
    }
  }, []);

  return null;
}

function contextualHref(href: string) {
  const target = new URL(href, window.location.origin);
  const current = new URLSearchParams(window.location.search);

  for (const key of PASSTHROUGH_KEYS) {
    const value = current.get(key);
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }

  const stored = readContext();
  if (stored) {
    const storedParams: Array<[string, string | undefined]> = [
      ["utm_source", stored.source],
      ["utm_medium", stored.medium],
      ["utm_campaign", stored.campaign],
      ["partner", stored.partner],
      ["referral", stored.referral],
      ["invitation", stored.invitation],
      ["opportunity", stored.opportunity],
      ["geography", stored.geography],
    ];
    for (const [key, value] of storedParams) {
      if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
    }
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

export function ConversionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [target, setTarget] = useState(href);

  useEffect(() => {
    setTarget(contextualHref(href));
  }, [href]);

  return (
    <Link className={className} href={target}>
      {children}
    </Link>
  );
}
