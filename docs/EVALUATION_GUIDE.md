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
- proof review appears after generation
- accepted claims update narration content
- render action is available
- output panel shows video, voiceover state, provider state, screenshots, captions, and accepted proof
- no removed product surfaces are visible

## API Smoke

```bash
curl -fsS -X POST http://localhost:3000/api/demo-videos \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://proofpitch.vercel.app",
    "productName": "ProofPitch",
    "targetAudience": "Founder-led B2B teams",
    "demoGoal": "Show the product URL to proof-aware demo video workflow.",
    "demoInstructions": "Open the page, review proof, then render the demo video."
  }'
```

Then approve at least one returned claim through `/api/demo-videos/:id/proof-review` and render through `/api/demo-videos/:id/render`.

## Production Smoke

Run the same flow against `https://proofpitch.vercel.app` after deployment. `/api/health` must report demo-video schema/storage readiness or a concrete blocker.
