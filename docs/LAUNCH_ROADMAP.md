# Release Roadmap

## Phase 0: Current Prototype

Goal:

- Prove the end-to-end generation surface.

Done:

- Landing page.
- Text input.
- Optional URL field.
- Structured output schema.
- Provider adapters.
- Local deterministic result.
- Claim ledger UI.
- Deck mode selector.
- Claim-gated Slidev outline generation.
- Deterministic Slidev markdown compiler.
- PDF render state API.
- Supabase migration with RLS.
- Auth API routes.
- Saved-pack API with local in-memory mode.
- Free-access mode with quotas disabled.
- Markdown export API.
- Stripe entitlement code retained for future monetization, with checkout disabled in the current product.

Remaining:

- Live provider validation.
- Remote Supabase project linkage.
- Production PDF storage/render worker hardening.
- Decision on when to re-enable checkout.

## Phase 1: Private Alpha

Goal:

- Validate that users value the claim ledger and reuse the generated output.

Scope:

- Account UI on top of the auth API.
- Copy buttons.
- Basic feedback controls.

Success criteria:

- 20 active users.
- 50 generated release packs.
- 30% of packs produce copy/export action.
- 10 users agree the claim ledger changes what they would share.

## Phase 2: Paid Beta

Goal:

- Validate willingness to pay.

Scope:

- Billing.
- Usage limits.
- Project history.
- Better URL extraction.
- Media generation for paid tiers.
- Simple public share page.

Success criteria:

- 50 paid accounts.
- 5 agency/team accounts.
- Median generation cost under $1.00.
- Provider-miss rate below 10%.

## Phase 3: Public Release

Goal:

- Make acquisition repeatable.

Scope:

- SEO pages.
- Public examples.
- Referral loop.
- Export templates.
- Brand voice settings.
- Support and onboarding flow.

Success criteria:

- 500 weekly website visitors from owned channels.
- 8% free-to-paid conversion among activated users.
- 30% monthly active usage among paid accounts.

## Phase 4: Team Expansion

Goal:

- Move from founder workflow to repeat GTM workflow.

Scope:

- Team workspaces.
- Claim library.
- Approval status.
- Audit logs.
- Role-based access.
- CRM/export integrations.

Success criteria:

- 20 team/agency accounts.
- Average revenue per account above $200/month.
- Retention driven by refresh workflows, not one-off generation.
