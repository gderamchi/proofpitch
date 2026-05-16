# ProofPitch API Reference

ProofPitch exposes Next.js App Router route handlers under `app/api`. All routes use the Node.js runtime and JSON responses unless the route explicitly serves a rendered media artifact.

## Conventions

- Validation is implemented with Zod schemas in `lib/schemas.ts`.
- Invalid JSON bodies or schema failures return `400` with `{ "error": "Invalid request body.", "details": ... }`.
- Missing launch packs or pitch packs return `404`.
- Unexpected server failures return `500` with a short `detail` string.
- Auth and billing routes exist for future product work, but the MVP launch-pack workflow does not require login, checkout, quota headroom, or paid plans.

## Launch Packs

### `POST /api/launch-packs`

Creates the core MVP artifact from a product URL, positioning context, demo instructions, and deck mode.

Request:

```json
{
  "sourceUrl": "https://example.com",
  "productName": "ProofPitch",
  "targetAudience": "Founder-led B2B teams",
  "launchGoal": "Prepare a customer-call demo and concise deck.",
  "demoInstructions": "Accept cookies if needed, search pricing, then scroll to the CTA.",
  "deckMode": "sales"
}
```

Request fields:

- `sourceUrl`: required URL.
- `productName`: required, 1 to 140 characters.
- `targetAudience`: required, 3 to 240 characters.
- `launchGoal`: required, 3 to 500 characters.
- `demoInstructions`: optional, up to 2000 characters.
- `deckMode`: required, one of `investor`, `sales`, or `launch`.

Response: a `LaunchPack` containing request metadata, provider statuses, `pitchPack`, `claimReview`, pending or ready `pitchDeck`, `demoVideo`, captions, screenshots, checklist, and generated `socialDrafts`.

Common errors:

- `400`: request body does not match `CreateLaunchPackRequestSchema`.
- `500`: launch-pack generation failed.

### `GET /api/launch-packs/:id`

Returns a persisted or locally stored launch pack detail.

Response:

```json
{
  "launchPack": {
    "id": "launch-id",
    "status": "completed"
  }
}
```

Common errors:

- `404`: release pack was not found.
- `500`: detail lookup failed.

### `POST /api/launch-packs/:id/outline`

Approves selected claims and compiles the deterministic deck outline plus Slidev markdown. Unsupported claims should not be accepted into the deck.

Request:

```json
{
  "acceptedClaimIds": ["claim-1"],
  "launchPack": {
    "id": "launch-id"
  }
}
```

`launchPack` is optional. It lets the caller provide the full current launch-pack object when local persistence cannot find the id.

Response: updated `LaunchPack` with `claimReview.status: "approved"` and `pitchDeck.status: "ready"` when the outline was generated.

Common errors:

- `400`: no accepted claim ids or invalid launch-pack shape.
- `404`: release pack was not found.
- `500`: outline approval failed.

### `POST /api/launch-packs/:id/social-drafts`

Refreshes X, LinkedIn, and Product Hunt launch drafts for the current pack. The drafts are persisted into `LaunchPack.socialDrafts` and include the latest demo-video and pitch-deck asset state.

Request:

```json
{
  "launchPack": {
    "id": "launch-id"
  }
}
```

`launchPack` is optional. It lets the caller provide the full current launch-pack object when local persistence cannot find the id.

Response: updated `LaunchPack` with `socialDrafts.assets.video`, `socialDrafts.assets.deck`, and platform drafts for `x`, `linkedin`, and `productHunt`.

Common errors:

- `400`: invalid release pack id or invalid launch-pack shape.
- `404`: release pack was not found.
- `500`: social draft refresh failed.

### `POST /api/launch-packs/:id/render`

Starts render work for approved deck assets and/or the Remotion demo video.

Deck render request:

```json
{
  "dryRun": false,
  "launchPack": {
    "id": "launch-id"
  }
}
```

Video render request used by the homepage:

```json
{
  "renderVideo": true,
  "renderDeck": false,
  "captureSite": true,
  "dryRun": false
}
```

Behavior:

- If `renderVideo` is exactly `true`, the route uses the video render path.
- Otherwise it uses the deck-render path and returns `{ "launchPack": ..., "pitchDeck": ..., "render": ..., "requiresSignIn": false }`.
- Local rendering requires `PROOFPITCH_ENABLE_LOCAL_RENDER=1`.
- Product-site capture is controlled by `PROOFPITCH_PLAYWRIGHT_CAPTURE`.
- Public video render requests prefer server-side lookup, but may include a full `launchPack` fallback when local serverless storage cannot find the id.
- If Supabase admin env vars are configured, a ready MP4 is uploaded to the private `proofpitch-exports` bucket and returned as a signed URL.
- When a video render finishes, `demoVideo` and `socialDrafts` are refreshed before the response is returned.

Common errors:

- `400`: invalid deck-render/video-render request body or invalid release pack id.
- `404`: release pack was not found.
- `500`: rendering or upload failed.

### `GET /api/launch-packs/:id/video`

Serves the locally rendered Remotion MP4 from the configured release asset directory.

Response:

- `200`: `video/mp4` body with `Cache-Control: no-store`.
- `400`: launch-pack id contains characters outside `[a-zA-Z0-9-]`.
- `404`: demo video has not been rendered yet.

### `GET /api/launch-packs/:id/recording`

Serves the intermediate browser recording captured during the product walkthrough.

Response:

- `200`: `video/webm` body with `Cache-Control: no-store`.
- `400`: launch-pack id contains characters outside `[a-zA-Z0-9-]`.
- `404`: browser recording is not available yet.

## Pitch Packs

### `POST /api/generate-pitch-pack`

Generates the underlying `PitchPack` from raw context and an optional product URL.

Request:

```json
{
  "rawInput": "ProofPitch turns rough founder notes into verified pitch packs.",
  "projectUrl": "https://example.com"
}
```

Response:

```json
{
  "mode": "live",
  "pitchPack": {
    "projectName": "ProofPitch",
    "claims": []
  },
  "providers": {
    "openai": { "state": "used", "detail": "Structured generation completed." },
    "tavily": { "state": "used", "detail": "Research completed." },
    "pioneer": { "state": "used", "detail": "Extraction completed." }
  }
}
```

`mode` can be `live`, `partial`, or `demo`.

### `GET /api/pitch-packs`

Lists stored pitch-pack summaries. When Supabase is not configured, this reads from the process-local MVP store in `lib/local-store.ts`.

### `POST /api/pitch-packs`

Creates a pitch pack using the same request shape as `/api/generate-pitch-pack`.

### `GET /api/pitch-packs/:id`

Returns a pitch-pack detail record with source documents, provider runs, claims, and exports when available.

Common errors:

- `404`: pitch pack was not found.
- `500`: lookup failed.

### `PATCH /api/pitch-packs/:id`

Updates editable pitch-pack metadata.

Request:

```json
{
  "projectName": "ProofPitch",
  "approvalNote": "Reviewed for the demo."
}
```

At least one of `projectName` or `approvalNote` is required.

### `POST /api/pitch-packs/:id/export`

Exports a pitch pack.

Request:

```json
{
  "type": "markdown"
}
```

`type` defaults to `markdown` and can be `markdown` or `pdf`.

Response: export body and status returned by `exportPitchPack`.

## Provider Helper Routes

### `POST /api/tavily`

Runs Tavily research with the same request shape as `GeneratePitchPackRequestSchema`.

Request:

```json
{
  "rawInput": "ProofPitch turns rough founder notes into verified pitch packs.",
  "projectUrl": "https://example.com"
}
```

Response: Tavily adapter result with provider state, answer/source details, and usage metadata.

### `POST /api/pioneer-extract`

Runs Pioneer entity and claim-risk extraction.

Request:

```json
{
  "rawInput": "ProofPitch turns rough founder notes into verified pitch packs."
}
```

Response: Pioneer adapter result with extracted entities and `claim_risk` when configured.

## Projects And Usage

### `GET /api/projects`

Lists project summaries with pitch-pack counts and latest pitch-pack timestamp.

### `POST /api/projects`

Creates a project.

Request:

```json
{
  "name": "ProofPitch",
  "defaultUrl": "https://example.com"
}
```

Response status: `201`.

### `GET /api/usage`

Returns the current usage snapshot and a pricing pointer:

```json
{
  "quota": {
    "plan": "free",
    "billingMode": "manual"
  },
  "pricing": {
    "mode": "documentation_only",
    "docs": "docs/BUSINESS_PLAN.md"
  }
}
```

Usage is informational in the MVP and is not a gate on the launch-pack workflow.

## Auth Routes

Auth routes are present for future account workflows. They are not required for the free-access MVP path.

### `GET /api/auth/session`

Returns the current session payload from Supabase when configured or the local fallback session payload otherwise.

### `POST /api/auth/login`

Signs in with Supabase email/password auth.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Common responses:

- `200`: current session payload.
- `400`: invalid body.
- `401`: Supabase rejected credentials.
- `503`: Supabase is not configured.

### `POST /api/auth/signup`

Creates a Supabase auth user.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

Common responses:

- `200`: current session payload or `{ "needsEmailConfirmation": true }`.
- `400`: invalid body or Supabase signup error.
- `503`: Supabase is not configured.

### `POST /api/auth/logout`

Signs out of Supabase when configured. If Supabase is not configured, returns `{ "ok": true, "configured": false }`.

## Billing Routes

Billing routes are parked while ProofPitch runs in free-access mode.

### `POST /api/billing/checkout`

Always returns `410`:

```json
{
  "error": "Checkout is disabled while ProofPitch is in free access mode.",
  "pricing": {
    "mode": "documentation_only",
    "docs": "docs/BUSINESS_PLAN.md"
  }
}
```

### `POST /api/billing/webhook`

Processes Stripe webhook payloads for future checkout entitlement updates. For `checkout.session.completed`, it reads `metadata.plan` and `metadata.organizationId`, then applies the entitlement through Supabase admin access.

Common responses:

- `200`: `{ "received": true }`.
- `400`: webhook construction or entitlement update failed.

## Health

### `GET /api/health`

Reports service and integration health.

Response:

```json
{
  "ok": true,
  "service": "proofpitch",
  "providers": {
    "openai": { "configured": true },
    "tavily": { "configured": false },
    "pioneer": { "configured": false }
  },
  "supabase": {
    "configured": false
  },
  "billing": {
    "mode": "manual"
  },
  "hasOpenAI": true,
  "hasTavily": false,
  "hasPioneer": false,
  "hasSupabase": false,
  "billingMode": "manual"
}
```

When Supabase is not configured, `ok` can still be true because local MVP operation does not require persistence.
