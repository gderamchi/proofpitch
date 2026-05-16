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

After approval, the client renders the structured outline as visual 16:9 slide previews with thumbnail selection and previous/next navigation. The generated Slidev markdown remains available as a secondary technical artifact through copy/download actions; users should not need to read raw markdown to understand the deck.

## Providers

### OpenAI

OpenAI is used for structured `PitchPack` generation. Prompts must ask for conservative, evidence-aware copy and must not describe removed MVP outputs.

### Tavily

Tavily is the research/source provider for proof-backed claims. When unavailable, the app still returns a deterministic local pack and marks Tavily as missing or failed.

### Pioneer

Pioneer is the entity and claim-risk extractor. The adapter must parse both legacy array responses and nested responses at:

```text
raw.result.data.entities
raw.result.data.claim_risk
```

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
