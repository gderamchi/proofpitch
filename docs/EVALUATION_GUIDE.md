# ProofPitch Evaluation Guide

This guide is written for hackathon juries and technical reviewers who need to inspect the repository quickly and verify that the MVP works.

## What To Review First

1. Start with `README.md` for the public repository, setup steps, environment variables, and documentation map.
2. Read `docs/PRD.md` for product intent and MVP boundaries.
3. Read `docs/TECHNICAL_REQUIREMENTS.md` for detailed behavior requirements.
4. Read `docs/API_REFERENCE.md` for route-level contracts.
5. Read `docs/ARCHITECTURE.md` for framework, provider, persistence, and rendering decisions.

## Local Review Path

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app is usable without provider keys. Missing providers are expected to show fallback or missing states. To test live generation, configure at least:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

Optional proof providers:

```bash
TAVILY_API_KEY=
PIONEER_API_KEY=
PIONEER_MODEL_ID=fastino/gliner2-base-v1
```

Optional local capture/render:

```bash
PROOFPITCH_PLAYWRIGHT_CAPTURE=1
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

## Expected MVP Flow

1. Enter a public product URL.
2. Add product name, target audience, launch goal, optional demo instructions, and deck mode.
3. Generate the launch pack.
4. Review the claim ledger.
5. Approve supported or user-provided claims.
6. Inspect the visual 16:9 slide preview.
7. Download or copy the generated Slidev markdown.
8. Trigger render if local rendering is enabled.
9. Inspect the MP4 demo-video state or rendered artifact.

The critical evaluation point is separation of concerns: the deck is a Slidev pitch artifact, while the demo video is a Remotion product-walkthrough artifact.

## API Smoke Test

With `npm run dev` running:

```bash
curl -s http://localhost:3000/api/health
```

Create a launch pack:

```bash
curl -s -X POST http://localhost:3000/api/launch-packs \
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

Expected response shape:

- `id` is present.
- `claimReview.status` is `pending`.
- `pitchDeck.format` is `slidev`.
- `pitchPack.claims` is an array.
- `demoVideo.status` is `pending`, `ready`, or `failed`.
- `providers.openai`, `providers.tavily`, and `providers.pioneer` each include a state and detail.

Approve a claim after copying a supported claim id from the response:

```bash
curl -s -X POST http://localhost:3000/api/launch-packs/<id>/outline \
  -H 'content-type: application/json' \
  -d '{ "acceptedClaimIds": ["claim-1"] }'
```

Expected response shape:

- `claimReview.status` is `approved`.
- `pitchDeck.status` is `ready`.
- `pitchDeck.markdown` contains Slidev markdown.
- `pitchDeck.outline.slides` contains structured slide specs.

## Verification Commands

Run this set before scoring technical completeness:

```bash
git diff --check
npm test
npm run lint
npm run build
```

The production build route list should include these API routes:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/session`
- `/api/auth/signup`
- `/api/billing/checkout`
- `/api/billing/webhook`
- `/api/generate-pitch-pack`
- `/api/health`
- `/api/launch-packs`
- `/api/launch-packs/[id]`
- `/api/launch-packs/[id]/outline`
- `/api/launch-packs/[id]/recording`
- `/api/launch-packs/[id]/render`
- `/api/launch-packs/[id]/social-drafts`
- `/api/launch-packs/[id]/video`
- `/api/pioneer-extract`
- `/api/pitch-packs`
- `/api/pitch-packs/[id]`
- `/api/pitch-packs/[id]/export`
- `/api/projects`
- `/api/tavily`
- `/api/usage`

## What Is Intentionally Out Of Scope

- Runtime paywall or checkout.
- Required login for the MVP generation path.
- Generated hero images.
- Audio generation or voiceover.
- External publishing workflows.
- A full deck editor.
- Treating a deck render as a product demo video.

## Technical Completeness Checklist

- Public GitHub repository is visible.
- README explains setup, install, environment variables, scripts, and docs map.
- API reference covers all current route handlers.
- Architecture doc names frameworks, providers, storage, rendering, and validation tools.
- Tests and build pass locally.
- Production deployment is verified separately after merge/push.
