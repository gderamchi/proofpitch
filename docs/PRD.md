# Product Requirements

ProofPitch turns a product URL into a generated demo video with optional voiceover.

## Primary User Story

As a founder or GTM operator, I enter the product URL, the demo goal, and optionally a path to follow. ProofPitch renders an MP4 demo video with Gradium voiceover when configured or captions-only fallback when not configured.

## In Scope

- Product URL, product name, target audience, demo goal, and demo instructions.
- Internal demo planning and claim filtering.
- HyperFrames MP4 render path.
- Gradium WAV TTS.
- Captions-only fallback when Gradium env is missing.
- Supabase persistence in `demo_video_projects`.

## Out of Scope

- Presentation generation.
- PDF export.
- Markdown export.
- Social copy drafts.
- Usage quota screens.
- Checkout or billing routes.

## Acceptance Criteria

- The first screen is the demo-video workflow, not a marketing page.
- The UI centers the final video preview, with provider state, screenshots, captions, and narration script tucked behind expandable controls.
- The Open MP4 action uses `/api/demo-videos/:id/video`, not a short-lived signed storage URL.
- Missing Gradium credentials do not fail rendering.
- Removed product surfaces are not reachable from active routes.
