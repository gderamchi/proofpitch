import {
  DeckOutlineSchema,
  type Claim,
  type CreateLaunchPackRequest,
  type DeckMode,
  type DeckOutline,
  type DeckSlideVisual,
  type LaunchScreenshot,
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

function visual(
  kind: DeckSlideVisual["kind"],
  title: string,
  caption?: string,
  screenshot?: LaunchScreenshot,
): DeckSlideVisual {
  return {
    kind,
    title,
    ...(caption ? { caption: compact(caption, 280) } : {}),
    ...(screenshot
      ? {
          url: screenshot.url,
          alt: screenshot.alt,
        }
      : {}),
  };
}

function screenshotForSlide(screenshots: LaunchScreenshot[], index = 0) {
  return screenshots[index] ?? screenshots[0];
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
  screenshots = [],
}: {
  input: DeckSpecInput;
  pitchPack: PitchPack;
  acceptedClaimIds: string[];
  screenshots?: LaunchScreenshot[];
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
        visual: visual("statement", "Proof-backed story", mode.outcome, screenshotForSlide(screenshots)),
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
        visual: visual("statement", "Audience focus", `${input.targetAudience} -> ${input.launchGoal}`),
      },
      {
        id: "problem",
        title: "Problem",
        layout: "section",
        body: compact(pitchPack.problem),
        claimIds: [],
        notes: "Keep the problem specific and avoid adding unsupported market claims.",
        visual: visual("statement", "Pain lens", "Frame the gap before showing the product workflow."),
      },
      {
        id: "solution",
        title: "Solution",
        layout: "two_column",
        body: [`What changes:\n${compact(pitchPack.solution, 420)}`, `Why now:\n${compact(pitchPack.whyNow, 420)}`].join("\n\n"),
        claimIds: [],
        notes: "Connect the solution to the timing without inventing traction metrics.",
        visual: visual("workflow", "Before -> after", "Connect the product change to the timing of the launch."),
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
        visual: visual("claim_stack", "Accepted evidence", `${safeAcceptedClaimIds.length} claim${safeAcceptedClaimIds.length === 1 ? "" : "s"} cleared for deck use.`),
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
        visual: visual("screenshot", screenshotForSlide(screenshots, 1)?.title ?? "Product surface", "Use captured product screens when the worker can capture them; otherwise keep the URL reference visible.", screenshotForSlide(screenshots, 1)),
      },
      {
        id: "risks",
        title: "Risks To Avoid",
        layout: "risks",
        body: bulletList(pitchPack.risks.slice(0, 4)),
        claimIds: [],
        notes: "Use this slide to prevent overclaiming before the deck is shared externally.",
        visual: visual("risk_stack", "Guardrails", "Do not ship unsupported metrics or vague market claims."),
      },
      {
        id: "next-steps",
        title: "Next Steps",
        layout: "closing",
        body: bulletList([...pitchPack.nextSteps.slice(0, 3), mode.close]),
        claimIds: [],
        notes: "Close with a concrete next action tied to the selected deck mode.",
        visual: visual("checklist", "Share-ready path", "Review, render, and download the final PDF."),
      },
    ],
  });
}

function escapeSlidevText(value: string) {
  return value.replace(/---/g, "- - -").trim();
}

function escapeSlidevHtml(value: string) {
  return escapeSlidevText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const visual = slide.visual
    ? [
        "",
        `<div class="text-xs uppercase tracking-wide opacity-70">${escapeSlidevHtml(slide.visual.kind.replaceAll("_", " "))}</div>`,
        `<div class="mt-1 text-lg font-semibold">${escapeSlidevHtml(slide.visual.title)}</div>`,
        slide.visual.caption ? `<div class="mt-1 text-sm opacity-70">${escapeSlidevHtml(slide.visual.caption)}</div>` : "",
        slide.visual.url ? `<div class="mt-2 text-xs opacity-60">${escapeSlidevHtml(slide.visual.url)}</div>` : "",
      ].filter(Boolean).join("\n")
    : "";

  return [frontmatter, "", heading, "", escapeSlidevText(slide.body), visual, "", notes].join("\n");
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
