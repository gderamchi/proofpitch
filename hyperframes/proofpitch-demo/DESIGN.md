# ProofPitch HyperFrames Visual Identity

## Style Prompt

Use ProofPitch's product UI language around a real browser recording: pale green workspace canvas, dense founder-tool panels, square bordered chrome, clear status labels, and restrained teal emphasis. The video should feel like a captured product walkthrough of the production app, not a generic SaaS promo or a recreated mock UI. Motion should be minimal and precise, because the real frontend recording is the source of truth.

## Colors

- Canvas: `#edf4f1`
- Ink: `#1c1917`
- Deep ink: `#111827`
- Panel: `#fffdf7`
- Soft panel: `#f8fbf8`
- Teal accent: `#0f766e`
- Teal dark: `#115e59`
- Amber review: `#fff6df`
- Error/reject: `#fef2f2`

## Typography

- Primary: system sans stack matching the app's Geist fallback, `Inter`, `ui-sans-serif`, `system-ui`, `Arial`, `Helvetica`, `sans-serif`.
- Display: same sans stack, semibold to bold, tight but readable.

## Motion Rules

- Keep the real browser recording as the primary visual layer.
- Animate only the outer chrome and explanatory captions from their final CSS position with small `y`, `opacity`, and `scale` offsets.
- Keep transitions short: 0.35s to 0.7s with `power2` or `power3` easing.
- Use finite ambient motion only; never infinite repeats.
- The canvas grid may drift subtly, but product text and status labels must stay readable at all sampled frames.

## What NOT to Do

- Do not use neon, purple-blue gradients, or rounded marketing blobs.
- Do not recreate the app UI by hand when a browser recording exists.
- Do not hide the claim-review gate; it is the core product differentiator.
- Do not use unsupported metric claims.
