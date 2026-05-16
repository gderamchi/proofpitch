# Technical Requirements

## 1. Current State

The repo currently provides a single-page Next.js application with API routes, provider adapters, and a Release Pack flow.

Implemented:

- Landing and generation form.
- Release Pack form from public URL, product name, target audience, release goal, optional demo instructions, and optional release channels.
- `/api/launch-packs` Release Pack route.
- `/api/launch-packs/:id` Release Pack detail route.
- `/api/launch-packs/:id/render` local Slidev/Remotion render route.
- `/api/launch-packs/:id/publish/:channel` review-gated channel publishing route.
- `/api/launch-packs/:id/product-hunt/bookmarklet` Product Hunt autofill payload route.
- `/api/oauth/:provider/start` and `/api/oauth/:provider/callback` for YouTube, LinkedIn, and X account connection.
- `/api/generate-pitch-pack` orchestrator.
- `/api/pitch-packs` persisted generation route.
- `/api/pitch-packs/:id` detail route.
- `/api/pitch-packs/:id` metadata update route.
- `/api/pitch-packs/:id/export` Markdown export route.
- `/api/projects` project history route.
- `/api/usage` plan and quota route.
- `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, and `/api/auth/session`.
- `/api/tavily` research route.
- `/api/fal` media route.
- `/api/pioneer-extract` extraction route.
- `/api/gradium-transcribe` voice route using the Gradium STT POST endpoint.
- `/api/health` provider-key status route.
- Zod schemas for input and output validation.
- Slidev pitch deck generation with markdown and export metadata.
- Remotion demo video generation with composition id and render props.
- OpenAI TTS voiceover generation with script-only mode.
- Product Hunt manual handoff and optional safe bookmarklet autofill only when selected. It never submits Product Hunt.
- Source screenshot capture adapter with Playwright-ready worker path and deterministic references.
- Deterministic release output when keys are missing.
- Supabase schema migration with RLS policies.
- Source document persistence for founder input, project URLs, and Tavily sources.
- Manual billing mode with Release Pack quotas.
- Stripe test-mode checkout route and webhook entitlement handler.
- Supabase schema migration for `launch_packs`, `channel_drafts`, and `social_connections`.

Not implemented yet:

- Remote Supabase project linkage.
- Encrypted OAuth token exchange/storage after callback.
- Actual YouTube/LinkedIn/X publish execution with live connected accounts.
- Live-mode automated billing checkout.
- Full hosted export workflow for rendered deck/video assets.
- Production long-running job queue.
- Real production observability.

## 2. Recommended Production Architecture

```txt
Web app
  -> API routes
  -> generation orchestrator
  -> provider adapters
  -> database
  -> object storage
  -> background jobs
  -> observability
```

Recommended stack:

- Next.js on Vercel.
- Postgres for structured data.
- Object storage for audio, generated media, and exports.
- Queue/workflow runner for long provider calls and export jobs.
- Local worker first for Slidev/Remotion rendering, with cloud rendering deferred until the workflow proves useful.
- Server-side provider keys only.
- Structured logs and run traces for every generation.

## 3. Data Model

Core tables:

- `users`
  - id
  - email
  - name
  - created_at
- `organizations`
  - id
  - name
  - plan
  - billing_mode
  - single_pack_credits
  - created_at
- `organization_members`
  - organization_id
  - user_id
  - role
- `projects`
  - id
  - organization_id
  - name
  - default_url
  - created_by
  - created_at
- `source_documents`
  - id
  - project_id
  - type
  - title
  - url
  - extracted_text
  - metadata
- `pitch_packs`
  - id
  - organization_id
  - project_id
  - status
  - plan
  - quota
  - input_text
  - project_url
  - output_json
  - generated_media_url
  - created_at
- `claims`
  - id
  - pitch_pack_id
  - text
  - status
  - source_type
  - source_title
  - source_url
  - explanation
- `provider_runs`
  - id
  - pitch_pack_id
  - provider
  - status
  - latency_ms
  - estimated_cost_cents
  - error
  - metadata
- `exports`
  - id
  - pitch_pack_id
  - type
  - storage_url
  - created_at
- `usage_counters`
  - organization_id
  - period_start
  - pack_count
  - updated_at

Pricing and quotas:

- Free: 1 Release Pack/month.
- Founder: 10 Release Packs/month.
- Pro: 40 Release Packs/month.
- Agency: 150 Release Packs/month.
- Enterprise: configurable limit, default 1000 Release Packs/month.
- Single Release Pack: 49€ manual credit, represented by `organizations.single_pack_credits`.
- Stripe test prices map paid CTAs to Checkout Sessions. Checkout webhooks update `organizations.plan`, `organizations.billing_mode`, or `organizations.single_pack_credits`.

## 4. API Requirements

Current routes should evolve into:

- `POST /api/pitch-packs`
  - verifies quota
  - generates and persists the pack
  - returns immediate result with record and quota metadata
- `GET /api/pitch-packs/:id`
  - retrieves saved output
- `PATCH /api/pitch-packs/:id`
  - updates title, notes, or approved copy
- `POST /api/pitch-packs/:id/regenerate`
  - regenerates selected sections
- `POST /api/pitch-packs/:id/export`
  - creates markdown export now
  - returns `501` for PDF until the PDF renderer is added
- `GET /api/projects`
  - lists projects
- `POST /api/projects`
  - creates project
- `GET /api/health`
  - provider and app health
- `GET /api/usage`
  - plan, monthly quota, current usage, remaining packs, and single-pack credits
- `POST /api/billing/checkout`
  - requires an authenticated session
  - accepts `founder`, `pro`, `agency`, or `single`
  - returns a Stripe Checkout Session URL
- `POST /api/billing/webhook`
  - verifies the Stripe signature
  - applies `checkout.session.completed` entitlements to the organization

## 5. Generation Pipeline

1. Validate request with Zod.
2. Normalize input.
3. Extract source text from URL.
4. Run research provider.
5. Extract candidate claims.
6. Generate structured pitch pack.
7. Verify and label claims.
8. Generate media prompt and optional media.
9. Persist result and provider run metadata.
10. Return result or stream progress to client.

Current implementation returns immediate results. Long-running queue execution is a production hardening step.

## 6. Claim Verification Requirements

Each claim must include:

- `text`
- `status`
- `sourceType`
- `sourceTitle`
- `sourceUrl`
- `explanation`

Status rules:

- `supported`: a source directly supports the claim.
- `weak`: a source directionally supports the claim but not the exact wording.
- `unsupported`: no source supports the claim, or it contains a metric/outcome with no evidence.
- `user_provided`: the user supplied it and it has not been independently verified.

## 7. Provider Requirements

OpenAI:

- Structured output generation.
- Strict schema validation.
- Retry once on transient failure.
- Log model, latency, and token usage when available.

Tavily:

- Search and extraction.
- Store source URLs and snippets.
- Cap results per run to control cost.

fal:

- Generate media only after final prompt is created.
- Store returned media URL.
- Add media generation to async job path before production launch.

Pioneer:

- Use for claim/entity extraction when endpoint contract is validated.
- Store raw extraction metadata for debugging.

Gradium:

- Uses the Gradium STT POST endpoint for complete uploaded audio files.
- Accepts WAV, PCM, OGG, or Opus content types.
- Voice path remains optional until text flow retention is proven.

## 8. Security Requirements

- Provider keys only on the server.
- No provider key in client bundle.
- User data scoped by organization.
- Row-level access or equivalent application-level authorization.
- Supabase `service_role` is server-only and never exposed as a public env var.
- Audio and media files stored in private buckets by default.
- Signed URLs for downloads.
- User deletion path.
- Clear data-retention policy.
- Prompt-injection guardrails for external URLs.

## 9. Reliability Requirements

- Every provider adapter must return `used`, `missing`, `failed`, `fallback`, or `pending`.
- Main generation must return a usable fallback if non-critical providers fail.
- Long jobs should be queued.
- Client should show progress states.
- Provider failures should be visible to the user without exposing secrets.

## 10. Observability Requirements

- Request id per generation.
- Provider latency per run.
- Provider status per run.
- Estimated cost per run.
- Structured error details.
- Dashboard for failed generations.
- Alert when fallback rate exceeds threshold.

## 11. Test Requirements

- Unit tests for schema validation.
- Unit tests for fallback generation.
- API route tests for missing keys.
- Provider adapter tests with mocked responses.
- E2E test for input to generated pack.
- Visual regression on desktop and mobile.
- Golden output tests for claim status behavior.
- RLS smoke tests against a linked Supabase project.
- Quota tests for Free, Pro, and one-shot credits.

## 12. Launch Blockers

- Link a dedicated Supabase project and apply the migration.
- Add copy/export actions.
- Validate live provider credentials.
- Add rate limits.
- Move Stripe from test mode to live mode after billing QA and legal/pricing review.
- Add a privacy policy and terms of use.
- Add basic support/contact flow.
