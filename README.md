# ProofPitch

ProofPitch is an MVP for one workflow:

```text
product URL + short context + deck mode -> claim review -> visual Slidev preview -> PDF render state
```

The app deliberately keeps the deck and product demo separate. A launch-pack request returns a claim review first; accepted claims are compiled into a deterministic Slidev outline only after approval. When Playwright capture is disabled or cannot record the product URL, the API returns `demoVideo.status: "pending"` with an explicit blocker instead of pretending a slide video is a product demo.

## MVP Scope

- Compact landing page with product URL, product name, audience, goal, optional demo instructions, deck mode, claim review, outline approval, and a visual slide preview.
- `LaunchPack` output with `pitchDeck`, `demoVideo`, `pitchPack`, screenshots, captions, and checklist.
- `DeckMode` values: `investor`, `sales`, and `launch`.
- `pitchDeck` starts pending, then stores a validated `DeckOutline`, deterministic Slidev markdown, render state, and PDF export metadata after approval/render.
- Approved decks render as navigable 16:9 slide previews with thumbnail selection, Slidev Markdown download, and PDF download when the render artifact is ready.
- `PitchPack` output with reusable pitch copy, demo steps, claim ledger, risks, next steps, and provider usage.
- Providers in the public contract: OpenAI, Tavily, and Pioneer.
- Tavily supplies research sources for proof-backed claims.
- Pioneer extracts entities and claim risk from nested `raw.result.data.entities` and `claim_risk`.

Out of MVP scope: generated hero media, audio workflows, channel drafts, publishing metadata, and commercial UI.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required for live structured generation:

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

Optional product capture and local rendering:

```bash
PROOFPITCH_PLAYWRIGHT_CAPTURE=1
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

## Main API

### `POST /api/launch-packs`

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "ProofPitch",
  "targetAudience": "Founder-led B2B teams",
  "launchGoal": "Prepare a customer-call demo and concise deck.",
  "demoInstructions": "Show the core workflow and proof moment.",
  "deckMode": "sales"
}
```

Response shape:

```json
{
  "id": "launch-id",
  "status": "running",
  "deckMode": "sales",
  "claimReview": { "status": "pending", "acceptedClaimIds": ["claim-1"], "rejectedClaimIds": ["claim-2"] },
  "pitchDeck": { "status": "pending", "format": "slidev", "renderState": "queued" },
  "demoVideo": { "status": "pending", "uploadStatus": "blocked_by_provider_review" },
  "pitchPack": { "projectName": "ProofPitch", "claims": [] },
  "providers": {
    "openai": { "state": "used" },
    "tavily": { "state": "used" },
    "pioneer": { "state": "used" }
  }
}
```

`demoVideo.status` is `ready` only when product walkthrough capture produced a real video path. Otherwise it is explicitly pending or blocked.

### `POST /api/launch-packs/:id/outline`

Approves claims and generates the structured deck outline plus deterministic Slidev markdown.

Request:

```json
{
  "acceptedClaimIds": ["claim-1"]
}
```

### `POST /api/launch-packs/:id/render`

Starts the PDF render path for an approved outline. Production export is gated behind authenticated storage. Local dev rendering requires:

```bash
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

### `POST /api/generate-pitch-pack`

Generates the underlying `PitchPack` from raw context and optional project URL.

### `POST /api/tavily`

Runs Tavily research when `TAVILY_API_KEY` is configured.

### `POST /api/pioneer-extract`

Runs Pioneer entity and claim-risk extraction when `PIONEER_API_KEY` is configured.

### `GET /api/health`

Reports OpenAI, Tavily, Pioneer, Supabase, and billing health. Billing and Supabase remain infrastructure concerns; they are not part of the landing-page MVP flow.

## Verification

```bash
npm test
npm run build
```

For visual checks:

```bash
npm run dev
```

Open `/` at desktop and mobile widths. The first screen should stay focused on the generator and should not show commercial, audio, generated-media, or publishing copy.
