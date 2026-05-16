# ProofPitch Technical Requirements

## MVP Contract

ProofPitch has one supported product path:

```text
POST /api/launch-packs
product URL + brief context -> LaunchPack
```

The returned `LaunchPack` contains:

- `pitchDeck`: Slidev markdown and export metadata.
- `demoVideo`: real product capture metadata when available, otherwise an explicit pending/blocked state.
- `pitchPack`: generated story, claim ledger, risks, next steps, and provider usage.
- `providers`: OpenAI, Tavily, and Pioneer status details.
- screenshots, captions, checklist, and request metadata.

It does not contain audio scripts, generated media prompts, channel drafts, or external publishing payloads.

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
