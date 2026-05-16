# Business Plan

## 1. Thesis

ProofPitch can become a focused AI workflow for source-backed product storytelling. The product should start as a founder and GTM tool, not a broad slide platform.

The business only works if customers value the proof layer. If users only want prettier generated slides, the market is already crowded and distribution will be expensive.

## 2. Product Wedge

Initial wedge:

> Verified pitch packs for founders and small GTM teams.

The first paid product should solve one repeatable problem:

- "I have rough context and need credible pitch material today."

ProofPitch should produce:

- story
- script
- claim ledger
- source trail
- reusable copy
- media prompt or visual

## 3. Customer Segments

### Segment A: Founder-Led B2B Teams

Pain:

- Need to explain complex products repeatedly.
- Lack dedicated product marketing.
- Need investor, sales, and website language.

Buyer:

- Founder, CEO, chief of staff, early marketing hire.

Willingness to pay:

- $29 to $99 per month.
- Higher if outputs replace agency/consultant time.

### Segment B: Agencies and Consultants

Pain:

- Need to turn messy client context into positioning drafts.
- Need evidence and source notes for client approval.

Buyer:

- Founder of agency, positioning consultant, freelance strategist.

Willingness to pay:

- $99 to $399 per month.
- Higher for client workspaces and branded exports.

### Segment C: Accelerators and Venture Studios

Pain:

- Need repeatable pitch material across many companies.
- Need coaching workflows and reviewable outputs.

Buyer:

- Program lead, venture studio operator, portfolio support lead.

Willingness to pay:

- $750 to $2,500 per cohort or monthly workspace, depending on company count.

### Segment D: Sales Enablement Teams

Pain:

- Need consistent, proof-backed sales narratives.
- Need source-backed claims for reps.

Buyer:

- Product marketing, revenue enablement, sales operations.

Willingness to pay:

- $10k to $50k per year later, but this segment requires security, workflow, and integration maturity.

## 4. Pricing

Recommended launch pricing:

- Free: 0€, 1 Release Pack/month, one seat, basic export.
- Founder: 39€/month, 10 Release Packs/month, one seat, saved history and Markdown export.
- Pro: 99€/month, 40 Release Packs/month, three seats, version history and provider-run logs.
- Agency: 299€/month, 150 Release Packs/month, five seats, client workspaces and white-label export path.
- Enterprise: custom, custom seats, custom quota, security review, and bespoke controls.
- Single Release Pack: 49€ one-shot manual credit.

Pricing should be output-limited around Release Packs rather than token-limited. The buyer understands a completed release workflow; they do not naturally value API calls or model tokens.

Billing starts in `manual` mode. Plans, quotas, usage counters, and one-shot credits exist in the backend before automated checkout is added.

## 5. Unit Economics

Target:

- Gross margin above 80%.
- Median generation cost below $1.00 per pack.
- Media generation should be quota-limited or premium.
- Voice transcription should be quota-limited until retention proves it matters.

Cost drivers:

- Model generation.
- Web research.
- Media generation.
- Audio transcription.
- Storage and export jobs.

Cost controls:

- Cap research results.
- Cache URL extraction.
- Generate media only after user confirms or for paid tiers.
- Use deterministic fallback when non-critical providers fail.
- Track provider cost per run.

## 6. Go-To-Market

Phase 1: founder-focused private beta.

- Target 30 to 50 founder-led B2B teams.
- Offer hands-on onboarding.
- Measure whether they export and reuse generated material.
- Collect before/after pitch examples.

Phase 2: agency and operator channel.

- Sell to consultants who can use ProofPitch repeatedly.
- Create templates for positioning, website copy, sales script, and investor intro.
- Run partner demos with agencies and venture studios.

Phase 3: self-serve launch.

- Publish examples with claim ledgers.
- Add SEO pages around "pitch deck claim checker", "startup positioning generator", "sales narrative generator".
- Add public share pages for generated packs.

Phase 4: team and enterprise expansion.

- Add approvals, audit logs, access control, and integrations.
- Sell to product marketing and enablement teams.

## 7. Distribution Channels

Most promising:

- Founder communities.
- Product marketing communities.
- Agency and consultant networks.
- Accelerator and venture studio partnerships.
- SEO around pitch, positioning, proof, and claim verification.

Less promising early:

- Paid ads for generic AI presentation keywords.
- Broad creator marketplaces.
- Enterprise outbound before security posture is ready.

## 8. Retention Loops

ProofPitch needs repeat use beyond one initial pitch. Retention should come from:

- Version history.
- Monthly investor update generation.
- New launch narrative generation.
- Sales objection and proof refresh.
- New source ingestion when the product changes.
- Team-approved claim library.

If users only generate one pack and leave, the product should pivot toward agency/cohort pricing or export monetization.

## 9. Financial Model

Six-month target:

- 50 paid founder accounts at 39€.
- 15 Pro accounts at 99€.
- 5 agency accounts at 299€.
- 20 one-shot Release Packs at 49€.
- Approximate monthly revenue: 5k€ to 6k€.

Twelve-month target:

- 400 founder accounts at 39€.
- 150 Pro accounts at 99€.
- 40 agency accounts at 299€.
- 10 enterprise or cohort accounts at 1,500€+.
- Approximate monthly revenue: 55k€ to 60k€.

The base model depends more on agency and team expansion than on low-priced founder accounts alone.

## 10. Key Risks

- Users may not pay for verification unless it is visually and operationally central.
- General AI tools may be "good enough" for first drafts.
- Pitch and positioning may be too episodic for monthly subscriptions.
- Claim verification quality must be conservative or trust will break.
- The product can become bloated if it chases deck editing too early.

## 11. Risk Mitigation

- Keep claim ledger visible before final copy.
- Price around repeat workflows, not one-off generation.
- Add saved projects and refresh workflows early.
- Build agency/cohort plans to increase repeat usage.
- Avoid full slide editing until core retention is proven.
- Use source-backed language like "supported by" instead of "verified fact" when evidence is directional.

## 12. First 90 Days

Days 1 to 30:

- Finish live provider path.
- Add saved projects.
- Add copy/export.
- Recruit 20 private beta users.

Days 31 to 60:

- Add billing.
- Add user accounts.
- Add source ingestion improvements.
- Run 50 real pitch-pack generations with feedback.

Days 61 to 90:

- Launch paid beta.
- Add agency workspace.
- Publish 5 public examples.
- Close first cohort or agency deal.

## Sources

- Market and adoption sources are listed in [Market Analysis](./MARKET_ANALYSIS.md).
