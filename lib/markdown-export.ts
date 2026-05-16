import type { PitchPack } from "./schemas";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderPitchPackMarkdown(pitchPack: PitchPack) {
  const claims = pitchPack.claims
    .map((claim) =>
      [
        `- **${claim.status}**: ${claim.text}`,
        claim.sourceTitle || claim.sourceUrl ? `  Source: ${claim.sourceTitle ?? "Source"}${claim.sourceUrl ? ` (${claim.sourceUrl})` : ""}` : "",
        `  Why: ${claim.explanation}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return `# ${pitchPack.projectName}

${pitchPack.oneLiner}

## Target User

${pitchPack.targetUser}

## Problem

${pitchPack.problem}

## Solution

${pitchPack.solution}

## Why Now

${pitchPack.whyNow}

## Executive Pitch

${pitchPack.executivePitch}

## Two-Minute Script

${pitchPack.demoScript2Min}

## Live Demo Steps

${list(pitchPack.liveDemoSteps)}

## Claim Ledger

${claims}

## README / Website Snippet

${pitchPack.readmeSnippet}

## Media Prompt

${pitchPack.generatedMediaPrompt}

${pitchPack.generatedMediaUrl ? `Generated media: ${pitchPack.generatedMediaUrl}\n` : ""}
## Risks

${list(pitchPack.risks)}

## Next Steps

${list(pitchPack.nextSteps)}
`;
}
