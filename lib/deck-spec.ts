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

function slideBodyLines(body: string) {
  return body
    .split(/\n+/)
    .flatMap((line) => line.split(/(?= - )/g))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function slidevImageUrl(url?: string) {
  return Boolean(url?.startsWith("data:image/") || url?.match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i));
}

function slidevUrlLabel(url?: string) {
  if (!url) {
    return "product surface";
  }

  try {
    const parsed = new URL(url);

    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^.*\//, "");
  }
}

function slidevStyles() {
  return `<style>
.slidev-layout.proofpitch-slide {
  background: #edf4f1;
  color: #111827;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow: hidden;
  padding: 0 !important;
}
.slidev-layout.proofpitch-slide * {
  box-sizing: border-box;
}
.slidev-layout.proofpitch-slide p {
  margin: 0;
}
.pp-slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
  padding: 34px 40px 30px;
  background: #fffdf7;
}
.pp-slide::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.055;
  background-image: linear-gradient(90deg, #111827 1px, transparent 1px), linear-gradient(#111827 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
}
.pp-cover {
  background: #0f1f1d;
  color: #fffaf0;
}
.pp-section {
  background: #fffdf7;
}
.pp-demo {
  background: #eef8fb;
}
.pp-proof {
  background: #effaf5;
}
.pp-risks {
  background: #fff6df;
}
.pp-top,
.pp-main,
.pp-footer {
  position: relative;
  z-index: 1;
}
.pp-top,
.pp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: rgba(17, 24, 39, 0.58);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pp-cover .pp-top,
.pp-cover .pp-footer {
  color: rgba(255, 250, 240, 0.68);
}
.pp-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.62fr);
  gap: 24px;
  align-items: stretch;
}
.pp-cover .pp-main {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.48fr);
}
.pp-copy {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  overflow: hidden;
}
.pp-kicker {
  color: #0f766e;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pp-cover .pp-kicker {
  color: #99f6e4;
}
.pp-title {
  margin: 0;
  color: inherit;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.98;
}
.pp-cover .pp-title {
  font-size: 56px;
  line-height: 0.92;
}
.pp-lede {
  max-width: 660px;
  color: rgba(255, 250, 240, 0.82);
  display: -webkit-box;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.32;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
.pp-paragraph {
  color: #374151;
  display: -webkit-box;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.28;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 8;
}
.pp-list {
  display: grid;
  gap: 9px;
  min-height: 0;
  overflow: hidden;
}
.pp-item {
  min-height: 0;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  border: 1px solid rgba(17, 24, 39, 0.22);
  background: rgba(255, 255, 255, 0.74);
  padding: 9px 11px;
}
.pp-num {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  background: #111827;
  color: #fffaf0;
  font-size: 11px;
  font-weight: 900;
}
.pp-item p {
  color: #1f2937;
  display: -webkit-box;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.28;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pp-proof .pp-main {
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 18px;
}
.pp-proof .pp-list {
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.pp-proof .pp-item {
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 7px;
  padding: 7px 8px;
}
.pp-proof .pp-num {
  width: 22px;
  height: 22px;
  font-size: 9px;
}
.pp-proof .pp-item p {
  font-size: 11px;
  line-height: 1.22;
  -webkit-line-clamp: 3;
}
.pp-risks .pp-item {
  border-left: 5px solid #b45309;
  background: rgba(255, 255, 255, 0.78);
}
.pp-visual {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid rgba(17, 24, 39, 0.9);
  background: #ffffff;
  box-shadow: 8px 8px 0 rgba(17, 24, 39, 0.13);
}
.pp-cover .pp-visual {
  border-color: rgba(255, 250, 240, 0.3);
  background: rgba(255, 250, 240, 0.08);
  box-shadow: none;
}
.pp-browser-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.18);
  background: #f1f5f9;
  padding: 0 12px;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
}
.pp-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}
.pp-red { background: #f87171; }
.pp-amber { background: #fbbf24; }
.pp-green { background: #10b981; }
.pp-visual-body {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 10px;
  align-content: center;
  padding: 18px;
}
.pp-visual-kind {
  color: #0f766e;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pp-visual-title {
  color: inherit;
  display: -webkit-box;
  font-size: 23px;
  font-weight: 800;
  line-height: 1.05;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.pp-visual-caption {
  color: #475569;
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.35;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.pp-screenshot {
  flex: 1;
  min-height: 0;
  background: #eef4f1;
}
.pp-screenshot img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pp-footer {
  border-top: 1px solid rgba(17, 24, 39, 0.18);
  padding-top: 12px;
}
.pp-cover .pp-footer {
  border-top-color: rgba(255, 250, 240, 0.18);
}
</style>`;
}

function slideClass(layout: DeckOutline["slides"][number]["layout"]) {
  return `proofpitch-slide proofpitch-${layout.replaceAll("_", "-")}`;
}

function visualMarkup(slide: DeckOutline["slides"][number]) {
  const visual = slide.visual;

  if (!visual) {
    return "";
  }

  const kind = escapeSlidevHtml(visual.kind.replaceAll("_", " "));
  const title = escapeSlidevHtml(visual.title);
  const caption = visual.caption ? escapeSlidevHtml(visual.caption) : "";
  const urlLabel = escapeSlidevHtml(slidevUrlLabel(visual.url));

  if (visual.url && slidevImageUrl(visual.url)) {
    return `<aside class="pp-visual">
  <div class="pp-browser-bar"><span class="pp-dot pp-red"></span><span class="pp-dot pp-amber"></span><span class="pp-dot pp-green"></span><span>${urlLabel}</span></div>
  <div class="pp-screenshot"><img src="${escapeSlidevHtml(visual.url)}" alt="${escapeSlidevHtml(visual.alt ?? visual.title)}" /></div>
</aside>`;
  }

  return `<aside class="pp-visual">
  <div class="pp-visual-body">
    <div class="pp-visual-kind">${kind}</div>
    <div class="pp-visual-title">${title}</div>
    ${caption ? `<div class="pp-visual-caption">${caption}</div>` : ""}
    ${visual.url ? `<div class="pp-visual-caption">${urlLabel}</div>` : ""}
  </div>
</aside>`;
}

function bodyMarkup(slide: DeckOutline["slides"][number]) {
  const lines = slideBodyLines(slide.body);
  const isBulletBody = slide.body.trim().startsWith("-");

  if (!lines.length) {
    return "";
  }

  if (!isBulletBody && lines.length <= 2) {
    return `<p class="pp-paragraph">${escapeSlidevHtml(lines.join(" "))}</p>`;
  }

  const limit = slide.layout === "proof" ? 10 : slide.layout === "risks" ? 4 : slide.layout === "cover" ? 1 : 4;
  const items = lines.slice(0, limit).map((line, index) => {
    const number = String(index + 1).padStart(2, "0");

    return `<div class="pp-item"><span class="pp-num">${number}</span><p>${escapeSlidevHtml(line)}</p></div>`;
  });

  return `<div class="pp-list">${items.join("\n")}</div>`;
}

function slideMarkdown(
  slide: DeckOutline["slides"][number],
  index: number,
  total: number,
  input: DeckSpecInput,
  deckMode: DeckMode,
) {
  const classes = slideClass(slide.layout);
  const frontmatter = index === 0 ? "" : ["---", "layout: default", `class: "${classes}"`, "---"].join("\n");
  const notes = ["<!--", escapeSlidevText(slide.notes), "-->"].join("\n");
  const layoutClass = `pp-slide pp-${slide.layout.replaceAll("_", "-")}`;
  const label = `${modeCopy[deckMode].label} deck`;
  const count = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const visual = visualMarkup(slide);
  const titleTag = index === 0 ? "h1" : "h2";
  const body = slide.layout === "cover"
    ? `<p class="pp-lede">${escapeSlidevHtml(slideBodyLines(slide.body).join(" "))}</p>`
    : bodyMarkup(slide);
  const content = `${slidevStyles()}
<section class="${layoutClass}">
  <div class="pp-top"><span>${escapeSlidevHtml(label)}</span><span>${count}</span></div>
  <div class="pp-main">
    <div class="pp-copy">
      <div class="pp-kicker">${escapeSlidevHtml(slide.layout.replaceAll("_", " "))}</div>
      <${titleTag} class="pp-title">${escapeSlidevHtml(slide.title)}</${titleTag}>
      ${body}
    </div>
    ${visual}
  </div>
  <div class="pp-footer"><span>${escapeSlidevHtml(input.productName)}</span><span>ProofPitch</span></div>
</section>`;

  return index === 0 ? [content, "", notes].join("\n") : [frontmatter, "", content, "", notes].join("\n");
}

export function buildSlidevMarkdownFromDeckSpec({
  input,
  outline,
}: {
  input: DeckSpecInput;
  outline: DeckOutline;
  pitchPack: PitchPack;
}) {
  const firstSlideClass = outline.slides[0] ? slideClass(outline.slides[0].layout) : "proofpitch-slide";
  const frontmatter = [
    "---",
    "theme: default",
    "layout: default",
    `class: "${firstSlideClass}"`,
    `title: ${JSON.stringify(`${input.productName} ${modeCopy[outline.deckMode].label.toLowerCase()} deck`)}`,
    "info: Release deck generated by ProofPitch",
    "drawings:",
    "  persist: false",
    "transition: slide-left",
    "---",
  ].join("\n");
  const slides = outline.slides.map((slide, index) =>
    slideMarkdown(slide, index, outline.slides.length, input, outline.deckMode),
  );

  return {
    markdown: [frontmatter, ...slides].join("\n\n"),
    slideCount: slides.length,
  };
}
