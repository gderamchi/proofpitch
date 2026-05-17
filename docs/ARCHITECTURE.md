# ProofPitch Architecture And Toolchain

This document gives technical reviewers a concise map of the application, the frameworks used, and the main runtime boundaries.

## Runtime Shape

ProofPitch is a Next.js 16 App Router application using TypeScript and React 19.

- UI entrypoint: `app/page.tsx`.
- Main client workflow: `components/proofpitch-landing.tsx`.
- API routes: `app/api/**/route.ts`.
- Shared contracts: `lib/schemas.ts`.
- Optional persistence: Supabase migrations under `supabase/migrations`.
- Local fallback persistence: `lib/local-store.ts`.
- Render artifacts: `.proofpitch/release-assets`, ignored by git.

The App Router API uses route handlers. Next.js 16 route handlers are defined through `route.ts` files under `app/api`, use standard Web `Request` and `Response` primitives, and can use `NextResponse` helpers.

## Core Data Flow

1. The user enters a product URL, product name, audience, launch goal, optional demo instructions, and deck mode.
2. `POST /api/launch-packs` validates the request with `CreateLaunchPackRequestSchema`.
3. `lib/launch-pack-service.ts` asks `lib/pitch-pack-service.ts` to build the underlying `PitchPack`.
4. Tavily research and Pioneer extraction are added when their keys are configured.
5. OpenAI synthesizes a strict `PitchPack` JSON shape when `OPENAI_API_KEY` is configured.
6. Missing or failed providers produce explicit provider states and deterministic fallback content.
7. The launch pack starts with pending claim review and pending deck state.
8. `POST /api/launch-packs/:id/outline` accepts selected claim ids and uses `lib/deck-spec.ts` to compile a deterministic `DeckOutline` and Slidev markdown.
9. `POST /api/launch-packs/:id/render` optionally runs Slidev/HyperFrames rendering and product-site capture.
10. The render flow refreshes `socialDrafts` when deck or video asset state changes.
11. Rendered local artifacts are served by `/api/launch-packs/:id/video` and `/api/launch-packs/:id/recording`.

## Public Contracts

The key contracts live in `lib/schemas.ts`.

- `PitchPack`: generated story, two-minute demo script, live demo steps, claim ledger, provider usage, risks, and next steps.
- `LaunchPack`: request metadata, provider statuses, claim review, `PitchPack`, `PitchDeck`, `DemoVideo`, screenshots, captions, and checklist.
- `DeckOutline`: approved claim ids plus structured slide specs.
- `PitchDeck`: deterministic Slidev markdown and render/export state.
- `DemoVideo`: HyperFrames render metadata, product screenshots, captions, and upload/render status.
- `SocialDrafts`: X, LinkedIn, and Product Hunt launch drafts with explicit video and deck asset notes.
- `ProviderReport`: provider state and sanitized detail for OpenAI, Tavily, and Pioneer.

## Frameworks And Libraries

| Tool | Role |
| --- | --- |
| Next.js 16 | App Router, route handlers, production build, local dev server. |
| React 19 | UI rendering for the landing/generator experience. |
| TypeScript | Static typing across route handlers, services, and components. |
| Tailwind CSS 4 | Styling pipeline through PostCSS and `app/globals.css`. |
| Zod 4 | Runtime validation for request and response contracts. |
| Supabase JS/SSR | Optional auth, persistence, RLS-backed project data, and private export storage. |
| OpenAI Responses API | Structured `PitchPack` synthesis with strict JSON validation. |
| Tavily | Optional web research and source snippets for claim support. |
| Pioneer | Optional entity extraction and claim-risk signal. |
| Playwright Chromium | Optional product-site screenshot and recording capture. |
| HyperFrames | HTML product demo video composition and MP4 render path. |
| Slidev | Deterministic pitch-deck markdown and PDF export path. |
| Stripe | Parked billing/webhook support for future monetization; checkout is disabled in free-access mode. |
| Vitest | Backend and service-level test runner. |
| ESLint | Linting through `eslint-config-next`. |
| PostCSS | CSS build integration for Tailwind. |
| lucide-react | Icon library for UI controls. |
| npm | Package manager used with the committed `package-lock.json`. |
| Vercel | Linked production deployment platform. |
| GitHub | Public repository hosting and push target. |

## Persistence And Access Mode

ProofPitch currently prioritizes the free MVP workflow.

- Supabase is optional locally.
- When Supabase is not configured, API routes use local fallback storage and still return useful generated packs.
- The Supabase schema includes organizations, members, projects, pitch packs, launch packs, claims, provider runs, usage counters, source documents, and exports.
- Row-level security policies restrict persisted launch packs to organization members when Supabase auth is active.
- Auth routes are available, but the main MVP path intentionally does not require auth.

## Provider Boundaries

### OpenAI

OpenAI is the synthesis layer. The app sends raw user context, optional project URL, optional Tavily evidence, and optional Pioneer extraction summaries to the Responses API. The model must return the `PitchPack` JSON shape and should not invent unsupported metrics.

### Tavily

Tavily is the research layer. It returns answer text, source URLs, snippets, scores, and usage metadata. Those inputs support claim review and provider usage notes.

### Pioneer

Pioneer is the extraction layer. It extracts entities and claim risk from founder notes. The adapter supports nested response data at `raw.result.data.entities` and `raw.result.data.claim_risk`.

## Rendering Boundaries

Deck rendering and product demo rendering are separate by design.

- Slidev renders the approved deck from deterministic markdown.
- HyperFrames renders product-demo video content from product screenshots, browser recordings, captions, and demo steps.
- Playwright capture can produce screenshots and browser recordings from the submitted product URL.
- The app must not treat a Slidev deck render as the product demo video.
- Local rendering is opt-in through `PROOFPITCH_ENABLE_LOCAL_RENDER=1`.
- Social drafts are ready-to-copy launch copy only. X/LinkedIn video attachment and Product Hunt submission remain manual unless a future OAuth/API publishing layer is added.

## Security And Secrets

- Real `.env.local` files are ignored by git.
- API keys are read server-side through environment variables.
- Provider error details are sanitized before being returned or persisted.
- Supabase service-role access is server-only and required for admin persistence/export operations.
- Stripe webhook verification is implemented, but checkout is disabled while the MVP is in free-access mode.

## Deployment

The repository is linked to Vercel through `.vercel/project.json`. The expected production path is:

```bash
npm test
npm run lint
npm run build
vercel --prod
```

After deployment, verify:

- the public homepage,
- `GET /api/health`,
- provider configuration flags,
- and any changed user flow.
