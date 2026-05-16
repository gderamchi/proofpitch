# ProofPitch PRD

## 1. Summary

ProofPitch turns a product URL and short release context into a product demo video state, a separate pitch deck, and a visible claim ledger. The MVP is intentionally narrow: one input flow, one generated pack, and no publishing or voice workflow.

## 2. Core Value

Teams need launch material that is clear enough to reuse and conservative enough to trust. ProofPitch combines product context, external research, entity extraction, and structured generation so important claims are marked as supported, weak, unsupported, or user-provided.

## 3. Target Users

- Founder-led B2B teams preparing customer calls, launches, or fundraising.
- Product marketing leads packaging a product story.
- Agencies or consultants creating first-pass positioning assets for clients.

## 4. Core Workflow

1. User enters a public product URL.
2. User adds product name, target audience, release goal, and optional demo instructions.
3. Tavily gathers source material when configured.
4. Pioneer extracts entities and claim risk when configured.
5. OpenAI generates a structured `PitchPack`.
6. ProofPitch returns a `LaunchPack` with a separate Slidev `pitchDeck` and product-demo `demoVideo`.
7. If product walkthrough capture is unavailable, `demoVideo` is explicitly pending or blocked.
8. User reviews the claim ledger before using the deck or demo plan externally.

## 5. P0 Requirements

- Compact landing page that fits the first screen on desktop.
- Responsive generator form with no pricing, auth panel, provider strip, or scroll narrative.
- `LaunchPack` schema containing only `pitchDeck`, `demoVideo`, `pitchPack`, screenshots, captions, checklist, and request metadata.
- `PitchPack` schema with claim ledger, reusable pitch copy, risks, next steps, and provider usage.
- `LaunchPack` response includes OpenAI, Tavily, and Pioneer provider status.
- Provider contract limited to OpenAI, Tavily, and Pioneer.
- Pioneer parser reads nested `raw.result.data.entities` and `claim_risk`.
- Demo video must be real product capture metadata or an explicit blocked/pending state.
- Missing provider keys must produce a useful deterministic pack instead of a blank state.

## 6. Out Of Scope

- Audio generation.
- Voice input and transcription.
- Generated media prompts.
- External channel drafts.
- Pricing presentation on the landing page.
- Slide video masquerading as a product demo.

## 7. Success Criteria

- A new user understands the workflow immediately on the first screen.
- A valid minimal request to `/api/launch-packs` returns `pitchDeck`, `demoVideo`, `pitchPack`, and provider status only.
- No MVP output contains audio scripts, generated media prompts, or external publishing metadata.
- The deck is clearly separate from the demo video state.
- Tests and production build pass.
