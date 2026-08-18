import type { TransactionalEmailMessage, TransactionalEmailProvider } from "./transactional-email";

type MicrosoftMailConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
};

function requireConfig(): MicrosoftMailConfig {
  const config = {
    tenantId: process.env.MICROSOFT_TENANT_ID,
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    sender: process.env.MICROSOFT_MAIL_SENDER,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Microsoft transactional email configuration is missing: ${missing.join(", ")}.`);
  return config as MicrosoftMailConfig;
}

async function accessToken(config: MicrosoftMailConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Microsoft token request failed (${response.status}).`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Microsoft token response did not contain an access token.");
  return payload.access_token;
}

export class MicrosoftGraphMailProvider implements TransactionalEmailProvider {
  async send(message: TransactionalEmailMessage): Promise<void> {
    const config = requireConfig();
    const token = await accessToken(config);
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: { contentType: "HTML", content: message.html },
            toRecipients: [{ emailAddress: { address: message.to } }],
          },
          saveToSentItems: true,
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`Microsoft Graph sendMail failed (${response.status}).`);
  }
}

let provider: TransactionalEmailProvider | undefined;
export function getTransactionalEmailProvider(): TransactionalEmailProvider {
  provider ??= new MicrosoftGraphMailProvider();
  return provider;
}
