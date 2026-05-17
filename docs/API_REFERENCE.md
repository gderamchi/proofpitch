# API Reference

ProofPitch exposes one public generation surface: demo video projects.

## `POST /api/demo-videos`

Creates a proof-aware demo video project.

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "Example",
  "targetAudience": "Founder-led B2B teams",
  "demoGoal": "Show the primary onboarding workflow.",
  "demoInstructions": "Open the site, show onboarding, then inspect the result."
}
```

Response: `DemoVideoProject` with `demoBrief`, `proofReview`, `captions`, `screenshots`, `demoVideo`, `voiceover`, and provider status.

## `GET /api/demo-videos/:id`

Returns a locally stored or Supabase-backed demo video project.

## `POST /api/demo-videos/:id/proof-review`

Approves proof claims that are allowed to feed captions and voiceover.

Request:

```json
{
  "acceptedClaimIds": ["claim-1"],
  "project": {}
}
```

`project` is optional and supports anonymous serverless flows where process-local storage is unavailable.

## `POST /api/demo-videos/:id/render`

Starts the HyperFrames MP4 render.

Request:

```json
{
  "captureSite": true,
  "dryRun": false,
  "renderVideo": true,
  "project": {}
}
```

Behavior:

- Rendering is enabled only when `PROOFPITCH_ENABLE_LOCAL_RENDER=1` or the Vercel runtime flag is present.
- Gradium TTS is attempted only when `GRADIUM_API_KEY` and `GRADIUM_VOICE_ID` exist.
- Missing Gradium configuration returns `voiceover.status = "captions_only"` and keeps the MP4 path valid.
- Rendered assets are uploaded to `proofpitch-exports` when Supabase admin storage is configured.

## `GET /api/demo-videos/:id/video`

Serves a locally rendered `demo-video.mp4`.

## `GET /api/demo-videos/:id/recording`

Serves the intermediate browser recording when capture produced one.

## `GET /api/health`

Returns provider, Supabase, storage, and schema readiness for the video workflow.

## Removed Routes

The old pack, project, usage, and billing routes are intentionally gone. Clients must use `/api/demo-videos`.
