# Evaluation Guide

## Local Checks

```bash
npm test
npm run lint
npm run build
npm run release:video:hyperframes:check
```

For local rendering:

```bash
PROOFPITCH_ENABLE_LOCAL_RENDER=1 npm run video:render:local
```

## Browser QA

Open `/` on desktop and mobile widths.

Verify:

- product URL form is the first screen
- render action is available
- output panel centers the playable video
- provider state, screenshots, captions, and narration script are behind expandable controls
- Open MP4 uses `/api/demo-videos/:id/video` and returns `video/mp4`
- no removed product surfaces are visible

## API Smoke

```bash
curl -fsS -X POST http://localhost:3000/api/demo-videos \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://proofpitch.vercel.app",
    "productName": "ProofPitch",
    "targetAudience": "Founder-led B2B teams",
    "demoGoal": "Show the product URL to generated demo video workflow.",
    "demoInstructions": "Open the page, show the input form, render the demo video, then show the playable MP4."
  }'
```

Then render through `/api/demo-videos/:id/render` and verify `/api/demo-videos/:id/video` returns `video/mp4`.

## Production Smoke

Run the same flow against `https://proofpitch.vercel.app` after deployment. `/api/health` must report demo-video schema/storage readiness or a concrete blocker.
