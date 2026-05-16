# ProofPitch PRD

## 1. Summary

ProofPitch is a release-pack and verification product for teams that already have a product but do not yet have a credible pitch deck or demo video. A user provides a public product URL and release context, ProofPitch produces a reviewable release pack, and every important claim is labeled with a proof status.

The product should not feel like a generic text generator or presentation toy. The core value is source-backed release execution: a Slidev pitch deck, Remotion demo video, voiceover, social drafts, optional Product Hunt handoff, reusable pitch copy, and a visible proof trail.

## 2. Problem

Teams create launch material from scattered product pages, notes, calls, decks, and internal docs. The final output often has four defects:

- The story is not clear enough to reuse across sales, fundraising, website, and product launch.
- Claims are polished but not traceable.
- Demo videos, voiceovers, decks, and release posts are still manual work after the pitch copy is generated.
- Existing AI presentation tools generate structure and design, but do not make unsupported claims obvious.

## 3. Target Users

Primary:

- Founder or CEO of a seed to Series B B2B company.
- Product marketing lead preparing launch or sales collateral.
- Agency or consultant packaging client positioning.

Secondary:

- Accelerator or venture studio supporting multiple portfolio companies.
- Sales enablement team producing narrative assets from product notes, call notes, and source docs.

## 4. North Star

A new user can go from public product URL to a reviewable, evidence-backed release pack in under five minutes, with every material claim labeled and every publish action requiring approval.

## 5. Product Principles

- Proof before polish.
- One strong workflow, not a workspace.
- Every generated claim must be traceable, marked as user-provided, or marked as unsupported.
- Outputs must be reusable outside ProofPitch.
- Missing provider keys or provider failures must never break the core product experience.

## 6. Core Workflow

1. User enters a public product URL.
2. User adds product name, target audience, release goal, optional demo path instructions, and optional release channels.
3. ProofPitch researches external context.
4. ProofPitch extracts candidate claims.
5. ProofPitch classifies claims as `supported`, `weak`, `unsupported`, or `user_provided`.
6. ProofPitch generates the Release Pack: Slidev deck, Remotion video metadata, voiceover script/audio status, demo script, screenshots, YouTube metadata, LinkedIn/X drafts, optional Product Hunt handoff, and embedded pitch pack.
7. User reviews the claim ledger and channel drafts.
8. User publishes only through explicit review confirmation or manually submits Product Hunt.

## 7. P0 Requirements

- Public URL input plus release context fields.
- Structured generation of `LaunchPack` as a release pack.
- Structured generation of `PitchPack`.
- Slidev deck markdown and export metadata.
- Remotion demo video props and local render metadata.
- Voiceover script with OpenAI TTS audio when available and script-only mode otherwise.
- Product Hunt manual submit and optional bookmarklet autofill only when selected as a channel.
- LinkedIn, X, and YouTube channel drafts with review-gated publish contracts.
- Claim ledger with status, explanation, and source metadata.
- Source research adapter.
- Provider status report.
- Usable release pack when provider keys are missing.
- Copy-ready outputs:
  - one-liner
  - executive pitch
  - two-minute script
  - live demo steps
  - README or website snippet
  - media prompt
  - risk list
  - next steps
- Error states that tell the user what failed and what still worked.

## 8. P1 Requirements

- User accounts and saved projects.
- Version history for generated pitch packs.
- Copy buttons per output block.
- PDF or markdown export.
- Audio note upload and transcription.
- Media generation stored in project history.
- Plan and quota enforcement by Release Pack.
- Manual billing mode with one-shot Release Pack credits.
- Better URL ingestion:
  - website extraction
  - docs extraction
  - repository README extraction
- Basic billing.
- Usage limits by plan.

## 9. P2 Requirements

- Team workspaces.
- Brand voice and style memory.
- Hosted share page and richer deck export.
- CRM or sales asset export.
- Competitive positioning report.
- Multi-source evidence ingestion from PDFs and internal docs.
- Human approval workflow for enterprise teams.

## 10. Non-Goals

- Full slide editor.
- General-purpose chat assistant.
- CRM replacement.
- Heavy project management workspace.
- Legal or compliance certification.

## 11. Success Metrics

Activation:

- 60% of new users generate a first pack.
- Median time from first page load to first generated pack under five minutes.
- 35% of generated packs produce at least one copy/export action.

Quality:

- Less than 5% malformed structured outputs.
- Less than 10% provider runs fail without a useful partial result.
- User-rated claim ledger usefulness above 4/5.

Revenue:

- 5% to 10% visitor-to-account conversion from targeted founder traffic.
- 8% to 15% free-to-paid conversion after first useful pack.
- Gross margin above 80% after provider-cost controls.

## 12. Acceptance Criteria

- A user can generate a pack with no account.
- A provider failure returns a partial result instead of a blank state.
- The claim ledger appears before final copy in the result surface.
- Unsupported claims are visually distinct.
- Output validates against the schema.
- The app can run locally with only `.env.local`.
- Free usage blocks after the monthly quota and reports the next available action.
- Authenticated users have an organization, saved packs, usage counters, and export history.

## 13. Open Product Decisions

- Whether the first paid wedge is founders, agencies, or accelerators.
- Whether the default export should be markdown, PDF, or a hosted share page.
- Whether media generation is core for paid conversion or a premium add-on.
- Whether voice input should be P1 or wait until core retention is proven.
