import { SocialDraftsSchema, type Claim, type LaunchPack, type SocialDraftStatus } from "./schemas";

type SocialDraftInput = Pick<
  LaunchPack,
  | "sourceUrl"
  | "productName"
  | "targetAudience"
  | "launchGoal"
  | "claimReview"
  | "demoVideo"
  | "pitchDeck"
  | "pitchPack"
>;

const X_COMPOSER_URL = "https://x.com/intent/tweet";
const LINKEDIN_COMPOSER_URL = "https://www.linkedin.com/feed/";
const PRODUCT_HUNT_SUBMIT_URL = "https://www.producthunt.com/posts/new";

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limitText(value: string, maxLength: number) {
  const normalized = normalizeSpace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
}

function paragraphs(lines: string[]) {
  return lines.map(normalizeSpace).filter(Boolean).join("\n\n");
}

function eligibleClaims(input: SocialDraftInput) {
  const accepted = new Set(input.claimReview.acceptedClaimIds);
  const acceptedOnly = accepted.size > 0;

  return input.pitchPack.claims.filter((claim) => {
    if (claim.status === "unsupported") {
      return false;
    }

    return !acceptedOnly || accepted.has(claim.id);
  });
}

function firstProofLine(claims: Claim[], fallback: string) {
  return claims[0]?.text ?? fallback;
}

function productHashtag(productName: string) {
  const compact = productName.replace(/[^a-zA-Z0-9]/g, "");

  return compact ? `#${compact.slice(0, 36)}` : "#Launch";
}

function uniqueItems<T>(items: T[]) {
  return [...new Set(items)];
}

function deckAsset(input: SocialDraftInput) {
  const pdf = input.pitchDeck.exports.find((item) => item.format === "pdf");
  const url = pdf?.signedUrl ?? pdf?.path;
  const ready = pdf?.status === "ready" && Boolean(url);

  return {
    status: ready ? "ready" as const : pdf?.status === "failed" ? "failed" as const : "pending" as const,
    url,
    format: "pdf" as const,
    usageByPlatform: {
      x: ready
        ? "Use the PDF as a follow-up asset after the post; X Web Intent cannot attach it automatically."
        : "Render the PDF before treating the deck as ready for launch follow-up.",
      linkedin: ready
        ? "Attach the PDF manually as a LinkedIn document or link it in the comments."
        : "Render the PDF before attaching the pitch deck to LinkedIn.",
      productHunt: ready
        ? "Keep the deck as a maker follow-up asset; Product Hunt gallery should focus on product media."
        : "Render the deck before using it as a follow-up asset for Product Hunt conversations.",
    },
  };
}

function videoAsset(input: SocialDraftInput) {
  const ready = input.demoVideo.status === "ready" && Boolean(input.demoVideo.url);

  return {
    status: input.demoVideo.status,
    url: input.demoVideo.url,
    format: "mp4" as const,
    usageByPlatform: {
      x: ready
        ? "Attach this MP4 manually after opening the X composer; Web Intent cannot attach video files."
        : "Render the demo video before opening the X composer.",
      linkedin: ready
        ? "Attach this MP4 manually in the LinkedIn composer before posting."
        : "Render the demo video before preparing the LinkedIn post.",
      productHunt: ready
        ? "Upload or publish the MP4 to YouTube first, then use the YouTube URL in Product Hunt."
        : "Render the demo video before preparing the Product Hunt media checklist.",
    },
  };
}

function platformStatus(input: SocialDraftInput, manualWhenReady = false): SocialDraftStatus {
  const videoReady = input.demoVideo.status === "ready" && Boolean(input.demoVideo.url);
  const deckReady = deckAsset(input).status === "ready";

  if (!videoReady) {
    return "needs_video";
  }

  if (!deckReady) {
    return "needs_deck";
  }

  return manualWhenReady ? "manual_step" : "ready";
}

function buildXDraft(input: SocialDraftInput) {
  const claims = eligibleClaims(input);
  const hashtags = uniqueItems([
    productHashtag(input.productName),
    "#ProductDemo",
    "#PitchDeck",
  ]);
  const videoReady = input.demoVideo.status === "ready" && Boolean(input.demoVideo.url);
  const deckReady = deckAsset(input).status === "ready";
  const assetLine = `${videoReady ? "Demo video attached" : "Demo video queued"}; ${deckReady ? "deck ready" : "deck PDF queued"}.`;
  const post = limitText(
    `${input.productName}: ${input.pitchPack.oneLiner}\n\n${assetLine}\n\n${hashtags.join(" ")}`,
    280,
  );
  const thread = [
    limitText(`Proof angle: ${firstProofLine(claims, input.pitchPack.solution)}`, 280),
    limitText(`Launch goal: ${input.launchGoal}. Video and deck stay separate so the demo can lead and the deck can follow.`, 280),
  ];
  const intent = new URL(X_COMPOSER_URL);
  intent.searchParams.set("text", post);
  intent.searchParams.set("url", input.sourceUrl);

  return {
    platform: "x" as const,
    status: platformStatus(input),
    post,
    thread,
    hashtags,
    cta: "Open the product, attach the MP4 manually, then post.",
    composerUrl: intent.toString(),
    videoNote: videoAsset(input).usageByPlatform.x,
    deckNote: deckAsset(input).usageByPlatform.x,
  };
}

function buildLinkedInDraft(input: SocialDraftInput) {
  const claims = eligibleClaims(input);
  const video = videoAsset(input);
  const deck = deckAsset(input);
  const hook = limitText(`We turned ${input.productName} into a launch-ready demo video and pitch deck.`, 240);
  const body = paragraphs([
    `The useful part is not just the copy. The pack separates the product demo video from the pitch deck, then keeps the claim ledger visible before anything is shared externally.`,
    `For ${input.targetAudience}, the launch story is: ${input.pitchPack.oneLiner}`,
    `Proof to keep in the narrative: ${firstProofLine(claims, input.pitchPack.solution)}`,
    video.url
      ? `Video asset: attach the rendered MP4 from ProofPitch before publishing.`
      : "Video asset: render the MP4 before publishing this draft.",
    deck.url
      ? `Pitch deck: attach the PDF manually or use it as the follow-up asset after the post.`
      : "Pitch deck: render the PDF before using it as the follow-up asset.",
  ]);
  const cta = `Open ${input.productName}, watch the demo, and use the deck for the deeper follow-up.`;

  return {
    platform: "linkedin" as const,
    status: platformStatus(input),
    hook,
    body,
    cta,
    post: paragraphs([hook, body, cta]),
    composerUrl: LINKEDIN_COMPOSER_URL,
    videoNote: video.usageByPlatform.linkedin,
    deckNote: deck.usageByPlatform.linkedin,
  };
}

function buildProductHuntDraft(input: SocialDraftInput) {
  const claims = eligibleClaims(input);
  const video = videoAsset(input);
  const deck = deckAsset(input);
  const tagline = limitText(input.pitchPack.oneLiner, 60);
  const description = limitText(
    `${input.productName} helps ${input.targetAudience} prepare a proof-backed launch pack: a real product demo video, a separate pitch deck, and a visible claim ledger before sharing.`,
    500,
  );
  const firstComment = paragraphs([
    `Hi Product Hunt, I am launching ${input.productName}.`,
    input.pitchPack.oneLiner,
    `The workflow produces a demo video first, then a separate pitch deck for deeper follow-up. The point is to avoid shipping unsupported launch claims: ${firstProofLine(claims, input.pitchPack.solution)}`,
    video.url
      ? "For the Product Hunt video slot, publish the rendered MP4 to YouTube first and add the YouTube URL."
      : "Before submission, render the MP4 demo video and publish it to YouTube for the Product Hunt video slot.",
    deck.url
      ? "The PDF deck is ready as a follow-up asset for people who want the fuller story."
      : "Render the PDF deck before launch day so it is ready as a follow-up asset.",
    "I would value feedback on the product story, the demo path, and whether the claim ledger makes the launch feel more trustworthy.",
  ]);

  return {
    platform: "product_hunt" as const,
    status: platformStatus(input, true),
    productName: limitText(input.productName, 80),
    tagline,
    description,
    firstComment,
    makerNote: limitText(
      `${input.productName} should be submitted from a personal Product Hunt account. Keep the demo video and deck ready before scheduling or launching.`,
      500,
    ),
    launchTags: ["Marketing", "Productivity", "SaaS"],
    mediaChecklist: [
      "Add a square thumbnail or logo.",
      "Add at least two gallery images that show the product in action.",
      video.url
        ? "Publish the rendered MP4 to YouTube and paste that YouTube URL into Product Hunt."
        : "Render the MP4 demo video, publish it to YouTube, then paste that YouTube URL into Product Hunt.",
      deck.url
        ? "Keep the rendered PDF deck ready for replies and follow-up."
        : "Render the PDF deck before using it in replies and follow-up.",
    ],
    videoNote: video.usageByPlatform.productHunt,
    submitUrl: PRODUCT_HUNT_SUBMIT_URL,
  };
}

export function buildSocialDrafts(input: SocialDraftInput) {
  const video = videoAsset(input);
  const deck = deckAsset(input);

  return SocialDraftsSchema.parse({
    generatedAt: new Date().toISOString(),
    assets: {
      productUrl: input.sourceUrl,
      video,
      deck,
    },
    x: buildXDraft(input),
    linkedin: buildLinkedInDraft(input),
    productHunt: buildProductHuntDraft(input),
  });
}
