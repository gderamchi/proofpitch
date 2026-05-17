# ProofPitch

ProofPitch is now a single video-first workflow:

```text
product URL + product context -> proof-aware demo brief -> proof review -> HyperFrames MP4 -> Gradium voiceover or captions-only
```

The deck, pitch-pack, PDF, markdown export, social draft, billing, project list, and usage-counter surfaces have been removed from the active app. Claim review remains because accepted claims feed the demo captions and the voiceover script.

## Product Flow

1. Enter a public product URL, product name, target audience, demo goal, and optional demo instructions.
2. `POST /api/demo-videos` creates a `DemoVideoProject` with a `DemoBrief`, proof claims, screenshots, captions, and a pending HyperFrames video.
3. Review proof claims. `POST /api/demo-videos/:id/proof-review` marks accepted claims for narration.
4. Render the video. `POST /api/demo-videos/:id/render` captures the product path, prepares a HyperFrames composition, and returns a local or Supabase-hosted MP4.
5. If `GRADIUM_API_KEY` and `GRADIUM_VOICE_ID` are configured, Gradium generates a WAV voiceover. If either is missing, ProofPitch still renders the MP4 with visible captions and returns `voiceover.status = "captions_only"`.

## API

- `POST /api/demo-videos`
- `GET /api/demo-videos/:id`
- `POST /api/demo-videos/:id/proof-review`
- `POST /api/demo-videos/:id/render`
- `GET /api/demo-videos/:id/video`
- `GET /api/demo-videos/:id/recording`
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/signup`
- `GET /api/auth/session`

Legacy launch-pack, pitch-pack, project, usage, and billing API routes are intentionally removed.

## Environment

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5

TAVILY_API_KEY=
PIONEER_API_KEY=
PIONEER_MODEL_ID=fastino/gliner2-base-v1

GRADIUM_API_KEY=
GRADIUM_VOICE_ID=

PROOFPITCH_PLAYWRIGHT_CAPTURE=0
PROOFPITCH_VIDEO_ASSET_DIR=.proofpitch/demo-video-assets
PROOFPITCH_ENABLE_LOCAL_RENDER=0
NEXT_PUBLIC_SITE_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Local Commands

```bash
npm install
npm test
npm run lint
npm run build
npm run release:video:hyperframes:check
npm run video:render:local
```

Set `PROOFPITCH_ENABLE_LOCAL_RENDER=1` when the environment has Chrome and FFmpeg available for local video rendering.

## Supabase

The current schema keeps `organizations`, `organization_members`, auth helpers, and the `proofpitch-exports` bucket. The destructive cleanup migration creates `public.demo_video_projects` and drops legacy proof/deck storage tables and enums.

The `demo_video_projects` table stores:

- request metadata: URL, product, target audience, goal, instructions
- `output_json`: full `DemoVideoProject`
- `video_url` and `voiceover_url`
- screenshots
- organization/user ownership and timestamps

RLS policies restrict project reads and writes to organization members.

## Production Smoke

After deployment:

```bash
PROD_BASE_URL=https://proofpitch.vercel.app

curl -fsS "$PROD_BASE_URL/api/health"

curl -fsS -X POST "$PROD_BASE_URL/api/demo-videos" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://proofpitch.vercel.app",
    "productName": "ProofPitch",
    "targetAudience": "Founder-led B2B teams",
    "demoGoal": "Show the product URL to proof-aware demo video workflow.",
    "demoInstructions": "Open the page, review proof claims, then render the demo video."
  }'
```

The response is valid when it contains a `DemoVideoProject` with `demoBrief`, `proofReview`, `demoVideo.renderer = "hyperframes"`, `voiceover.provider = "gradium"`, and no deck/PDF/social draft fields.
