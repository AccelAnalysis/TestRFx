import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();

async function write(relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Pages preview preparation could not find ${label}.`);
  }
  return source.replace(search, replacement);
}

// GitHub Pages is a static host. Runtime API routes stay in the repository and
// production build; they are removed only from this ephemeral Actions workspace.
await rm(join(root, "app/api"), { recursive: true, force: true });

await write(
  "app/join/page.tsx",
  `import Link from "next/link";

export default function JoinEntryPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange preview</p>
        <h1>Join RFxchange</h1>
        <p className="muted">This static preview preserves the acquisition-to-identity handoff visually. Campaign and referral context are handled by the production runtime.</p>
        <Link className="button button-primary button-full" href="/register">Continue to registration</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/signin/page.tsx",
  `import Link from "next/link";

export default function SignInEntryPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange preview</p>
        <h1>Sign in to RFxchange</h1>
        <p className="muted">This static preview preserves the acquisition-to-identity handoff visually. Session establishment remains a production runtime responsibility.</p>
        <Link className="button button-primary button-full" href="/login">Continue to sign in</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/auth/page.tsx",
  `import Link from "next/link";
import styles from "./auth-entry.module.css";

export default function AuthEntryPage() {
  return (
    <main className="identity-shell">
      <section className="identity-card">
        <p className="eyebrow">RFxchange access</p>
        <h1>Enter the Exchange</h1>
        <p className="muted">Choose how to continue. Journey attribution and invitation context remain connected to the production identity boundary.</p>
        <div className={styles.actions}>
          <Link className="button button-primary button-full" href="/register">Join Free</Link>
          <Link className="button button-secondary button-full" href="/login">Sign In</Link>
        </div>
        <p className="identity-footer"><Link href="/">Return to RFxchange</Link></p>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/login/page.tsx",
  `import Link from "next/link";
import { LoginFlow } from "@/components/identity/LoginFlow";
import styles from "@/components/identity/login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brandRow}><span className={styles.brandMark} aria-hidden="true">RF</span><span>RFxchange</span></div>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="login-title" className={styles.title}>Sign in to the Exchange</h1>
        <p className={styles.copy}>Secure access for registered participants. Authentication submission is intentionally not provided by the static Pages preview.</p>
        <LoginFlow initialReturnTo="/exchange/rfx" />
        <div className={styles.metaLinks}><Link href="/">Back to RFxchange</Link><span aria-hidden="true">·</span><span>One identity across every Exchange lens</span></div>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/register/page.tsx",
  `import { RegistrationForm } from "@/components/identity/registration-form";
import { registrationContextFromSearchParams } from "@/lib/identity/registration";

export default function RegisterPage() {
  return (
    <main className="identity-shell">
      <RegistrationForm initialContext={registrationContextFromSearchParams({})} />
    </main>
  );
}
`,
);

await write(
  "app/onboarding/membership/page.tsx",
  `import type { Metadata } from "next";
import Link from "next/link";
import { formatUsdCents, foundingMembership } from "@/lib/membership/catalog";
import styles from "./membership.module.css";

export const metadata: Metadata = { title: "Participation & Membership | RFxchange" };

export default function MembershipSelectionPage() {
  const price = formatUsdCents(foundingMembership.price.cents);
  return (
    <main className="identity-shell onboarding-shell">
      <section className="identity-card onboarding-card">
        <p className="eyebrow">Static preview</p>
        <h1>Participation & membership</h1>
        <p className="muted">The production runtime can activate Free organization participation through the onboarding progress service. GitHub Pages has no API runtime, so this preview does not grant an entitlement.</p>
        <div className={styles.planGrid}>
          <article className={styles.summary}>
            <div className={styles.summaryHeader}><div><p className="eyebrow">Core participation</p><h2>Free organization</h2></div><div className={styles.price}>$0 <small>/ month</small></div></div>
            <div className={styles.integrationNote}>Production action: activate a real Free participation checkpoint. Static preview action is intentionally disabled.</div>
            <button className={styles.disabledButton} disabled>Runtime required</button>
          </article>
          <article className={styles.summary}>
            <div className={styles.summaryHeader}><div><p className="eyebrow">Optional membership</p><h2>{foundingMembership.name}</h2></div><div className={styles.price}>{price} <small>/ month</small></div></div>
            <div className={styles.integrationNote}>Founding Membership requires genuine Stripe checkout and payment confirmation. No payment is simulated in the preview.</div>
            <button className={styles.disabledButton} disabled>Secure checkout unavailable</button>
          </article>
        </div>
        <Link className={styles.backLink} href="/onboarding/completion">Continue previewing onboarding</Link>
      </section>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/organization-profile/page.tsx",
  `import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";
import { organizationProfileContextFromSearchParams } from "@/lib/onboarding/organization-profile";

export default function OrganizationProfilePage() {
  return <OrganizationProfileForm initialContext={organizationProfileContextFromSearchParams({})} />;
}
`,
);

await write(
  "app/onboarding/completion/page.tsx",
  `import { ExchangeReadyCompletion } from "@/components/onboarding/exchange-ready-completion";
import { buildExchangeReadiness, resolveExchangeDestination } from "@/lib/onboarding/readiness";
import { createEmptyOnboardingProgress } from "@/lib/onboarding/progress";

export default function CompletionPage() {
  return (
    <ExchangeReadyCompletion
      readiness={buildExchangeReadiness(createEmptyOnboardingProgress())}
      returnTo={resolveExchangeDestination(undefined)}
    />
  );
}
`,
);

await write(
  "app/onboarding/completion/activate/page.tsx",
  `import Link from "next/link";
import { CompletionNavigation } from "@/components/onboarding/completion-navigation";
import styles from "@/components/onboarding/completion-transition.module.css";
import { buildExchangeReadiness } from "@/lib/onboarding/readiness";
import { createEmptyOnboardingProgress } from "@/lib/onboarding/progress";

export default function CompletionActivationPage() {
  const readiness = buildExchangeReadiness(createEmptyOnboardingProgress());
  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}><span className={styles.brand}>RFxchange</span><span className={styles.step}>Static preview · Publish & activate</span></header>
        <div className={styles.grid}>
          <section className={styles.card}>
            <h1>Confirm Exchange presence</h1>
            <p>Activation requires the production runtime because readiness is evaluated from saved server-side onboarding progress. GitHub Pages does not fabricate an activation.</p>
            <div className={styles.notice}><strong>Preview only.</strong> Complete this workflow in the runtime application to activate an Exchange-ready state.</div>
            <Link className={styles.secondaryLink} href="/onboarding/completion">← Back to readiness review</Link>
          </section>
          <CompletionNavigation readiness={readiness} activePath="/onboarding/completion/activate" />
        </div>
      </div>
    </main>
  );
}
`,
);

await write(
  "app/onboarding/completion/success/page.tsx",
  `import Link from "next/link";
import { CompletionNavigation } from "@/components/onboarding/completion-navigation";
import styles from "@/components/onboarding/completion-transition.module.css";
import { buildExchangeReadiness } from "@/lib/onboarding/readiness";
import { createEmptyOnboardingProgress } from "@/lib/onboarding/progress";

export default function ExchangeReadySuccessPage() {
  const readiness = buildExchangeReadiness(createEmptyOnboardingProgress());
  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.topbar}><span className={styles.brand}>RFxchange</span><span className={styles.step}>Static preview · Step 10</span></header>
        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.successMark}>!</div>
            <h1>Activation has not been recorded</h1>
            <p>The static Pages preview cannot create server-side onboarding state. It deliberately does not display a false Exchange-ready success.</p>
            <Link className={styles.primaryLink} href="/onboarding/completion">Return to readiness review</Link>
          </section>
          <CompletionNavigation readiness={readiness} activePath="/onboarding/completion/success" />
        </div>
      </div>
    </main>
  );
}
`,
);

await write(
  "app/campaign/[slug]/page.tsx",
  `import { notFound } from "next/navigation";
import { CampaignLandingPage } from "@/components/public/campaign-landing-page";
import { buildCampaignRegistrationHref, campaigns, getCampaign } from "@/lib/public/campaigns";

export function generateStaticParams() {
  return campaigns.filter((campaign) => campaign.status === "live").map((campaign) => ({ slug: campaign.slug }));
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) notFound();
  return <CampaignLandingPage campaign={campaign} registrationHref={buildCampaignRegistrationHref(campaign, {})} />;
}
`,
);

await write(
  "app/onboarding/detail/[subject]/page.tsx",
  `import { notFound } from "next/navigation";
import { OnboardingDetailSurface } from "@/components/onboarding/OnboardingDetailSurface";
import { ONBOARDING_DETAIL_SUBJECTS, getOnboardingDetailDefinition } from "@/lib/onboarding/detail-surface";

export function generateStaticParams() {
  return ONBOARDING_DETAIL_SUBJECTS.map((subject) => ({ subject }));
}

export default async function OnboardingDetailPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const definition = getOnboardingDetailDefinition(subject);
  if (!definition) notFound();
  return <OnboardingDetailSurface definition={definition} />;
}
`,
);

await write(
  "app/exchange/[lens]/page.tsx",
  `import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { isExchangeLens, lensOrder } from "@/lib/exchange/lenses";

export function generateStaticParams() {
  return lensOrder.map((lens) => ({ lens }));
}

export default async function LensPage({ params }: { params: Promise<{ lens: string }> }) {
  const { lens } = await params;
  if (!isExchangeLens(lens)) notFound();
  return <ExchangeShell initialLens={lens} />;
}
`,
);

await write(
  "app/exchange/[lens]/[recordId]/page.tsx",
  `import { notFound } from "next/navigation";
import { ExchangeShell } from "@/components/exchange/exchange-shell";
import { capabilityExchangeRecords } from "@/lib/capabilities/reference";
import { intelligenceSeed } from "@/lib/exchange/intelligence";
import { exchangeSeed } from "@/lib/exchange/seed";
import { isExchangeLens, lensOrder } from "@/lib/exchange/lenses";
import { typeByLens } from "@/lib/exchange/filter";

const referenceRecords = [
  ...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"),
  ...intelligenceSeed,
  ...capabilityExchangeRecords,
];

export function generateStaticParams() {
  return lensOrder.flatMap((lens) =>
    referenceRecords
      .filter((record) => record.type === typeByLens[lens])
      .map((record) => ({ lens, recordId: record.id })),
  );
}

export default async function RecordPage({ params }: { params: Promise<{ lens: string; recordId: string }> }) {
  const { lens, recordId } = await params;
  if (!isExchangeLens(lens)) notFound();
  const record = referenceRecords.find((item) => item.id === recordId);
  if (!record || record.type !== typeByLens[lens]) notFound();
  return <ExchangeShell initialLens={lens} initialRecordId={recordId} />;
}
`,
);

// Next's basePath handles Link navigation. The Exchange shell also uses the
// browser History and Web Share APIs directly, so make those explicit paths
// base-path aware only in the Pages projection.
const exchangeShellPath = join(root, "components/exchange/exchange-shell.tsx");
let exchangeShell = await readFile(exchangeShellPath, "utf8");
exchangeShell = replaceRequired(
  exchangeShell,
  'import styles from "./exchange-shell.module.css";',
  'import { withBasePath, withoutBasePath } from "@/lib/exchange/base-path";\nimport styles from "./exchange-shell.module.css";',
  "Exchange shell style import",
);
exchangeShell = replaceRequired(
  exchangeShell,
  'const parts = location.pathname.split("/").filter(Boolean);',
  'const parts = withoutBasePath(location.pathname).split("/").filter(Boolean);',
  "Exchange URL parsing",
);
exchangeShell = replaceRequired(
  exchangeShell,
  'const path = recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`;',
  'const path = withBasePath(recordId ? `/exchange/${nextLens}/${recordId}` : `/exchange/${nextLens}`);',
  "Exchange history path",
);
exchangeShell = replaceRequired(
  exchangeShell,
  'const url = `${location.origin}/exchange/${lens}/${record.id}`;',
  'const url = `${location.origin}${withBasePath(`/exchange/${lens}/${record.id}`)}`;',
  "Exchange share URL",
);
await writeFile(exchangeShellPath, exchangeShell, "utf8");

console.log("Prepared RFxchange GitHub Pages preview projection.");