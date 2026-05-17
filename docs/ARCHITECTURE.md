# Architecture

ProofPitch is a Next.js 16 app with a video-first backend.

## Flow

1. The client submits product context to `POST /api/demo-videos`.
2. `lib/demo-brief.ts` builds a conservative `DemoBrief` from OpenAI plus optional Tavily and Pioneer evidence.
3. `lib/demo-capture.ts` creates fallback screenshots or Playwright captures.
4. `lib/demo-video-service.ts` creates a `DemoVideoProject` with captions, voiceover script, and a pending HyperFrames render spec.
5. `POST /api/demo-videos/:id/render` calls `lib/demo-video-renderer.ts`.
6. The renderer prepares screenshots, requests Gradium WAV audio when configured, renders HyperFrames MP4, and optionally muxes audio through FFmpeg.
7. Supabase storage receives `demo-video.mp4` and `voiceover.wav` when admin credentials are present.

## Core Types

- `DemoVideoProject`: canonical persisted object.
- `DemoBrief`: product summary, demo narrative, demo steps, claims, risks, and provider usage.
- Internal claim filter metadata: accepted and rejected claim ids used only to keep unsupported claims out of generated narration.
- `DemoVideo`: HyperFrames render state and render spec.
- `Voiceover`: Gradium script, state, audio URL, and fallback reason.

## Persistence

Anonymous/local use falls back to the process-local store in `lib/local-store.ts`.

Supabase-backed use stores projects in `public.demo_video_projects` with:

- `organization_id`
- request metadata
- `output_json`
- `video_url`
- `voiceover_url`
- `screenshots`
- timestamps and ownership

RLS policies rely on `organization_members`.

## Providers

- OpenAI: structured `DemoBrief` and HyperFrames composition generation.
- Tavily: optional research context for product and workflow claims.
- Pioneer: optional extraction/classification context.
- Gradium: optional REST TTS provider for WAV voiceover.
- HyperFrames: canonical MP4 renderer.

When Gradium is absent, captions remain visible and the video render is still valid.
