import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { captureWebsiteScreenshots } from "./demo-video-capture";
import type { DemoVideo, PitchDeck, ProductDemoScreenshot, RemotionRenderProps } from "./schemas";

type RenderReleaseArtifactsInput = {
  launchPackId: string;
  pitchDeck: PitchDeck;
  demoVideo: DemoVideo;
  captureSite?: boolean;
  baseUrl?: string;
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
  const outputRoot = process.env.PROOFPITCH_OUTPUT_DIR ?? (process.env.VERCEL ? os.tmpdir() : process.cwd());

  return path.join(outputRoot, ".proofpitch", "release-assets", launchPackId);
}

export function renderedDemoVideoPath(launchPackId: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "demo-video.mp4");
}

export function renderedDemoVideoUrl(launchPackId: string) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/video`;
}

export function renderedBrowserRecordingPath(launchPackId: string) {
  return path.join(outputDirForLaunchPack(launchPackId), "browser-recording.webm");
}

export function renderedBrowserRecordingUrl(launchPackId: string) {
  return `/api/launch-packs/${encodeURIComponent(launchPackId)}/recording`;
}

function absoluteUrl(baseUrl: string | undefined, urlPath: string) {
  return new URL(urlPath, baseUrl || "http://localhost:3000").toString();
}

function commandLine(command: string, args: string[]) {
  return [command, ...args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg))].join(" ");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function placeholderScreenshotDataUrl(title: string, reason: string) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000" viewBox="0 0 1440 1000">`,
    `<rect width="1440" height="1000" fill="#f4efe6"/>`,
    `<rect x="48" y="48" width="1344" height="904" fill="#fffaf0" stroke="#111827" stroke-width="3"/>`,
    `<rect x="96" y="292" width="560" height="52" fill="#111827"/>`,
    `<rect x="96" y="376" width="780" height="34" fill="#334155"/>`,
    `<rect x="96" y="440" width="680" height="34" fill="#64748b"/>`,
    `<rect x="96" y="540" width="1120" height="260" fill="#e2e8f0" stroke="#111827" stroke-width="2"/>`,
    `<text x="96" y="170" font-family="Georgia,serif" font-size="62" font-weight="700" fill="#111827">${escapeXml(title).slice(0, 80)}</text>`,
    `<text x="96" y="238" font-family="Arial,sans-serif" font-size="26" fill="#475569">${escapeXml(reason).slice(0, 130)}</text>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function fallbackScreenshots(renderProps: RemotionRenderProps, reason: string): ProductDemoScreenshot[] {
  const screenshots = renderProps.screenshots.length
    ? renderProps.screenshots
    : [
        {
          action: "open" as const,
          title: `${renderProps.productName} product entry`,
          url: renderProps.sourceUrl,
          alt: `${renderProps.productName} product entry`,
        },
      ];

  return screenshots.slice(0, 4).map((screenshot, index) => ({
    ...screenshot,
    action: screenshot.action ?? (index === 0 ? "open" : "scroll"),
    alt: screenshot.alt || `${renderProps.productName} demo step ${index + 1}`,
    target: screenshot.target ?? screenshot.title,
    url: placeholderScreenshotDataUrl(screenshot.title, reason),
  }));
}

async function runCommand(command: string, args: string[]) {
  const writableNpmEnv = process.env.VERCEL
    ? {
        HOME: os.tmpdir(),
        npm_config_audit: "false",
        npm_config_cache: path.join(os.tmpdir(), ".npm"),
        npm_config_fund: "false",
        npm_config_update_notifier: "false",
      }
    : {};

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      shell: false,
      env: {
        ...process.env,
        ...writableNpmEnv,
      },
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
  baseUrl?: string,
) {
  if (!captureSite) {
    return renderProps;
  }

  let capture: Awaited<ReturnType<typeof captureWebsiteScreenshots>>;

  try {
    capture = await captureWebsiteScreenshots({
      outputDir: path.join(outputDir, "captures"),
      pathInstructions: renderProps.demoPath,
      productName: renderProps.productName,
      sourceUrl: renderProps.sourceUrl,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Browser capture unavailable.";

    return {
      ...renderProps,
      screenshots: fallbackScreenshots(renderProps, reason),
      captions: [...renderProps.captions, `Browser capture fallback: ${reason}`].slice(0, 5),
    };
  }

  const recordingPath = capture.recordingPath ? renderedBrowserRecordingPath(launchPackId) : undefined;

  if (capture.recordingPath && recordingPath) {
    await copyFile(capture.recordingPath, recordingPath);
  }

  return {
    ...renderProps,
    browserRecordingUrl: recordingPath ? absoluteUrl(baseUrl, renderedBrowserRecordingUrl(launchPackId)) : undefined,
    screenshots: capture.screenshots,
    demoSteps: capture.steps.length ? capture.steps : renderProps.demoSteps,
    captions: [
      ...renderProps.captions,
      `Captured ${capture.screenshots.length} screen${capture.screenshots.length === 1 ? "" : "s"} for ${launchPackId}.`,
    ].slice(0, 5),
  };
}

export async function renderReleaseArtifacts({
  baseUrl,
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
  const compositionId = demoVideo.compositionId || "ProofPitchProductDemo";
  const slidevPdfArgs = ["--yes", "@slidev/cli", "export", deckPath, "--format", "pdf", "--output", deckPdfPath];
  const slidevPngArgs = ["--yes", "@slidev/cli", "export", deckPath, "--format", "png", "--output", deckPngPath];
  const remotionArgs = [
    "--yes",
    "@remotion/cli",
    "render",
    "remotion/index.tsx",
    compositionId,
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
        baseUrl,
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
