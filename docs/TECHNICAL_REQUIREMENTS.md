# ProofPitch Technical Requirements

## MVP Contract

ProofPitch has one supported product path:

```text
POST /api/launch-packs
product URL + brief context + deck mode -> claim-gated LaunchPack
```

The returned `LaunchPack` contains:

- `deckMode`: `investor`, `sales`, or `launch`.
- `claimReview`: pending or approved claim IDs for deck inclusion.
- `pitchDeck`: pending deck state, approved `DeckOutline`, deterministic Slidev markdown, render state, and PDF export metadata.
- `demoVideo`: real product capture metadata when available, otherwise an explicit pending/blocked state.
- `pitchPack`: generated story, claim ledger, risks, next steps, and provider usage.
- `providers`: OpenAI, Tavily, and Pioneer status details.
- screenshots, captions, checklist, and request metadata.

It does not contain audio scripts, generated media prompts, channel drafts, or external publishing payloads.

## Slidev Deck Generation

The model must not emit arbitrary Slidev, Vue, or executable markdown. The server builds a validated `DeckOutline` from:

- `PitchPack`
- accepted non-unsupported claim IDs
- `DeckMode`
- launch-pack input

The server then compiles that outline into Slidev markdown using the fixed ProofPitch template. Initial launch-pack generation returns `pitchDeck.status: "pending"` until claims are approved through `/api/launch-packs/:id/outline`.

After approval, the client renders the structured outline as visual 16:9 slide previews with thumbnail selection, previous/next navigation, and product screenshot cues when capture references exist. The generated Slidev markdown remains available as a secondary technical artifact through copy/download actions; users should not need to read raw markdown to understand the deck.

## Providers

### OpenAI

OpenAI is used for structured `PitchPack` generation through the Responses API. The server sends the raw builder note, optional project URL, Tavily research, and Pioneer extraction summary, then requires the response to match the `PitchPack` JSON schema. Prompts must ask for conservative, evidence-aware copy, must not invent metrics, and must not describe removed MVP outputs.

OpenAI is the synthesis layer only. It should explain claim strength from the provided context and source snippets; it should not be treated as an independent evidence source. If OpenAI is missing or fails, the API must mark the provider state and use the deterministic local fallback pack.

### Tavily

Tavily is the research/source provider for proof-backed claims. It receives a truncated search query derived from the raw input and optional project URL, then returns a basic answer, source snippets, URLs, scores, and usage credits. Tavily output becomes source documents and context for OpenAI.

When Tavily is unavailable, the app still runs and marks Tavily as missing or failed. OpenAI must receive an explicit unavailable-source note rather than a fabricated research summary.

### Pioneer

Pioneer is the entity and claim-risk extractor. It receives the raw input and extracts project, product, technology, metric, user, problem, and claim entities plus a `claim_risk` classification. Its output gives OpenAI a compact signal about what the user actually claimed before the pitch copy is synthesized.

The adapter must parse both legacy array responses and nested responses at:

```text
raw.result.data.entities
raw.result.data.claim_risk
```

When Pioneer is unavailable, the app must record the provider state and continue with an explicit empty extraction summary.

## Product Demo Video

`demoVideo.status` may be:

- `ready`: product walkthrough capture produced a real video path.
- `pending` or `failed`: capture is unavailable or failed.

The system must never return a Slidev deck render as a product demo video. The deck remains a separate `pitchDeck` artifact.
When the launch pack is pending, the UI can trigger the HyperFrames render action. That action runs the demo-path agent, captures the submitted site URL with Playwright screenshots, asks GPT-5.5 for a deterministic HyperFrames composition, and writes a real MP4.

The demo-path agent must:

- try common consent buttons before capturing the walkthrough;
- preserve the user's `demoInstructions` as HyperFrames `demoPath`;
- support simple click, search, first-result, and scroll instructions;
- keep a step log in `demoSteps` so the video captions describe what the agent did.
HyperFrames demo videos should be long enough to inspect the site, with the browser capture as the dominant visual surface and an option in the UI to open the MP4 full-size.

## Free Access And Rendering

ProofPitch currently runs in free-access mode. The product flow must not require login, signup, checkout, paid plans, one-shot credits, or quota headroom. Pricing and packaging belong to `docs/BUSINESS_PLAN.md` until monetization is intentionally re-enabled.

## Local Rendering

Local rendering is opt-in:

```bash
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

When enabled, the renderer can export the Slidev deck and render a HyperFrames MP4 from `demoVideo.renderSpec`. The Vercel server runtime is also treated as an enabled render worker for the production route.
Production HyperFrames renders require Node 22, Chrome, and FFmpeg in the render worker. If those are unavailable, the render route must return an explicit failed or pending state rather than a fake video URL.
The interactive UI render action may request a local video render for the selected launch pack. The render route should prefer a server-side launch-pack lookup and may accept a full `launchPack` fallback when local serverless storage cannot find the id. Request bodies must not be able to force-enable local rendering; that remains controlled only by server environment.

When local rendering is disabled, `/api/launch-packs/:id/render` must return `200`, keep `pitchDeck.renderState: "queued"`, and report `render.enabled: false`. It must not return a sign-in requirement.

## Launch Drafts

`LaunchPack.socialDrafts` contains ready-to-copy drafts for X, LinkedIn, and Product Hunt.

- Draft generation is deterministic and must exclude unsupported claims.
- Each draft references the rendered MP4 as a required asset, but V1 does not attach or publish the video through external platform APIs.
- X opens a Web Intent with text and URL only; MP4 attachment remains manual.
- LinkedIn opens the composer/feed and copies text first; MP4/PDF attachment remains manual.
- Product Hunt fields are prepared, but the rendered MP4 must be published to YouTube before it can be used in Product Hunt's video slot.

## Demo Voiceover

Gradium can be used for the demo-video narration path once the render worker has `GRADIUM_API_KEY` and `GRADIUM_VOICE_ID`. The intended path is:

1. Build a concise narration script from `demoScript` and `demoVideo.renderSpec.demoSteps`.
2. Call Gradium's REST TTS endpoint with `x-api-key`, `voice_id`, `output_format: "wav"`, and `only_audio: true`.
3. Store the generated WAV alongside local render assets.
4. Overlay that audio on the product-demo video render.

This voiceover must attach to the real product-demo video path. It must not turn the Slidev deck into the demo video.

## Environment

Required for live generation:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

Optional providers:

```bash
TAVILY_API_KEY=
PIONEER_API_KEY=
PIONEER_MODEL_ID=fastino/gliner2-base-v1
```

Optional capture:

```bash
PROOFPITCH_PLAYWRIGHT_CAPTURE=1
```

## Validation

Required checks before declaring the MVP path complete:

```bash
npm test
npm run build
```

Frontend changes also require desktop and mobile visual checks of `/`. The landing must remain focused on the generator and avoid horizontal overflow.
