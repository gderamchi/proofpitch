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

Out of MVP scope: generated hero media, channel drafts, publishing metadata, and commercial UI.

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

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Required for live generation | Enables OpenAI Responses API structured `PitchPack` synthesis. |
| `OPENAI_MODEL` | Required for live generation | Model used by `lib/openai.ts`; defaults are documented in `.env.example`. |
| `TAVILY_API_KEY` | Optional | Enables Tavily web research and source snippets for proof-backed claims. |
| `PIONEER_API_KEY` | Optional | Enables Pioneer entity extraction and claim-risk classification. |
| `PIONEER_MODEL_ID` | Optional | Pioneer model id, defaulting to `fastino/gliner2-base-v1` in `.env.example`. |
| `GRADIUM_API_KEY` | Optional | Enables Gradium voiceover narration for locally rendered Remotion demo videos. |
| `GRADIUM_VOICE_ID` | Optional | Gradium voice id; defaults to an English voice when omitted. |
| `FAL_KEY` | Planned | Reserved for future generated-media work; not required for the MVP flow. |
| `PROOFPITCH_PLAYWRIGHT_CAPTURE` | Optional | Enables product-site capture through Playwright when set to `1`. |
| `PROOFPITCH_ENABLE_LOCAL_RENDER` | Optional | Enables local Slidev/Remotion rendering when set to `1`. |
| `PROOFPITCH_RELEASE_ASSET_DIR` | Optional | Directory for generated local artifacts, defaulting to `.proofpitch/release-assets`. |
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
- `lib/launch-pack-service.ts` builds launch packs, claim review, deck outlines, and local persistence updates.
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

Optional product capture and local rendering:

```bash
PROOFPITCH_PLAYWRIGHT_CAPTURE=1
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

Optional Gradium narration for rendered demos:

```bash
GRADIUM_API_KEY=
GRADIUM_VOICE_ID=YTpq7expH9539ERJ
```

`GRADIUM_VOICE_ID` defaults to an English voice when omitted. The render pipeline reads Gradium keys from the process environment or local env files, generates short sales-oriented voiceover segments per demo step, serves them from `/api/launch-packs/:id/voiceover/:segment`, and syncs them in Remotion.

The homepage also exposes a "Render demo video" action after a launch pack is generated. It captures the entered URL as a real browser recording, adds subtle synced subtitles and optional Gradium voiceover, then serves the MP4 from `/api/launch-packs/:id/video`.

The render action uses a lightweight demo-path agent. It can:

- handle common consent banners such as "Accept all", "Tout accepter", or "Reject all";
- follow simple user path instructions such as "search pricing", "click Contact", "open the first result", or "scroll down";
- observe visible headings, page copy, and navigation labels so the Gradium narration can stay natural between actions;
- improvise into useful internal pages such as sectors, industries, use cases, pricing, customers, solutions, or contact when the requested path runs out;
- record the browser session in 16:9 so the Remotion video shows an actual walkthrough instead of a static first page.
The Remotion walkthrough is rendered as a two-minute video with a subtle subtitle track and can be opened full-size from the generated output card.

## Main API

### `POST /api/launch-packs`

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "ProofPitch",
  "companyDescription": "ProofPitch helps founder-led teams turn a product URL into a credible sales walkthrough, pitch deck, and claim ledger.",
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
