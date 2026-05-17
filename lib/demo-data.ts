import type { DemoBrief } from "./schemas";

export const demoBriefFixture: DemoBrief = {
  projectName: "ProofPitch",
  oneLiner: "Turn a public product URL into a proof-aware demo video with reviewable claims.",
  targetUser: "Founder-led B2B teams",
  demoNarrative:
    "Open the product, follow the requested workflow, pause on the strongest proof moment, and narrate only claims that survived review.",
  demoScript2Min:
    "Start with the product URL and explain who the demo is for. Walk through the primary product path, call out the proof that is visible on screen, and avoid unsupported metrics. End by telling the viewer which claim was validated and what to inspect next.",
  demoSteps: [
    "Open the public product URL.",
    "Follow the requested demo path or the clearest visible workflow.",
    "Pause on the strongest proof moment.",
    "Close with the accepted proof claim and next action.",
  ],
  claims: [
    {
      id: "claim-1",
      text: "The demo is based on the submitted public product URL.",
      status: "user_provided",
      sourceType: "user_input",
      sourceTitle: "Founder input",
      sourceUrl: null,
      explanation: "The user supplied the URL, so the claim is safe to narrate as input context.",
    },
    {
      id: "claim-2",
      text: "ProofPitch separates unsupported claims from the final narration.",
      status: "supported",
      sourceType: "user_input",
      sourceTitle: "ProofPitch workflow",
      sourceUrl: null,
      explanation: "The proof review gate controls which claims feed captions and voiceover.",
    },
  ],
  providerUsage: {
    openai: "Fallback used because OpenAI was unavailable.",
    tavily: "No live Tavily research was available for this fallback.",
    pioneer: "No live Pioneer extraction was available for this fallback.",
  },
  risks: [
    "Public websites can block capture with bot protection or consent walls.",
    "Narration should not include unsupported traction, revenue, or performance metrics.",
  ],
  nextSteps: [
    "Review accepted claims before rendering.",
    "Render the HyperFrames MP4 and inspect it before sharing.",
  ],
};

export function buildFallbackDemoBrief(rawInput: string, projectUrl?: string): DemoBrief {
  const trimmed = rawInput.replace(/\s+/g, " ").trim();
  const projectName = projectUrl ? new URL(projectUrl).hostname.replace(/^www\./, "") : "Your product";

  return {
    ...demoBriefFixture,
    projectName,
    oneLiner: `${projectName} gets a proof-aware product demo from the submitted URL.`,
    demoNarrative: `The demo should show ${projectName} through the safest visible product path, using this context: ${trimmed.slice(0, 220)}.`,
    demoScript2Min:
      `Open ${projectName}, follow the requested workflow, and narrate only the claims that survived review. ` +
      `Use the submitted context as direction, not as proof of unsupported metrics.`,
    claims: [
      {
        id: "claim-1",
        text: `The demo request targets ${projectName}.`,
        status: "user_provided",
        sourceType: "user_input",
        sourceTitle: "Demo request",
        sourceUrl: projectUrl ?? null,
        explanation: "The product name and URL come from the submitted request.",
      },
      ...demoBriefFixture.claims.slice(1),
    ],
  };
}
