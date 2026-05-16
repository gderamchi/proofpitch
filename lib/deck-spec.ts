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

const SLIDE_BODY_MAX = 1200;

function compact(value: string, max = 650) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 3).trim()}...`;
}

function bulletList(
  items: string[],
  {
    bodyMax = SLIDE_BODY_MAX,
    itemMax = 220,
    overflowLabel,
  }: {
    bodyMax?: number;
    itemMax?: number;
    overflowLabel?: (remaining: number) => string;
  } = {},
) {
  const bullets: string[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const bullet = `- ${compact(items[index], itemMax)}`;
    const next = [...bullets, bullet].join("\n");

    if (next.length <= bodyMax) {
      bullets.push(bullet);
      continue;
    }

    const remaining = items.length - index;
    const overflow = `- ${
      overflowLabel?.(remaining) ?? `${remaining} more item${remaining === 1 ? "" : "s"} kept out of this slide for readability.`
    }`;
    const withOverflow = [...bullets, overflow].join("\n");

    if (bullets.length && withOverflow.length <= bodyMax) {
      bullets.push(overflow);
    } else if (!bullets.length) {
      bullets.push(compact(bullet, bodyMax));
    }

    break;
  }

  return bullets.join("\n");
}

function sourceLabel(claim: Claim) {
  const status = claim.status.replaceAll("_", " ");
  const source = claim.sourceTitle || claim.sourceType;

  return `${claim.text} (${status}; ${source})`;
}

function audienceBuyingMoment(input: DeckSpecInput, pitchPack: PitchPack, mode: (typeof modeCopy)[DeckMode]) {
  return bulletList([
    `Built for ${input.targetAudience.replace(/[.]+$/g, "")}.`,
    `Buying tension: ${compact(pitchPack.problem, 180)}`,
    `Deck job: ${mode.outcome}`,
  ]);
}

function productDemoStory({
  acceptedClaims,
  input,
  pitchPack,
  screenshots,
}: {
  acceptedClaims: Claim[];
  input: DeckSpecInput;
  pitchPack: PitchPack;
  screenshots: LaunchScreenshot[];
}) {
  const screenshot = screenshotForSlide(screenshots, 1);
  const proofMoment = acceptedClaims[0]?.text ?? pitchPack.oneLiner;
  const productSurface = screenshot?.title ? `Use the captured ${screenshot.title} surface as the proof moment.` : undefined;

  return bulletList(
    [
      `Open on the buyer problem: ${compact(pitchPack.problem, 170)}`,
      `Show how ${input.productName} changes the workflow: ${compact(pitchPack.solution, 190)}`,
      `Pause on the proof moment: ${compact(proofMoment, 180)}`,
      productSurface ?? `Close by tying the product outcome back to ${input.targetAudience}.`,
    ].filter((item): item is string => Boolean(item)),
  );
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
        title: "Audience And Buying Moment",
        layout: "section",
        body: audienceBuyingMoment(input, pitchPack, mode),
        claimIds: [],
        notes: "Anchor the deck in the buyer context and the job this deck needs to do.",
        visual: visual("statement", "Audience focus", `${input.targetAudience} buyer case`),
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
          ? bulletList(acceptedClaims.map(sourceLabel), {
              overflowLabel: (remaining) =>
                `${remaining} more accepted claim${remaining === 1 ? "" : "s"} kept in the claim ledger.`,
            })
          : "No claims were accepted for the deck yet. Keep the PDF export gated until at least one claim is approved.",
        claimIds: safeAcceptedClaimIds,
        notes: "Only accepted non-unsupported claims appear here. Rejected and unsupported claims stay out of the deck.",
        visual: visual("claim_stack", "Accepted evidence", `${safeAcceptedClaimIds.length} claim${safeAcceptedClaimIds.length === 1 ? "" : "s"} cleared for deck use.`),
      },
      {
        id: "product-demo",
        title: "Product Demo",
        layout: "demo",
        body: productDemoStory({ acceptedClaims, input, pitchPack, screenshots }),
        claimIds: [],
        notes: "Use this slide to frame the product moment at a high level; the video handles the actual navigation path.",
        visual: visual("screenshot", screenshotForSlide(screenshots, 1)?.title ?? "Product surface", "Anchor the story in the real product surface.", screenshotForSlide(screenshots, 1)),
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
