import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DemoVideo, PitchDeck } from "./schemas";

type RenderReleaseArtifactsInput = {
  launchPackId: string;
  pitchDeck: PitchDeck;
  demoVideo: DemoVideo;
  dryRun?: boolean;
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
};

function outputDirForLaunchPack(launchPackId: string) {
  return path.join(process.cwd(), ".proofpitch", "release-assets", launchPackId);
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

export async function renderReleaseArtifacts({
  launchPackId,
  pitchDeck,
  demoVideo,
  dryRun = false,
}: RenderReleaseArtifactsInput): Promise<RenderReleaseArtifactsResult> {
  if (process.env.PROOFPITCH_ENABLE_LOCAL_RENDER !== "1") {
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
  const videoPath = path.join(outputDir, "demo-video.mp4");
  const shouldRenderVideo = demoVideo.status === "ready" && Boolean(demoVideo.renderProps) && !demoVideo.url;
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
  ];
  const commands = [
    commandLine("npx", slidevPdfArgs),
    commandLine("npx", slidevPngArgs),
    ...(shouldRenderVideo ? [commandLine("npx", remotionArgs)] : []),
  ];
  const artifacts: RenderArtifact[] = [
    {
      type: "deck",
      format: "pdf",
      status: "pending",
      path: deckPdfPath,
    },
    {
      type: "deck",
      format: "png",
      status: "pending",
      path: deckPngPath,
    },
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
    };
  }

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(deckPath, pitchDeck.markdown, "utf8");
    if (shouldRenderVideo) {
      await writeFile(propsPath, JSON.stringify(demoVideo.renderProps ?? {}, null, 2), "utf8");
    }

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

    if (shouldRenderVideo) {
      await runCommand("npx", remotionArgs);
      artifacts[2] = {
        ...artifacts[2],
        status: "ready",
      };
    }

    return {
      enabled: true,
      outputDir,
      commands,
      artifacts,
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
