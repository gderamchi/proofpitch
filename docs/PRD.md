# Product Requirements

ProofPitch turns a product URL into a proof-aware demo video with optional voiceover.

## Primary User Story

As a founder or GTM operator, I enter the product URL and the demo goal. ProofPitch returns a reviewed brief, lets me accept the proof claims that may be narrated, then renders an MP4 demo video with Gradium voiceover when configured or captions-only fallback when not configured.

## In Scope

- Product URL, product name, target audience, demo goal, and demo instructions.
- Proof-aware `DemoBrief`.
- Claim review that controls captions and voiceover script.
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
- The UI exposes proof review, render video, provider state, screenshots, captions, and final video preview.
- Accepted claims appear in the narration script and captions.
- Missing Gradium credentials do not fail rendering.
- Removed product surfaces are not reachable from active routes.
