# API Reference

ProofPitch exposes one public generation surface: demo video projects.

## `POST /api/demo-videos`

Creates a demo video project and prepares the render spec.

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

Response: `DemoVideoProject` with captions, screenshots, render state, voiceover state, provider status, and internal generation metadata.

## `GET /api/demo-videos/:id`

Returns a locally stored or Supabase-backed demo video project.

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
- Successful renders expose the stable playback URL `/api/demo-videos/:id/video`; clients should not depend on short-lived Supabase signed URLs.
- Rendered assets are uploaded to `proofpitch-exports` when Supabase admin storage is configured. If the MP4 exists but an upload fails, the response remains successful with `uploadWarnings` and the local API video URL is used as a fallback.
- The export bucket accepts `video/mp4` and `audio/wav`; the render service self-heals missing MIME allow-list entries before retrying an upload.

## `GET /api/demo-videos/:id/video`

Serves a locally rendered `demo-video.mp4`, then falls back to the private Supabase export object when local serverless storage does not have the file.

## `GET /api/demo-videos/:id/recording`

Serves the intermediate browser recording when capture produced one.

## `GET /api/health`

Returns provider, Supabase, storage, and schema readiness for the video workflow.

## Removed Routes

The old pack, project, usage, and billing routes are intentionally gone. Clients must use `/api/demo-videos`.
