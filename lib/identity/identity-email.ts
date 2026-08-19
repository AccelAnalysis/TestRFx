export class IdentityEmailConfigurationError extends Error {
  constructor(message = "Identity email delivery is not configured.") {
    super(message);
    this.name = "IdentityEmailConfigurationError";
  }
}

export class IdentityEmailDeliveryError extends Error {
  constructor(message = "Identity email delivery failed.") {
    super(message);
    this.name = "IdentityEmailDeliveryError";
  }
}

type VerificationEmailInput = {
  to: string;
  verificationUrl: string;
  expiresInMinutes: number;
};

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function deliverVerificationEmail(input: VerificationEmailInput) {
  const deliveryUrl = process.env.IDENTITY_EMAIL_DELIVERY_URL?.trim();
  const from = process.env.IDENTITY_EMAIL_FROM?.trim();
  const token = process.env.IDENTITY_EMAIL_DELIVERY_TOKEN?.trim();

  if (!deliveryUrl || !from) {
    throw new IdentityEmailConfigurationError(
      "IDENTITY_EMAIL_DELIVERY_URL and IDENTITY_EMAIL_FROM are required to send verification email.",
    );
  }

  const subject = "Verify your RFxchange account";
  const text = [
    "Verify your RFxchange account",
    "",
    `Open this secure, single-use link within ${input.expiresInMinutes} minutes:`,
    input.verificationUrl,
    "",
    "If you did not request this account, you can ignore this message.",
  ].join("\n");
  const safeUrl = htmlEscape(input.verificationUrl);
  const html = `<p>Verify your RFxchange account.</p><p><a href="${safeUrl}">Verify email</a></p><p>This secure, single-use link expires in ${input.expiresInMinutes} minutes.</p><p>If you did not request this account, you can ignore this message.</p>`;

  let response: Response;
  try {
    response = await fetch(deliveryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messageType: "account_verification",
        from,
        to: input.to,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new IdentityEmailDeliveryError(
      error instanceof Error ? `Identity email transport failed: ${error.message}` : undefined,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 240);
    throw new IdentityEmailDeliveryError(
      `Identity email transport returned ${response.status}${detail ? `: ${detail}` : "."}`,
    );
  }
}
