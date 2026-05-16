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
- Approved decks render as navigable 16:9 slide previews with thumbnail selection, product screenshot cues when available, Slidev Markdown download, and PDF download when the render artifact is ready.
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

## Provider Strategy

ProofPitch uses three providers because the MVP needs three separate jobs:
research, extraction, and structured synthesis. The app keeps those jobs
separate so the final pitch pack can say what came from user input, what was
supported by external sources, and which provider actually ran.

### OpenAI

OpenAI is the structured generation layer. The server calls the OpenAI Responses
API from `lib/openai.ts` with the configured `OPENAI_MODEL` and a strict
`PitchPack` JSON schema. The model receives:

- the founder note or raw product context;
- the optional project URL;
- Tavily's answer and source snippets when Tavily is configured;
- Pioneer's extracted entities and claim-risk signal when Pioneer is configured.

We use OpenAI for synthesis, not as the source of truth. Its job is to turn the
available inputs into concise founder, sales, or investor material: pitch copy,
two-minute demo script, claim ledger, risks, next steps, and provider-usage
notes. The prompt explicitly tells it not to invent metrics and to mark claims
as `user_provided`, `weak`, `supported`, or `unsupported`.

If `OPENAI_API_KEY` is missing or the call fails, the API returns a provider
status explaining the miss and falls back to a deterministic local pack. That
keeps demos and tests usable, but the response mode becomes `demo` instead of a
live provider-backed pack.

### Tavily

Tavily is the research layer. `lib/tavily.ts` builds a short search query from
the raw input and optional product URL, then calls Tavily Search for market
validation, competitor context, and proof points. The app requests a basic
answer, up to four source results, and usage credits.

We use Tavily because ProofPitch should not ask the language model to invent
evidence. Tavily gives the generation step source titles, URLs, snippets, and
scores that can be carried into the source-document list and claim review. When
`TAVILY_API_KEY` is missing or the search fails, the app still runs; the provider
status is marked `missing` or `failed`, and OpenAI receives an explicit
`Tavily sources: unavailable` context line.

### Pioneer

Pioneer is the extraction layer. `lib/pioneer.ts` sends the raw input to
Pioneer's inference API with the configured `PIONEER_MODEL_ID` and asks for
entities such as project, product, technology, metric, user, problem, and claim,
plus a `claim_risk` classification.

We use Pioneer before OpenAI to pull structured signals out of messy founder
notes. That gives the generation step a compact extraction summary and helps the
claim ledger distinguish real product facts, measurable claims, weak claims, and
unsupported claims. The adapter supports both legacy array responses and the
nested Pioneer response shape at `raw.result.data.entities` and
`raw.result.data.claim_risk`.

Pioneer is optional in the MVP. If `PIONEER_API_KEY` is missing or the extraction
fails, ProofPitch records the provider state and sends
`No Pioneer extraction available.` to OpenAI instead of blocking the whole pack.

### Runtime modes and provider logs

Every generation returns provider status under `providers.openai`,
`providers.tavily`, and `providers.pioneer`:

- `live`: OpenAI ran and at least one proof provider, Tavily or Pioneer, also
  ran.
- `partial`: OpenAI ran, but neither proof provider ran.
- `demo`: OpenAI did not produce the pack, so the deterministic fallback was
  used.

When Supabase persistence is configured, provider runs and source documents are
stored with the pack. Provider error details are sanitized before being returned
or persisted so API keys are not leaked in failure messages.

Optional product capture and local rendering:

```bash
PROOFPITCH_PLAYWRIGHT_CAPTURE=1
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

Planned voiceover integration uses Gradium TTS for demo narration. It should stay disabled unless both values are configured:

```bash
GRADIUM_API_KEY=
GRADIUM_VOICE_ID=
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
