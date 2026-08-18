export type EmailDeliveryErrorCode = "not_configured" | "delivery_failed" | "invalid_origin";

export class EmailDeliveryError extends Error {
  readonly code: EmailDeliveryErrorCode;

  constructor(code: EmailDeliveryErrorCode, message: string) {
    super(message);
    this.name = "EmailDeliveryError";
    this.code = code;
  }
}

type DeliveryPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  tags: Record<string, string>;
};

function deliveryConfiguration() {
  const url = process.env.RFXCHANGE_EMAIL_DELIVERY_URL?.trim();
  const from = process.env.RFXCHANGE_EMAIL_FROM?.trim();
  const token = process.env.RFXCHANGE_EMAIL_DELIVERY_TOKEN?.trim();
  if (!url || !from) {
    throw new EmailDeliveryError(
      "not_configured",
      "Transactional email delivery is not configured for this environment.",
    );
  }
  return { url, from, token };
}

async function deliver(payload: Omit<DeliveryPayload, "from">): Promise<void> {
  const configuration = deliveryConfiguration();
  const response = await fetch(configuration.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(configuration.token ? { Authorization: `Bearer ${configuration.token}` } : {}),
    },
    body: JSON.stringify({ ...payload, from: configuration.from }),
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    throw new EmailDeliveryError("delivery_failed", "The verification email could not be delivered.");
  }
}

export function resolveApplicationOrigin(requestOrigin: string): string {
  const configured = process.env.RFXCHANGE_APP_ORIGIN?.trim();
  const candidate = configured || (process.env.NODE_ENV === "production" ? "" : requestOrigin);
  if (!candidate) {
    throw new EmailDeliveryError(
      "invalid_origin",
      "RFXCHANGE_APP_ORIGIN must be configured before verification emails can be sent.",
    );
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
      throw new Error("Unsupported origin");
    }
    return url.origin;
  } catch {
    throw new EmailDeliveryError("invalid_origin", "RFXCHANGE_APP_ORIGIN is not a valid application origin.");
  }
}

export async function sendAccountVerificationEmail(input: {
  to: string;
  verificationUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const subject = "Verify your RFxchange email";
  const text = [
    "Verify your RFxchange email",
    "",
    "Complete your account setup by opening this one-time verification link:",
    input.verificationUrl,
    "",
    `This link expires in ${input.expiresInMinutes} minutes.`,
    "If you did not create an RFxchange account, you can ignore this message.",
  ].join("\n");
  const html = `<!doctype html><html><body><h1>Verify your RFxchange email</h1><p>Complete your account setup by opening the one-time link below.</p><p><a href="${escapeHtml(input.verificationUrl)}">Verify Email</a></p><p>This link expires in ${input.expiresInMinutes} minutes.</p><p>If you did not create an RFxchange account, you can ignore this message.</p></body></html>`;

  await deliver({
    to: input.to,
    subject,
    text,
    html,
    tags: { product: "RFxchange", messageType: "account_verification" },
  });
}

export async function sendAccountVerifiedConfirmation(to: string): Promise<void> {
  await deliver({
    to,
    subject: "Your RFxchange email is verified",
    text: "Your RFxchange account email has been verified. Continue onboarding to connect your account to an organization.",
    html: "<!doctype html><html><body><h1>Email verified</h1><p>Your RFxchange account email has been verified. Continue onboarding to connect your account to an organization.</p></body></html>",
    tags: { product: "RFxchange", messageType: "account_verified" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
