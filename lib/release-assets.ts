import {
  DemoVideoSchema,
  PitchDeckSchema,
  type CreateLaunchPackRequest,
  type DeckOutline,
  type DemoVideo,
  type HyperFramesRenderSpec,
  type LaunchScreenshot,
  type PitchDeck,
  type PitchPack,
} from "./schemas";
import {
  buildDeckSpec,
  buildPendingDeckOutline,
  buildSlidevMarkdownFromDeckSpec,
} from "./deck-spec";

type ReleaseInput = CreateLaunchPackRequest;

export type ReleaseAssets = {
  pitchDeck: PitchDeck;
  demoVideo: DemoVideo;
  releaseChecklist: string[];
};

const HYPERFRAMES_COMPOSITION_ID = "proofpitch-product-demo";

export function buildSlidevMarkdown(
  input: ReleaseInput,
  pitchPack: PitchPack,
  acceptedClaimIds: string[],
  screenshots: LaunchScreenshot[] = [],
) {
  const outline = buildDeckSpec({ input, pitchPack, acceptedClaimIds, screenshots });

  return buildSlidevMarkdownFromDeckSpec({ input, pitchPack, outline });
}

export function buildApprovedPitchDeck({
  input,
  pitchPack,
  acceptedClaimIds,
  screenshots = [],
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  acceptedClaimIds: string[];
  screenshots?: LaunchScreenshot[];
}) {
  const outline = buildDeckSpec({ input, pitchPack, acceptedClaimIds, screenshots });
  const { markdown, slideCount } = buildSlidevMarkdownFromDeckSpec({ input, pitchPack, outline });

  return PitchDeckSchema.parse({
    status: "ready",
    format: "slidev",
    title: `${input.productName} release deck`,
    slideCount,
    markdown,
    deckMode: input.deckMode,
    outline,
    renderState: "queued",
    exports: [
      {
        format: "pdf",
        status: "pending",
      },
    ],
  });
}

export function buildPendingPitchDeck(input: ReleaseInput, outline?: DeckOutline) {
  return PitchDeckSchema.parse({
    status: "pending",
    format: "slidev",
    title: `${input.productName} release deck`,
    slideCount: 0,
    markdown: "",
    deckMode: input.deckMode,
    outline: outline ?? buildPendingDeckOutline(input),
    renderState: "queued",
    exports: [
      {
        format: "pdf",
        status: "pending",
      },
    ],
  });
}

function createRenderSpec({
  input,
  pitchPack,
  screenshots,
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  screenshots: LaunchScreenshot[];
}): HyperFramesRenderSpec {
  return {
    productName: input.productName,
    oneLiner: pitchPack.oneLiner,
    sourceUrl: input.sourceUrl,
    demoPath: input.demoInstructions,
    screenshots: screenshots.map((screenshot) => ({
      action: "capture",
      title: screenshot.title,
      url: screenshot.url,
      alt: screenshot.alt,
      target: screenshot.title,
    })),
    demoSteps: [
      `Open ${input.productName} at ${input.sourceUrl}.`,
      input.demoInstructions || "Show the first meaningful public product workflow.",
      ...pitchPack.liveDemoSteps.slice(0, 3),
    ],
    captions: [
      `${input.productName}: ${pitchPack.oneLiner}`,
      "Product demo and pitch deck are separate assets.",
      "Unsupported claims stay visible before publishing.",
    ],
    designNotes:
      "Use ProofPitch's pale green workspace canvas, square bordered panels, dense founder-tool UI, and restrained teal emphasis.",
    researchSummary: "Initial launch-pack context only. The render worker can enrich this before writing the composition.",
  };
}

function buildDemoVideo({
  input,
  pitchPack,
  screenshots,
  captureVideoUrl,
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  screenshots: LaunchScreenshot[];
  captureVideoUrl?: string;
}) {
  const renderSpec = createRenderSpec({ input, pitchPack, screenshots });

  if (captureVideoUrl) {
    return DemoVideoSchema.parse({
      status: "ready",
      url: captureVideoUrl,
      uploadStatus: "uploaded",
      durationSeconds: 60,
      renderer: "hyperframes",
      compositionId: HYPERFRAMES_COMPOSITION_ID,
      renderSpec,
    });
  }

  return DemoVideoSchema.parse({
    status: "pending",
    uploadStatus: "blocked_by_provider_review",
    durationSeconds: 0,
    renderer: "hyperframes",
    compositionId: HYPERFRAMES_COMPOSITION_ID,
    renderSpec,
    error:
      "Demo video is ready to render. Use the HyperFrames render action to capture the site and assemble the MP4.",
  });
}

export async function buildReleaseAssets({
  input,
  pitchPack,
  screenshots,
  captureVideoUrl,
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  screenshots: LaunchScreenshot[];
  captureVideoUrl?: string;
}): Promise<ReleaseAssets> {
  return {
    pitchDeck: buildPendingPitchDeck(input),
    demoVideo: buildDemoVideo({ input, pitchPack, screenshots, captureVideoUrl }),
    releaseChecklist: [
      "Review the product demo capture before external use.",
      "Approve the claim ledger before generating the Slidev pitch deck outline.",
      "Review the Slidev PDF separately from the product demo video.",
      "Remove unsupported claims before sharing the pack.",
    ],
  };
}
