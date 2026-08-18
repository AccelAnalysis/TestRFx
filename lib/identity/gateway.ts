import type { MagicLinkRequestInput, MagicLinkRequestResult } from "./contracts";
import { MAGIC_LINK_TTL_SECONDS } from "./login";

export interface IdentityGateway {
  requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult>;
}

/**
 * Chassis-only gateway. It validates the product boundary without claiming to
 * send email or establish a session. Replace this adapter with the selected
 * production identity provider before enabling real participant access.
 */
class ReferenceIdentityGateway implements IdentityGateway {
  async requestMagicLink(_input: MagicLinkRequestInput): Promise<MagicLinkRequestResult> {
    return {
      delivery: "reference",
      expiresInSeconds: MAGIC_LINK_TTL_SECONDS,
    };
  }
}

const referenceGateway = new ReferenceIdentityGateway();

export function getIdentityGateway(): IdentityGateway {
  return referenceGateway;
}
