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

## Local Rendering

Local rendering is opt-in:

```bash
PROOFPITCH_ENABLE_LOCAL_RENDER=1
```

When enabled, the renderer can export the Slidev deck. Remotion rendering only runs when `demoVideo.status` is `ready` and render props exist.

Production PDF export is gated behind authenticated storage. Anonymous/local packs may be generated and outlined, but PDF storage should return a sign-in requirement unless local rendering is explicitly enabled.

## Demo Voiceover

Gradium can be used for the demo-video narration path once the render worker has `GRADIUM_API_KEY` and `GRADIUM_VOICE_ID`. The intended path is:

1. Build a concise narration script from `demoScript` and `demoVideo.renderProps.demoSteps`.
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
