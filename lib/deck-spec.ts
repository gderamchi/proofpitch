import {
  DeckOutlineSchema,
  type Claim,
  type CreateLaunchPackRequest,
  type DeckMode,
  type DeckOutline,
  type PitchPack,
} from "./schemas";

type DeckSpecInput = CreateLaunchPackRequest & {
  deckMode: DeckMode;
};

const modeCopy: Record<DeckMode, { label: string; outcome: string; close: string }> = {
  investor: {
    label: "Investor",
    outcome: "Show why this product can become a fundable wedge.",
    close: "Use the deck to drive diligence, not to overstate traction.",
  },
  sales: {
    label: "Sales",
    outcome: "Show why the buyer should take the next product call.",
    close: "Use the deck after the demo to reinforce the proof-backed buying case.",
  },
  launch: {
    label: "Launch",
    outcome: "Show what is shipping, who it serves, and what is safe to claim.",
    close: "Use the deck as a release asset after unsupported claims are removed.",
  },
};

function compact(value: string, max = 650) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 3).trim()}...`;
}

function bulletList(items: string[]) {
  return items.map((item) => `- ${compact(item, 220)}`).join("\n");
}

function sourceLabel(claim: Claim) {
  const status = claim.status.replaceAll("_", " ");
  const source = claim.sourceTitle || claim.sourceType;

  return `${claim.text} (${status}; ${source})`;
}

export function defaultAcceptedClaimIds(pitchPack: PitchPack) {
  return pitchPack.claims
    .filter((claim) => claim.status !== "unsupported")
    .map((claim) => claim.id);
}

export function buildClaimReview(pitchPack: PitchPack) {
  const acceptedClaimIds = defaultAcceptedClaimIds(pitchPack);
  const accepted = new Set(acceptedClaimIds);

  return {
    status: "pending" as const,
    acceptedClaimIds,
    rejectedClaimIds: pitchPack.claims
      .filter((claim) => !accepted.has(claim.id))
      .map((claim) => claim.id),
  };
}

export function buildPendingDeckOutline(input: DeckSpecInput): DeckOutline {
  return DeckOutlineSchema.parse({
    status: "pending",
    deckMode: input.deckMode,
    acceptedClaimIds: [],
    slides: [],
  });
}

export function buildDeckSpec({
  input,
  pitchPack,
  acceptedClaimIds,
}: {
  input: DeckSpecInput;
  pitchPack: PitchPack;
  acceptedClaimIds: string[];
}): DeckOutline {
  const accepted = new Set(acceptedClaimIds);
  const acceptedClaims = pitchPack.claims.filter(
    (claim) => accepted.has(claim.id) && claim.status !== "unsupported",
  );
  const safeAcceptedClaimIds = acceptedClaims.map((claim) => claim.id);
  const mode = modeCopy[input.deckMode];

  return DeckOutlineSchema.parse({
    status: "ready",
    deckMode: input.deckMode,
    acceptedClaimIds: safeAcceptedClaimIds,
    slides: [
      {
        id: "cover",
        title: input.productName,
        layout: "cover",
        body: compact(`${pitchPack.oneLiner}\n\n${mode.label} deck. ${mode.outcome}`, 520),
        claimIds: [],
        notes: `Open with the product promise and make clear this is a ${mode.label.toLowerCase()} deck.`,
      },
      {
        id: "audience-goal",
        title: "Audience And Goal",
        layout: "section",
        body: bulletList([
          `Audience: ${input.targetAudience}`,
          `Goal: ${input.launchGoal}`,
          `Deck mode: ${mode.label}`,
        ]),
        claimIds: [],
        notes: "Anchor the deck in the user's target audience and the requested outcome.",
      },
      {
        id: "problem",
        title: "Problem",
        layout: "section",
        body: compact(pitchPack.problem),
        claimIds: [],
        notes: "Keep the problem specific and avoid adding unsupported market claims.",
      },
      {
        id: "solution",
        title: "Solution",
        layout: "two_column",
        body: [`What changes:\n${compact(pitchPack.solution, 420)}`, `Why now:\n${compact(pitchPack.whyNow, 420)}`].join("\n\n"),
        claimIds: [],
        notes: "Connect the solution to the timing without inventing traction metrics.",
      },
      {
        id: "proof-ledger",
        title: "Proof Ledger",
        layout: "proof",
        body: acceptedClaims.length
          ? bulletList(acceptedClaims.map(sourceLabel))
          : "No claims were accepted for the deck yet. Keep the PDF export gated until at least one claim is approved.",
        claimIds: safeAcceptedClaimIds,
        notes: "Only accepted non-unsupported claims appear here. Rejected and unsupported claims stay out of the deck.",
      },
      {
        id: "product-demo",
        title: "Product Demo",
        layout: "demo",
        body: bulletList([
          input.demoInstructions || "Show the first meaningful public product workflow.",
          ...pitchPack.liveDemoSteps.slice(0, 4),
        ]),
        claimIds: [],
        notes: "Use the actual product path as the proof moment; do not replace the demo with slides.",
      },
      {
        id: "risks",
        title: "Risks To Avoid",
        layout: "risks",
        body: bulletList(pitchPack.risks.slice(0, 4)),
        claimIds: [],
        notes: "Use this slide to prevent overclaiming before the deck is shared externally.",
      },
      {
        id: "next-steps",
        title: "Next Steps",
        layout: "closing",
        body: bulletList([...pitchPack.nextSteps.slice(0, 3), mode.close]),
        claimIds: [],
        notes: "Close with a concrete next action tied to the selected deck mode.",
      },
    ],
  });
}

function escapeSlidevText(value: string) {
  return value.replace(/---/g, "- - -").trim();
}

function layoutForSlidev(layout: DeckOutline["slides"][number]["layout"]) {
  if (layout === "cover") {
    return "cover";
  }

  if (layout === "two_column") {
    return "two-cols";
  }

  return "default";
}

function slideMarkdown(slide: DeckOutline["slides"][number], index: number) {
  const frontmatter = ["---", `layout: ${layoutForSlidev(slide.layout)}`, "---"].join("\n");
  const heading = index === 0 ? `# ${escapeSlidevText(slide.title)}` : `## ${escapeSlidevText(slide.title)}`;
  const notes = ["<!--", escapeSlidevText(slide.notes), "-->"].join("\n");

  return [frontmatter, "", heading, "", escapeSlidevText(slide.body), "", notes].join("\n");
}

export function buildSlidevMarkdownFromDeckSpec({
  input,
  outline,
}: {
  input: DeckSpecInput;
  outline: DeckOutline;
  pitchPack: PitchPack;
}) {
  const frontmatter = [
    "---",
    "theme: default",
    `title: ${JSON.stringify(`${input.productName} ${modeCopy[outline.deckMode].label.toLowerCase()} deck`)}`,
    "info: Release deck generated by ProofPitch",
    "drawings:",
    "  persist: false",
    "transition: slide-left",
    "---",
  ].join("\n");
  const slides = outline.slides.map(slideMarkdown);

  return {
    markdown: [frontmatter, ...slides].join("\n\n"),
    slideCount: slides.length,
  };
}
