# ProofPitch

Public repository: [github.com/gderamchi/proofpitch](https://github.com/gderamchi/proofpitch)

ProofPitch is a source-backed pitch-pack generator for one focused workflow:

```text
product URL + short context + deck mode -> claim review -> visual Slidev preview + Remotion demo video render -> PDF/render state
```

The app deliberately keeps the pitch deck and product demo separate. A launch-pack request returns a claim review first; accepted claims are compiled into a deterministic Slidev outline only after approval. The demo video path captures the submitted product URL with Playwright screenshots and renders a Remotion MP4 when local rendering is enabled. If capture is disabled or blocked, the API returns an explicit pending or blocked demo-video state instead of pretending that a slide render is a product demo.

## Repository Status

- Source code is public on GitHub at `gderamchi/proofpitch`.
- The runtime is a Next.js 16 App Router application with TypeScript route handlers under `app/api`.
- The MVP runs in free-access mode: login, signup, checkout, plan quotas, and one-shot credits are not required for the core launch-pack workflow.
- Supabase, Stripe, Tavily, Pioneer, and local rendering are optional integrations. Missing provider keys produce documented fallback or disabled states instead of blank UI.
- This docs pass does not add a license file. Redistribution terms should be confirmed separately before packaging this as a licensed open-source project.

## MVP Scope

- Compact landing page with product URL, product name, audience, goal, optional demo instructions, deck mode, claim review, outline approval, and visual slide preview.
- `DeckMode` values: `investor`, `sales`, and `launch`.
- `LaunchPack` output with `pitchDeck`, `demoVideo`, `pitchPack`, screenshots, captions, and checklist.
- `pitchDeck` starts pending, then stores a validated `DeckOutline`, deterministic Slidev markdown, render state, and PDF export metadata after approval/render.
- Approved decks render as navigable 16:9 slide previews with thumbnail selection, product screenshot cues when available, Slidev Markdown download, and PDF download when the render artifact is ready.
- `PitchPack` output with reusable pitch copy, demo steps, claim ledger, risks, next steps, and provider usage.
- Providers in the public contract: OpenAI, Tavily, and Pioneer.

Out of MVP scope: generated hero media, audio workflows, channel drafts, publishing metadata, and commercial UI. Gradium voiceover variables are present for planned work only and should stay disabled unless that extension is implemented.

## Quick Start

Prerequisites:

- Node.js 20.9 or newer, matching the Next.js 16 requirement.
- npm, using the committed `package-lock.json`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app can run locally without provider keys. In that mode it uses deterministic fallback data and marks provider states as missing or fallback. Add provider keys when you want live structured generation and proof sourcing.

## Production Usage And Test Guide

Production URL: [https://proofpitch.vercel.app](https://proofpitch.vercel.app)

Use the production site when you want to validate the deployed Vercel app, production environment variables, public API routes, and the end-to-end launch-pack workflow.

### Browser Test

1. Open [https://proofpitch.vercel.app](https://proofpitch.vercel.app).
2. Enter a public product URL, product name, target audience, launch goal, optional demo instructions, and a deck mode (`investor`, `sales`, or `launch`).
3. Generate the launch pack.
4. Confirm the response shows a claim ledger before the deck is approved.
5. Approve only supported, weak-but-acceptable, or user-provided claims that should be included in the deck.
6. Confirm the visual 16:9 slide preview appears after approval, with slide navigation and a Slidev markdown download.
7. Trigger rendering when the render action is available.
8. Confirm the deck state and demo-video state are reported separately.

Expected production behavior:

- The page must be usable without login, signup, checkout, paid plan selection, or one-shot credits.
- Missing optional providers must be shown as missing, fallback, pending, blocked, or disabled states instead of blank UI.
- The pitch deck and product demo video must stay separate. A Slidev deck render is not a product demo video.
- A successful pack includes `claimReview`, `pitchDeck`, `demoVideo`, `pitchPack`, and provider status for OpenAI, Tavily, and Pioneer.

### API Smoke Test

Set the production base URL once:

```bash
PROD_BASE_URL=https://proofpitch.vercel.app
```

Check service health:

```bash
curl -fsS "$PROD_BASE_URL/api/health"
```

The health response should include:

- `"ok": true`
- `"service": "proofpitch"`
- provider configuration flags for OpenAI, Tavily, and Pioneer
- Supabase and billing health, with billing normally in `manual` mode

Create a launch pack:

```bash
curl -fsS -X POST "$PROD_BASE_URL/api/launch-packs" \
  -H 'content-type: application/json' \
  -d '{
    "sourceUrl": "https://example.com",
    "productName": "ProofPitch",
    "targetAudience": "Founder-led B2B teams",
    "launchGoal": "Prepare a customer-call demo and concise deck.",
    "demoInstructions": "Scroll to the main call to action.",
    "deckMode": "sales"
  }'
```

The response is valid for production testing when:

- `id` is present.
- `claimReview.status` is `pending`.
- `pitchDeck.status` is `pending` and `pitchDeck.format` is `slidev`.
- `pitchPack.claims` is an array.
- `demoVideo.status` is `pending`, `ready`, `failed`, or another explicit non-blank state.
- `providers.openai`, `providers.tavily`, and `providers.pioneer` each include a state and detail.

Approve a deck outline after copying one acceptable claim id from the response:

```bash
curl -fsS -X POST "$PROD_BASE_URL/api/launch-packs/<id>/outline" \
  -H 'content-type: application/json' \
  -d '{ "acceptedClaimIds": ["claim-1"] }'
```

The outline response is valid when `claimReview.status` is `approved`, `pitchDeck.status` is `ready`, `pitchDeck.markdown` contains Slidev markdown, and `pitchDeck.outline.slides` contains structured slide specs.

Render checks are environment-dependent:

- `POST /api/launch-packs/<id>/render` should never require sign-in.
- If production rendering is enabled, it should report ready or running artifact state.
- If rendering is disabled or blocked, it should return an explicit disabled, queued, blocked, failed, or pending state with a reason.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Required for live generation | Enables OpenAI Responses API structured `PitchPack` synthesis. |
| `OPENAI_MODEL` | Required for live generation | Model used by `lib/openai.ts`; defaults are documented in `.env.example`. |
| `TAVILY_API_KEY` | Optional | Enables Tavily web research and source snippets for proof-backed claims. |
| `PIONEER_API_KEY` | Optional | Enables Pioneer entity extraction and claim-risk classification. |
| `PIONEER_MODEL_ID` | Optional | Pioneer model id, defaulting to `fastino/gliner2-base-v1` in `.env.example`. |
| `GRADIUM_API_KEY` | Planned | Reserved for future demo-video narration work; not required for the MVP flow. |
| `FAL_KEY` | Planned | Reserved for future generated-media work; not required for the MVP flow. |
| `PROOFPITCH_PLAYWRIGHT_CAPTURE` | Optional | Enables product-site capture through Playwright when set to `1`. |
| `PROOFPITCH_ENABLE_LOCAL_RENDER` | Optional | Enables local Slidev/Remotion rendering when set to `1`. |
| `PROOFPITCH_RELEASE_ASSET_DIR` | Optional | Directory for generated local artifacts, defaulting to `.proofpitch/release-assets`. |
| `PROOFPITCH_CHROMIUM_PACK_URL` | Optional | Overrides the Vercel Chromium pack URL used by production Remotion video rendering. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Public site origin for generated links. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL for persistence/auth. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase browser/client key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase admin key for server persistence and private export storage. |
| `STRIPE_SECRET_KEY` | Parked | Stripe support exists for future billing, but checkout is disabled in MVP free-access mode. |
| `STRIPE_WEBHOOK_SECRET` | Parked | Used only by the Stripe webhook route when billing is re-enabled. |
| `STRIPE_*_PRICE_ID` | Parked | Future plan price IDs, documented in `docs/BUSINESS_PLAN.md`. |
| `BILLING_MODE` | Optional | Currently expected to stay `manual`. |

Never commit real `.env.local` files. The repository intentionally tracks only `.env.example`.

## Main Scripts

```bash
npm run dev
npm test
npm run lint
npm run build
npm run release:render:local
npm run release:deck:export
npm run release:video:studio
npm run release:video:render
```

- `dev`: starts the Next.js development server.
- `test`: runs Vitest coverage for backend services, schemas, persistence fallback, and render contracts.
- `lint`: runs ESLint.
- `build`: runs the Next.js production build and type generation.
- `release:render:local`: renders configured local release artifacts through `scripts/render-release-artifacts.mjs`.
- `release:deck:export`: exports a generated Slidev deck PDF from `.proofpitch/release-assets/latest/pitch-deck.md`.
- `release:video:studio` and `release:video:render`: inspect or render the Remotion `ProofPitchProductDemo` composition.

## Architecture At A Glance

ProofPitch is organized as a small App Router application:

- `app/page.tsx` renders the landing/generator surface.
- `components/proofpitch-landing.tsx` owns the client-side launch-pack workflow.
- `app/api/**/route.ts` contains the JSON and artifact API routes.
- `lib/schemas.ts` defines the Zod request and response contracts.
- `lib/launch-pack-service.ts` builds launch packs, claim review, deck outlines, launch drafts, and local persistence updates.
- `lib/social-drafts.ts` builds ready-to-copy X, LinkedIn, and Product Hunt drafts from the latest video/deck assets.
- `lib/deck-spec.ts` compiles approved claims into deterministic Slidev markdown.
- `lib/pitch-pack-service.ts` handles provider-backed and fallback pitch-pack generation.
- `lib/openai.ts`, `lib/tavily.ts`, and `lib/pioneer.ts` isolate external provider adapters.
- `lib/release-renderer.ts`, `lib/release-assets.ts`, `lib/demo-video-capture.ts`, and `remotion/` handle artifact rendering.
- `lib/local-store.ts` keeps the MVP usable when Supabase is not configured.
- `supabase/migrations/` contains the optional persistence schema and RLS policies.

More detail:

- [Architecture and toolchain](docs/ARCHITECTURE.md)
- [API reference](docs/API_REFERENCE.md)
- [Jury evaluation guide](docs/EVALUATION_GUIDE.md)
- [Technical requirements](docs/TECHNICAL_REQUIREMENTS.md)
- [Product requirements](docs/PRD.md)
- [Business plan](docs/BUSINESS_PLAN.md)
- [Market analysis](docs/MARKET_ANALYSIS.md)
- [Launch roadmap](docs/LAUNCH_ROADMAP.md)

## API Summary

The primary route is:

```http
POST /api/launch-packs
```

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "ProofPitch",
  "targetAudience": "Founder-led B2B teams",
  "launchGoal": "Prepare a customer-call demo and concise deck.",
  "demoInstructions": "Accept cookies if needed, search pricing, then scroll to the CTA.",
  "deckMode": "sales"
}
```

Representative response:

```json
{
  "id": "launch-id",
  "status": "running",
  "deckMode": "sales",
  "claimReview": {
    "status": "pending",
    "acceptedClaimIds": ["claim-1"],
    "rejectedClaimIds": ["claim-2"]
  },
  "pitchDeck": {
    "status": "pending",
    "format": "slidev",
    "renderState": "queued"
  },
  "demoVideo": {
    "status": "pending",
    "uploadStatus": "blocked_by_provider_review"
  },
  "pitchPack": {
    "projectName": "ProofPitch",
    "claims": []
  },
  "providers": {
    "openai": { "state": "used", "detail": "Structured generation completed." },
    "tavily": { "state": "used", "detail": "Research completed." },
    "pioneer": { "state": "used", "detail": "Extraction completed." }
  }
}
```

Claim approval and render routes:

- `POST /api/launch-packs/:id/outline` approves selected claims and creates the deterministic deck outline plus Slidev markdown.
- `POST /api/launch-packs/:id/render` starts deck or demo-video rendering. It does not require sign-in. When local rendering is disabled, it reports `render.enabled: false`.
- `GET /api/launch-packs/:id/video` serves a rendered local MP4.
- `GET /api/launch-packs/:id/recording` serves the intermediate browser recording when available.

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for every route, including pitch packs, provider helpers, auth, usage, projects, health, and parked billing endpoints.

## Provider Strategy

ProofPitch uses three providers because the MVP needs separate jobs for research, extraction, and synthesis:

- OpenAI is the structured synthesis layer. It receives user context plus optional Tavily and Pioneer context, then must return a strict `PitchPack` JSON shape. It is not treated as an independent evidence source.
- Tavily is the research layer. It provides source titles, URLs, snippets, scores, and usage credits so claims can cite external context instead of fabricated proof.
- Pioneer is the extraction layer. It pulls project, product, technology, metric, user, problem, and claim entities plus `claim_risk`. The adapter supports nested responses at `raw.result.data.entities` and `raw.result.data.claim_risk`.

Every generation returns provider status for OpenAI, Tavily, and Pioneer. Missing or failed providers are represented explicitly and sanitized before returning or persisting errors.

Runtime modes:

- `live`: OpenAI ran and at least one proof provider also ran.
- `partial`: OpenAI ran, but Tavily and Pioneer did not run.
- `demo`: OpenAI did not produce the pack, so the deterministic fallback was used.

## Verification

Run these before considering a change ready:

```bash
git diff --check
npm test
npm run lint
npm run build
```

For frontend changes, also run:

```bash
npm run dev
```

Then inspect `/` at desktop and mobile widths. The first screen should stay focused on the generator and should not show commercial, audio, generated-media, or publishing copy.

## Deployment

The repository is linked to a Vercel project through `.vercel/project.json`. Production deployment is expected at the end of completed tasks in this repo:

```bash
vercel --prod
```

After deployment, verify the public app and `/api/health`. Missing Vercel credentials, project access, or environment variables should be reported as deployment blockers rather than hidden behind local-only success.
