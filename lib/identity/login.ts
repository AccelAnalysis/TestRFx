export const DEFAULT_LOGIN_RETURN_TO = "/exchange";
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;

const SAFE_RETURN_PREFIXES = ["/exchange", "/onboarding"] as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sanitizeReturnTo(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_LOGIN_RETURN_TO;
  }

  try {
    const base = "https://rfxchange.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return DEFAULT_LOGIN_RETURN_TO;

    const allowed = SAFE_RETURN_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    );

    return allowed
      ? `${url.pathname}${url.search}${url.hash}`
      : DEFAULT_LOGIN_RETURN_TO;
  } catch {
    return DEFAULT_LOGIN_RETURN_TO;
  }
}

export function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return value;

  const visible = localPart.slice(0, 1);
  const hiddenLength = Math.max(3, Math.min(7, localPart.length - 1));
  return `${visible}${"•".repeat(hiddenLength)}@${domain}`;
}
