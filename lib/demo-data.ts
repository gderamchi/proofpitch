import type { PitchPack } from "./schemas";

export const demoPitchPack: PitchPack = {
  projectName: "ProofPitch",
  oneLiner: "ProofPitch turns a rough founder note into a verified pitch pack.",
  targetUser: "Founders, GTM teams, accelerators, agencies, and product marketers.",
  problem:
    "Teams often understand their product better than they can explain it, and their pitch materials mix strong claims with unsupported language.",
  solution:
    "ProofPitch captures a messy note, checks the claims, and generates a concise pitch pack with the proof trail attached.",
  whyNow:
    "AI can generate polished copy quickly, but buyers and investors increasingly need traceable, defensible claims instead of generic pitch language.",
  executivePitch:
    "ProofPitch helps builders turn raw project context into a clear two-minute pitch without hiding unsupported claims.",
  demoScript2Min:
    "Open with the problem: most pitch material is either too vague or too unverified. Paste a rough founder note, add a project URL, then generate the pack. Show the claim ledger first, then the two-minute script, README snippet, provider usage, and generated hero visual. Close by showing that unsupported claims were removed before sharing the pitch.",
  liveDemoSteps: [
    "Paste or record a rough founder note.",
    "Add a project or GitHub URL.",
    "Generate the pitch pack.",
    "Review the claim ledger before reading the final pitch.",
    "Copy the README snippet and media prompt for the website, investor note, or sales collateral.",
  ],
  claims: [
    {
      id: "claim-1",
      text: "ProofPitch outputs a two-minute script, README snippet, and media prompt.",
      status: "supported",
      sourceType: "inference",
      sourceTitle: "Local demo flow",
      explanation: "These outputs are part of the generated PitchPack schema.",
    },
    {
      id: "claim-2",
      text: "The stack can use OpenAI, Tavily, fal, Gradium, and Pioneer.",
      status: "user_provided",
      sourceType: "user_input",
      sourceTitle: "Provider plan",
      explanation: "The provider stack is configured by the builder and tracked in the generation report.",
    },
    {
      id: "claim-3",
      text: "ProofPitch improves demo quality by 40%.",
      status: "unsupported",
      sourceType: "inference",
      explanation: "This sounds like a metric claim and should not be said without evidence.",
    },
  ],
  generatedMediaPrompt:
    "A cinematic product visual for ProofPitch: a rough voice note transforming into a clean pitch deck, claim ledger, and glowing proof trail, dark premium interface, teal and amber highlights, no text.",
  readmeSnippet:
    "ProofPitch converts rough founder notes and optional project URLs into a verified pitch pack: executive pitch, two-minute script, claim ledger, media prompt, README snippet, and provider usage notes.",
  providerUsage: {
    openai: "Structured pitch-pack generation and synthesis.",
    tavily: "Research and source extraction when TAVILY_API_KEY is configured.",
    fal: "Generated hero media when FAL_KEY is configured.",
    gradium: "Voice transcription/narration skeleton ready for production credentials.",
    pioneer: "Claim/entity extraction skeleton using GLiNER2/Pioneer when configured.",
  },
  risks: [
    "Claim verification is evidence-aided and should not be presented as legal or factual guarantee.",
    "External provider latency can vary during live demos.",
  ],
  nextSteps: [
    "Add real OpenAI credentials for structured generation.",
    "Add Tavily and fal keys for live research and media.",
    "Wire Gradium/Pioneer once production credentials and endpoint contracts are validated.",
  ],
};

export function buildFallbackPitchPack(rawInput: string, projectUrl?: string): PitchPack {
  const trimmed = rawInput.trim();
  const projectName = projectUrl ? new URL(projectUrl).hostname.replace(/^www\./, "") : "Your project";
  const shortClaim = `${trimmed.slice(0, 190)}${trimmed.length > 190 ? "..." : ""}`;

  return {
    ...demoPitchPack,
    projectName,
    oneLiner: `${projectName} turns a rough idea into a pitch narrative with a visible proof trail.`,
    executivePitch: `This project starts from a rough builder note: "${trimmed.slice(0, 180)}${
      trimmed.length > 180 ? "..." : ""
    }" ProofPitch turns that context into a concise pitch pack while keeping unsupported claims visible.`,
    claims: [
      {
        id: "claim-user-input",
        text: shortClaim,
        status: "user_provided",
        sourceType: "user_input",
        sourceTitle: "Founder note",
        explanation: "This comes directly from the user input and has not been independently verified.",
      },
      ...demoPitchPack.claims.slice(0, 2),
    ],
    readmeSnippet: `## ${projectName}\n\n${trimmed}\n\nGenerated local pack: add API credentials to produce live research, media, and stricter claim verification.`,
  };
}
