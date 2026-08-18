import Link from "next/link";
import { ConversionLink } from "@/components/marketing/acquisition-context";
import { MarketingChrome } from "@/components/marketing/marketing-chrome";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import styles from "@/components/marketing/marketing.module.css";

const values = [
  ["Discover", "Demand", "Find RFx, needs, organizations, and market context without jumping between disconnected systems."],
  ["Describe", "Capability", "Build one organization identity around geography and structured capability data that can be reused throughout the Exchange."],
  ["Act", "In context", "Use governed actions, referrals, resources, and workflow entry points while preserving the Exchange state around the work."],
];

const audiences = [
  ["Businesses", "Make capability discoverable, find relevant demand, identify partners, and connect to useful resources.", "/businesses"],
  ["Buyers", "Discover capable organizations and place structured demand in the same environment where capability can be explored.", "/buyers"],
  ["Resource Providers", "Connect services, assets, and support to business needs without becoming a disconnected provider directory.", "/resource-providers"],
];

export default function MarketingPage() {
  return (
    <div className={styles.marketingShell}>
      <MarketingChrome />

      <main className={styles.publicMain}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>The business-to-business Exchange</p>
            <h1>Find the work. Find the capability. Find what makes the next move possible.</h1>
            <p>RFxchange brings demand, business capabilities, resources, and market intelligence into one connected operating environment built around the organizations doing the work.</p>
            <div className={styles.heroActions}>
              <ConversionLink className={styles.primaryButton} href="/join">Join Free</ConversionLink>
              <Link className={styles.secondaryButton} href="#how-it-works">See How It Works</Link>
            </div>
            <div className={styles.heroNote} aria-label="RFxchange participation principles">
              <span>Free organization entry</span>
              <span>Map-first discovery</span>
              <span>AMACS capability context</span>
              <span>Human decision authority</span>
            </div>
          </div>

          <div className={styles.exchangeVisual} aria-label="Illustration of the RFxchange map, actions, and record drawer">
            <div className={styles.visualSearch}>⌕ Search the Exchange by demand, organization, geography, or capability</div>
            <span className={`${styles.visualMarker} ${styles.markerOne}`}><span>RFx</span></span>
            <span className={`${styles.visualMarker} ${styles.markerTwo}`}><span>CAP</span></span>
            <span className={`${styles.visualMarker} ${styles.markerThree}`}><span>RES</span></span>
            <span className={`${styles.visualMarker} ${styles.markerFour}`}><span>INT</span></span>
            <div className={styles.visualDrawer}>
              <div className={styles.drawerHandle} />
              <div className={styles.visualActions}><span>Discover</span><span>Match</span><span>Watch</span><span>Share</span></div>
              <div className={styles.visualCards}>
                <div className={styles.visualCard}><strong>Opportunity + capability</strong><span>Records stay connected to organization and geography context.</span></div>
                <div className={styles.visualCard}><strong>Resources + intelligence</strong><span>Change lenses while the same Exchange remains mounted.</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>The value proposition</p>
            <h2>One environment for the relationships around business activity.</h2>
            <p>RFxchange is organized around three connected jobs: discover what is happening, describe what an organization can do, and act without losing the context that connected the two.</p>
          </header>
          <div className={styles.valueGrid}>
            {values.map(([verb, title, copy]) => (
              <article className={styles.valueCard} key={title}>
                <small>{verb}</small><h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.problemPanel}>
            <div><p className={styles.eyebrow}>The problem</p><h2>Business discovery is fragmented.</h2></div>
            <div className={styles.problemList}>
              <div><strong>Demand lives in one place.</strong><span>Opportunities, buyer needs, and procurement signals are often separated from the businesses that may be able to respond.</span></div>
              <div><strong>Capability lives somewhere else.</strong><span>Directories and industry labels rarely explain enough about what an organization can actually do.</span></div>
              <div><strong>Support is disconnected from both.</strong><span>Resources, providers, referrals, and market intelligence are usually encountered after the participant has already lost the original business context.</span></div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="how-it-works">
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>How it works</p>
            <h2>Establish once. Explore through lenses. Act from the same Exchange.</h2>
            <p>The public acquisition journey hands the participant to Identity and Onboarding. Once Exchange-ready, the authenticated chassis remains stable while the lens changes.</p>
          </header>
          <div className={styles.stepsGrid}>
            {[
              ["1", "Create the organization", "Register, establish the organization you represent, and set geography."],
              ["2", "Enrich capability", "Describe the organization's capability in structured, AMACS-aligned terms."],
              ["3", "Explore the Exchange", "Use RFx, Resources, Intelligence, and Capabilities over the same map-first shell."],
              ["4", "Take the next action", "Respond, watch, share, refer, manage, or connect as governed workflows become available."],
            ].map(([number, title, copy]) => (
              <article className={styles.stepCard} key={number}>
                <span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.amacsPanel}>
            <header className={styles.sectionHeader}>
              <p className={styles.eyebrow}>AMACS</p>
              <h2>A common capability language gives discovery more meaning.</h2>
              <p>RFxchange uses the Accel Market Activity and Capability Standard as the capability-enrichment layer so organizations can be understood by what they can do, not merely by a broad category or self-written keyword list.</p>
            </header>
            <div className={styles.amacsFlow} aria-label="AMACS capability flow">
              <div className={styles.flowNode}>Organization profile</div><div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode}>Capability enrichment</div><div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode}>AMACS projection + evidence-ready context</div><div className={styles.flowArrow}>↓</div>
              <div className={styles.flowNode}>RFxchange discovery and matching context</div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.networkPanel}>
            <div className={styles.networkVisual} aria-label="AI and network value illustration">
              <div className={styles.networkNode}>Organizations</div><div className={styles.networkNode}>Demand</div>
              <div className={styles.networkNode}>Capabilities</div><div className={styles.networkNode}>Resources</div>
            </div>
            <header className={styles.sectionHeader}>
              <p className={styles.eyebrow}>AI + Network</p>
              <h2>Assistance is more useful when the network has structure.</h2>
              <p>AI can help interpret, organize, compare, and surface relationships across structured Exchange context. It does not replace the people and organizations responsible for business, procurement, qualification, or award decisions.</p>
            </header>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Differentiation</p>
            <h2>The Exchange is not just another directory, social feed, or bid portal.</h2>
          </header>
          <div className={styles.differenceGrid}>
            <article className={styles.differenceCard}>
              <h3>RFxchange is designed to connect</h3>
              <ul><li>Organization identity to geography and capability</li><li>Demand to the businesses that may be relevant</li><li>Resources and referrals to the context that created the need</li><li>Intelligence to the same places and organizations participants already explore</li></ul>
            </article>
            <article className={styles.differenceCard}>
              <h3>RFxchange does not promise</h3>
              <ul><li>Guaranteed leads, awards, revenue, or ROI</li><li>Qualification merely because a record appears</li><li>Automated replacement of buyer or business judgment</li><li>Paid status as a substitute for capability truth or verification</li></ul>
              <p><Link className={styles.textLink} href="/image-credits">Image Credits →</Link></p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Availability + Trust</p>
            <h2>Grow the network without hiding the rules.</h2>
            <p>RFxchange is designed for progressive geographic availability and progressive workflow availability. Trust rules stay distinct from commercial status.</p>
          </header>
          <div className={styles.trustGrid}>
            <article className={styles.trustCard}><small>Availability</small><h3>Geography has context</h3><p>Participants establish the geography around their organization and Exchange activity so discovery can expand deliberately as network density grows.</p></article>
            <article className={styles.trustCard}><small>Trust</small><h3>Capability is not a paid badge</h3><p>Membership should not silently determine whether an organization is treated as relevant, capable, or credible.</p></article>
            <article className={styles.trustCard}><small>Progressive delivery</small><h3>Unavailable actions stay governed</h3><p>The chassis can show where a workflow belongs while keeping it disabled until the underlying service is actually operational.</p></article>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Audience</p>
            <h2>Different participants. Shared Exchange context.</h2>
          </header>
          <div className={styles.audienceGrid}>
            {audiences.map(([title, copy, href]) => (
              <article className={styles.audienceCard} key={title}>
                <small>RFxchange for</small><h3>{title}</h3><p>{copy}</p>
                <p><Link className={styles.textLink} href={href}>Explore {title} →</Link></p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.foundingPanel}>
            <div>
              <p className={styles.eyebrow}>Founding Membership</p>
              <h2>Founding Organization status for the first 250.</h2>
              <p>Founding Membership is an optional organization-level enhancement. Free participation remains the entry point; Founding status does not buy ranking, verification, or capability truth.</p>
              <div className={styles.heroActions}>
                <Link className={styles.secondaryButton} href="/founding">Founding details</Link>
                <ConversionLink className={styles.primaryButton} href="/join">Join Free</ConversionLink>
              </div>
            </div>
            <div className={styles.foundingPrice}><strong>$49</strong><span>per organization / month</span></div>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <p className={styles.eyebrow}>Enter RFxchange</p>
            <h2>Start with the organization you represent.</h2>
            <p>The public shell gets you to the right doorway. Registration and organization onboarding establish the context the authenticated Exchange needs.</p>
          </div>
          <div className={styles.finalCtaActions}>
            <ConversionLink className={styles.primaryButton} href="/join">Join Free</ConversionLink>
            <ConversionLink className={styles.secondaryButton} href="/signin">Sign In</ConversionLink>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
