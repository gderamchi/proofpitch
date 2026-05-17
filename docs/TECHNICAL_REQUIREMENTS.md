# Technical Requirements

## Request Contract

`CreateDemoVideoRequestSchema` is strict and accepts only:

- `sourceUrl`
- `productName`
- `targetAudience`
- `demoGoal`
- `demoInstructions`

## Proof Review

Only accepted non-unsupported claims may feed the final captions and voiceover script. Unsupported claims remain visible for review but cannot be accepted.

## Rendering

The only renderer is HyperFrames MP4. The server must not expose alternate presentation, PDF, or markdown render paths.

The render route must:

- accept project fallback bodies for anonymous serverless flows
- respect server-controlled render enablement only
- support dry runs
- capture product screenshots when Playwright capture is enabled
- return explicit disabled or failed states

## Gradium TTS

Use:

```text
POST https://api.gradium.ai/api/post/speech/tts
x-api-key: <GRADIUM_API_KEY>
```

Body:

```json
{
  "text": "...",
  "voice_id": "...",
  "output_format": "wav",
  "only_audio": true
}
```

If `GRADIUM_API_KEY` or `GRADIUM_VOICE_ID` is missing, return `captions_only` instead of failing the video render.

## Database

The destructive cleanup migration creates `public.demo_video_projects`, enables RLS, and drops removed storage tables and status enums. `organizations`, `organization_members`, auth helpers, and `proofpitch-exports` remain.
