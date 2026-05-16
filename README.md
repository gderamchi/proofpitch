# ProofPitch

ProofPitch is an MVP for one workflow:

```text
product URL + short context -> product demo video state + separate pitch deck + claim ledger
```

The app deliberately keeps the deck and product demo separate. The API can return `demoVideo.status: "pending"` first, then the UI can render a real Remotion MP4 by capturing the submitted site URL with Playwright screenshots.

## MVP Scope

- Compact landing page with product URL, product name, audience, goal, optional demo instructions, and one generate CTA.
- `LaunchPack` output with `pitchDeck`, `demoVideo`, `pitchPack`, screenshots, captions, and checklist.
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

The homepage also exposes a "Render demo video" action after a launch pack is generated. It captures the entered URL, passes the frames into the Remotion composition, and serves the MP4 from `/api/launch-packs/:id/video`.

The render action uses a lightweight demo-path agent. It can:

- handle common consent banners such as "Accept all", "Tout accepter", or "Reject all";
- follow simple user path instructions such as "search pricing", "click Contact", "open the first result", or "scroll down";
- capture a frame after each step so the Remotion video shows an actual walkthrough instead of a static first page.
The Remotion walkthrough is rendered as a longer 24-second video and can be opened full-size from the generated output card.

## Main API

### `POST /api/launch-packs`

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "ProofPitch",
  "targetAudience": "Founder-led B2B teams",
  "launchGoal": "Prepare a customer-call demo and concise deck.",
  "demoInstructions": "Accept cookies if needed, search pricing, then scroll to the CTA."
}
```

Response shape:

```json
{
  "id": "launch-id",
  "status": "completed",
  "pitchDeck": { "status": "ready", "format": "slidev" },
  "demoVideo": { "status": "pending", "uploadStatus": "blocked_by_provider_review" },
  "pitchPack": { "projectName": "ProofPitch", "claims": [] },
  "providers": {
    "openai": { "state": "used" },
    "tavily": { "state": "used" },
    "pioneer": { "state": "used" }
  }
}
```

`demoVideo.status` becomes `ready` when product walkthrough capture or the Remotion render action produced a real video path. Otherwise it is explicitly pending or blocked.

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
