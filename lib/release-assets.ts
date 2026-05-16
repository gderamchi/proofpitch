import {
  DemoVideoSchema,
  PitchDeckSchema,
  type CreateLaunchPackRequest,
  type DeckOutline,
  type DemoVideo,
  type LaunchScreenshot,
  type PitchDeck,
  type PitchPack,
  type RemotionRenderProps,
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

const REMOTION_COMPOSITION_ID = "ProofPitchProductDemo";

export function buildSlidevMarkdown(input: ReleaseInput, pitchPack: PitchPack, acceptedClaimIds: string[]) {
  const outline = buildDeckSpec({ input, pitchPack, acceptedClaimIds });

  return buildSlidevMarkdownFromDeckSpec({ input, pitchPack, outline });
}

export function buildApprovedPitchDeck({
  input,
  pitchPack,
  acceptedClaimIds,
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  acceptedClaimIds: string[];
}) {
  const outline = buildDeckSpec({ input, pitchPack, acceptedClaimIds });
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

function createRenderProps({
  input,
  pitchPack,
  screenshots,
}: {
  input: ReleaseInput;
  pitchPack: PitchPack;
  screenshots: LaunchScreenshot[];
}): RemotionRenderProps {
  return {
    productName: input.productName,
    oneLiner: pitchPack.oneLiner,
    sourceUrl: input.sourceUrl,
    screenshots: screenshots.map((screenshot) => ({
      title: screenshot.title,
      url: screenshot.url,
      alt: screenshot.alt,
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
  const renderProps = createRenderProps({ input, pitchPack, screenshots });

  if (captureVideoUrl) {
    return DemoVideoSchema.parse({
      status: "ready",
      url: captureVideoUrl,
      uploadStatus: "uploaded",
      durationSeconds: 60,
      renderer: "remotion",
      compositionId: REMOTION_COMPOSITION_ID,
      renderProps,
    });
  }

  return DemoVideoSchema.parse({
    status: "pending",
    uploadStatus: "blocked_by_provider_review",
    durationSeconds: 0,
    renderer: "remotion",
    compositionId: REMOTION_COMPOSITION_ID,
    renderProps,
    error:
      "Product demo video requires Playwright capture. Set PROOFPITCH_PLAYWRIGHT_CAPTURE=1 in a worker that can record the product workflow.",
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
