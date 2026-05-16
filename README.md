# ProofPitch

ProofPitch turns a public product URL and release context into a reviewable release pack.

The product is built around one clear outcome: help a team with a real product ship serious release assets without reducing the workflow to copy-paste text or inventing unsupported claims.

```txt
public product URL + release context
        -> source screenshot capture
        -> research and claim extraction
        -> structured pitch generation
        -> Slidev pitch deck
        -> Remotion demo video props
        -> OpenAI voiceover script/audio
        -> YouTube, LinkedIn, and X drafts
        -> optional Product Hunt handoff
        -> review-gated publishing handoff
```

## Product Docs

- [PRD](./docs/PRD.md)
- [Technical requirements](./docs/TECHNICAL_REQUIREMENTS.md)
- [Market analysis](./docs/MARKET_ANALYSIS.md)
- [Business plan](./docs/BUSINESS_PLAN.md)
- [Launch roadmap](./docs/LAUNCH_ROADMAP.md)

## Current User Flow

1. User enters a public product URL.
2. User adds product name, target audience, release goal, optional demo path instructions, and optional release channels.
3. User clicks `Generate Release Pack`.
4. ProofPitch returns a Slidev deck, Remotion demo video metadata, voiceover script/audio status, YouTube metadata, LinkedIn/X drafts, screenshots, and the proof-backed pitch pack.
5. User reviews each asset before rendering, exporting, publishing, or manually submitting Product Hunt.

## Output

- One-liner and executive pitch.
- Two-minute script.
- Live demo steps.
- Slidev pitch deck markdown, slide count, and export metadata.
- Remotion demo video composition id, render props, duration, and render status.
- OpenAI voiceover script/audio status with script-only mode when TTS is unavailable.
- Release demo script, captions, and source screenshots.
- Optional Product Hunt fields: name, tagline, topics, pricing, gallery, YouTube URL, interactive demo URL, description, maker comment, FAQ, and checklist.
- LinkedIn and X drafts with media attachments.
- YouTube upload metadata.
- Claim ledger with `supported`, `weak`, `unsupported`, and `user_provided` statuses.
- Media prompt and optional generated media.
- README or website snippet.
- Provider usage report.
- Risks and next steps.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Zod
- Supabase Auth, Postgres, RLS, and Storage
- OpenAI Responses API
- OpenAI Audio Speech API for voiceover
- Slidev / `@slidev/cli`
- Remotion / `@remotion/player`, `@remotion/renderer`, and `@remotion/bundler`
- Tavily API
- fal API
- Pioneer/Fastino extraction adapter
- Gradium voice adapter

## Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Variables:

```txt
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
TAVILY_API_KEY=
FAL_KEY=
GRADIUM_API_KEY=
PIONEER_API_KEY=
PIONEER_MODEL_ID=fastino/gliner2-base-v1
PROOFPITCH_PLAYWRIGHT_CAPTURE=0
PROOFPITCH_RELEASE_ASSET_DIR=.proofpitch/release-assets
PROOFPITCH_ENABLE_LOCAL_RENDER=0
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=verse
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
BILLING_MODE=manual
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_FOUNDER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_AGENCY_PRICE_ID=
STRIPE_SINGLE_PRICE_ID=
PROOFPITCH_LOCAL_DEMO_PACK_LIMIT=1000
PROOFPITCH_FREE_PACK_LIMIT=1
PROOFPITCH_FOUNDER_PACK_LIMIT=10
PROOFPITCH_PRO_PACK_LIMIT=40
PROOFPITCH_AGENCY_PACK_LIMIT=150
PROOFPITCH_ENTERPRISE_PACK_LIMIT=1000
```

Current behavior:

- With no keys: the app returns a deterministic release pack and pitch pack, marks providers as `missing`, and keeps voiceover as `script_only`.
- With `PROOFPITCH_PLAYWRIGHT_CAPTURE=1` and a worker environment that has Playwright installed, the capture adapter attempts real browser screenshots; otherwise it returns reviewable source references.
- With `PROOFPITCH_ENABLE_LOCAL_RENDER=1`: `/api/launch-packs/:id/render` and `npm run release:render:local` can run Slidev/Remotion rendering locally.
- With `OPENAI_API_KEY`: `/api/generate-pitch-pack` uses structured generation.
- With `OPENAI_API_KEY`: release pack generation can create OpenAI TTS voiceover audio outside test mode.
- With `TAVILY_API_KEY`: live research sources are added before generation.
- With `FAL_KEY`: media generation is added to the output.
- With `PIONEER_API_KEY`: claim/entity extraction runs before generation.
- With `GRADIUM_API_KEY`: `/api/gradium-transcribe` uses Gradium STT POST.
- With Supabase env vars: pitch packs, release packs, channel drafts, social connection records, source documents, usage counters, provider runs, exports, and organizations persist in Supabase.
- Without Supabase env vars: the local in-memory store is capped by `PROOFPITCH_LOCAL_DEMO_PACK_LIMIT`.
- With Stripe test env vars: paid CTAs create Checkout Sessions and webhooks update plan entitlements or one-shot credits.
- Product Hunt is an optional release channel and bookmarklet autofill flow; ProofPitch never auto-submits Product Hunt.
- YouTube, LinkedIn, and X publish routes require explicit review confirmation and connected OAuth accounts.

## API Routes

### `POST /api/launch-packs`

Creates a reviewable Release Pack from a public product URL.

```json
{
  "sourceUrl": "https://example.com",
  "productName": "Example",
  "targetAudience": "Founder-led B2B teams",
  "launchGoal": "Release with a pitch deck, demo video, voiceover, LinkedIn post, and X thread",
  "demoInstructions": "Show the proof ledger and export path.",
  "releaseChannels": ["youtube", "linkedin", "x"]
}
```

### `GET /api/launch-packs/:id`

Returns the Release Pack, Slidev deck, Remotion video metadata, voiceover, channel drafts, screenshots, and embedded pitch pack.

### `POST /api/launch-packs/:id/render`

Dry-runs or executes the local Slidev/Remotion worker. Rendering is disabled unless `PROOFPITCH_ENABLE_LOCAL_RENDER=1`.

### `POST /api/launch-packs/:id/publish/:channel`

Review-gated publishing endpoint for `product_hunt`, `youtube`, `linkedin`, or `x`.

```json
{
  "reviewConfirmed": true
}
```

Product Hunt returns a manual handoff. YouTube, LinkedIn, and X require connected OAuth accounts before they can publish.

### `GET /api/launch-packs/:id/product-hunt/bookmarklet`

Returns a short-lived Product Hunt autofill payload for the optional bookmarklet. It intentionally never submits the form.

### `GET /api/oauth/:provider/start`, `/api/oauth/:provider/callback`

OAuth entrypoints for `youtube`, `linkedin`, and `x`. The callback currently receives authorization codes and is ready for token exchange plus encrypted `social_connections` storage.

### `POST /api/generate-pitch-pack`

Compatibility orchestrator. It now uses the same quota and persistence path as `/api/pitch-packs`.

```json
{
  "rawInput": "We built...",
  "projectUrl": "https://example.com"
}
```

### `GET /api/usage`

Returns current plan, quota, remaining Release Packs, and pricing metadata.

### `GET /api/pitch-packs`

Lists saved pitch packs for the current organization, or local packs when Supabase is not configured.

### `POST /api/pitch-packs`

Creates a quota-checked, persisted pitch pack.

### `GET /api/pitch-packs/:id`

Returns one saved pack with source documents, provider run metadata, exports, approval note, and the full pitch pack.

### `PATCH /api/pitch-packs/:id`

Updates `projectName` and/or a short `approvalNote` for the saved pack.

### `POST /api/pitch-packs/:id/export`

Creates a Markdown export. PDF intentionally returns `501` until the PDF renderer is added.

### `GET /api/projects`

Lists private-alpha project summaries with pitch-pack counts and latest pack timestamps.

### `POST /api/projects`

Creates a project shell with `name` and optional `defaultUrl`.

### `POST /api/auth/signup`, `/api/auth/login`, `/api/auth/logout`

Supabase email/password auth endpoints. First login creates a personal organization automatically.

### `POST /api/billing/checkout`

Creates a Stripe test-mode Checkout Session for `founder`, `pro`, `agency`, or `single`. Requires an authenticated Supabase session.

### `POST /api/billing/webhook`

Handles Stripe `checkout.session.completed` and updates the authenticated organization plan or single Release Pack credits.

### `POST /api/tavily`

Runs research for a note and optional URL.

### `POST /api/fal`

Generates media from a prompt when `FAL_KEY` is configured.

### `POST /api/pioneer-extract`

Runs structured extraction when Pioneer credentials are configured.

### `POST /api/gradium-transcribe`

Accepts `multipart/form-data` with an `audio` file.

### `GET /api/health`

Reports provider key configuration plus Supabase database and export-bucket readiness when Supabase env vars are present.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful release-render commands:

```bash
npm run release:deck:export
npm run release:video:studio
npm run release:video:render
PROOFPITCH_ENABLE_LOCAL_RENDER=1 npm run release:render:local
```

## Verification

```bash
npm run lint
npm test
npm run build
curl -s http://localhost:3000/api/health | jq .
curl -s http://localhost:3000/api/usage | jq .
curl -s -X POST http://localhost:3000/api/pitch-packs \
  -H 'Content-Type: application/json' \
  -d '{"rawInput":"ProofPitch turns rough product notes into verified pitch packs.","projectUrl":"https://example.com"}' | jq .
```
