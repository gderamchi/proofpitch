import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { captureWebsiteScreenshots } from "./demo-video-capture";
import type { DemoVideo, PitchDeck, RemotionRenderProps } from "./schemas";

type RenderReleaseArtifactsInput = {
  launchPackId: string;
  pitchDeck: PitchDeck;
  demoVideo: DemoVideo;
  captureSite?: boolean;
  dryRun?: boolean;
  force?: boolean;
  renderDeck?: boolean;
  renderVideo?: boolean;
};

type RenderArtifact = {
  type: "deck" | "video";
  format: "pdf" | "png" | "mp4";
  status: "pending" | "ready" | "failed";
  path: string;
  error?: string;
};

type RenderReleaseArtifactsResult = {
  enabled: boolean;
  outputDir?: string;
  commands: string[];
  artifacts: RenderArtifact[];
  error?: string;
  videoUrl?: string;
};

export function outputDirForLaunchPack(launchPackId: string) {
  return path.join(process.cwd(), ".proofpitch", "release-assets", launchPackId);
}

export function renderedDemoVideoPath(launchPackId: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "demo-video.mp4");
}

export function renderedDemoVideoUrl(launchPackId: string) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/video`;
}

function commandLine(command: string, args: string[]) {
  return [command, ...args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg))].join(" ");
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      shell: false,
      env: process.env,
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function withCapturedScreenshots(
  launchPackId: string,
  outputDir: string,
  renderProps: RemotionRenderProps,
  captureSite: boolean,
) {
  if (!captureSite) {
    return renderProps;
  }

  const capture = await captureWebsiteScreenshots({
    outputDir: path.join(outputDir, "captures"),
    pathInstructions: renderProps.demoPath,
    productName: renderProps.productName,
    sourceUrl: renderProps.sourceUrl,
  });

  return {
    ...renderProps,
    screenshots: capture.screenshots,
    demoSteps: capture.steps.length ? capture.steps : renderProps.demoSteps,
    captions: [
      ...renderProps.captions,
      `Captured ${capture.screenshots.length} screen${capture.screenshots.length === 1 ? "" : "s"} for ${launchPackId}.`,
    ].slice(0, 5),
  };
}

export async function renderReleaseArtifacts({
  launchPackId,
  pitchDeck,
  demoVideo,
  captureSite = true,
  dryRun = false,
  force = false,
  renderDeck = true,
  renderVideo = true,
}: RenderReleaseArtifactsInput): Promise<RenderReleaseArtifactsResult> {
  if (!force && process.env.PROOFPITCH_ENABLE_LOCAL_RENDER !== "1") {
    return {
      enabled: false,
      commands: [],
      artifacts: [],
    };
  }

  const outputDir = outputDirForLaunchPack(launchPackId);
  const deckPath = path.join(outputDir, "pitch-deck.md");
  const deckPdfPath = path.join(outputDir, "pitch-deck.pdf");
  const deckPngPath = path.join(outputDir, "pitch-deck.png");
  const propsPath = path.join(outputDir, "remotion-props.json");
  const videoPath = renderedDemoVideoPath(launchPackId);
  const shouldRenderDeck = renderDeck;
  const shouldRenderVideo = renderVideo && Boolean(demoVideo.renderProps) && !demoVideo.url;
  const slidevPdfArgs = ["@slidev/cli", "export", deckPath, "--format", "pdf", "--output", deckPdfPath];
  const slidevPngArgs = ["@slidev/cli", "export", deckPath, "--format", "png", "--output", deckPngPath];
  const remotionArgs = [
    "remotion",
    "render",
    "remotion/index.tsx",
    demoVideo.compositionId || "ProofPitchProductDemo",
    videoPath,
    "--props",
    propsPath,
    "--codec",
    "h264",
    "--overwrite",
  ];
  const commands = [
    ...(shouldRenderDeck ? [commandLine("npx", slidevPdfArgs), commandLine("npx", slidevPngArgs)] : []),
    ...(shouldRenderVideo ? [commandLine("npx", remotionArgs)] : []),
  ];
  const artifacts: RenderArtifact[] = [
    ...(shouldRenderDeck
      ? [
          {
            type: "deck" as const,
            format: "pdf" as const,
            status: "pending" as const,
            path: deckPdfPath,
          },
          {
            type: "deck" as const,
            format: "png" as const,
            status: "pending" as const,
            path: deckPngPath,
          },
        ]
      : []),
    ...(shouldRenderVideo
      ? [
          {
            type: "video" as const,
            format: "mp4" as const,
            status: "pending" as const,
            path: videoPath,
          },
        ]
      : []),
  ];

  if (dryRun) {
    return {
      enabled: true,
      outputDir,
      commands,
      artifacts,
      videoUrl: shouldRenderVideo ? renderedDemoVideoUrl(launchPackId) : undefined,
    };
  }

  try {
    await mkdir(outputDir, { recursive: true });

    if (shouldRenderDeck) {
      await writeFile(deckPath, pitchDeck.markdown, "utf8");
    }

    if (shouldRenderVideo) {
      const renderProps = await withCapturedScreenshots(
        launchPackId,
        outputDir,
        demoVideo.renderProps as RemotionRenderProps,
        captureSite,
      );

      await writeFile(propsPath, JSON.stringify(renderProps, null, 2), "utf8");
    }

    if (shouldRenderDeck) {
      await runCommand("npx", slidevPdfArgs);
      artifacts[0] = {
        ...artifacts[0],
        status: "ready",
      };

      await runCommand("npx", slidevPngArgs);
      artifacts[1] = {
        ...artifacts[1],
        status: "ready",
      };
    }

    if (shouldRenderVideo) {
      await runCommand("npx", remotionArgs);
      const videoArtifactIndex = artifacts.findIndex((artifact) => artifact.type === "video");
      artifacts[videoArtifactIndex] = {
        ...artifacts[videoArtifactIndex],
        status: "ready",
      };
    }

    return {
      enabled: true,
      outputDir,
      commands,
      artifacts,
      videoUrl: shouldRenderVideo ? renderedDemoVideoUrl(launchPackId) : undefined,
    };
  } catch (error) {
    return {
      enabled: true,
      outputDir,
      commands,
      artifacts,
      error: error instanceof Error ? error.message : "Release renderer failed.",
    };
  }
}
