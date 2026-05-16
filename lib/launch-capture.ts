import type { CreateLaunchPackRequest, LaunchScreenshot } from "./schemas";
import { mkdir } from "node:fs/promises";

type CaptureResult = {
  screenshots: LaunchScreenshot[];
  notes: string[];
};

function baseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function fallbackCapture(input: CreateLaunchPackRequest, reason?: string): CaptureResult {
  const safeBase = baseUrl(input.sourceUrl);

  return {
    screenshots: [
      {
        id: "shot-home",
        title: `${input.productName} entry screen`,
        url: `${safeBase}#proofpitch-home`,
        alt: `${input.productName} public product entry screen`,
      },
      {
        id: "shot-demo",
        title: `${input.productName} proof moment`,
        url: `${safeBase}#proofpitch-demo`,
        alt: `${input.productName} feature walkthrough moment`,
      },
      {
        id: "shot-launch",
        title: `${input.productName} launch asset`,
        url: `${safeBase}#proofpitch-launch`,
        alt: `${input.productName} release-ready product screenshot`,
      },
    ],
    notes: reason
      ? [`Browser capture used source references: ${reason}`]
      : ["Browser capture used source references. Enable PROOFPITCH_PLAYWRIGHT_CAPTURE=1 in the worker to capture real screenshots."],
  };
}

export async function captureLaunchDemo(input: CreateLaunchPackRequest): Promise<CaptureResult> {
  if (process.env.PROOFPITCH_PLAYWRIGHT_CAPTURE !== "1") {
    return fallbackCapture(input);
  }

  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{
      chromium: {
        launch: (options: { headless: boolean }) => Promise<{
          newContext: (options: {
            viewport: { width: number; height: number };
            recordVideo?: { dir: string; size: { width: number; height: number } };
          }) => Promise<{
            newPage: () => Promise<{
              goto: (url: string, options: { waitUntil: "networkidle"; timeout: number }) => Promise<unknown>;
              screenshot: (options: { path: string; fullPage: boolean }) => Promise<unknown>;
              video: () => { path: () => Promise<string> } | null;
            }>;
            close: () => Promise<void>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    }>;
    const { chromium } = await dynamicImport("playwright");
    const assetDir = process.env.PROOFPITCH_RELEASE_ASSET_DIR || ".proofpitch/release-assets";
    await mkdir(assetDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      recordVideo: { dir: assetDir, size: { width: 1440, height: 1000 } },
    });
    const page = await context.newPage();
    const shotPath = `${assetDir}/${crypto.randomUUID()}-homepage.png`;

    await page.goto(input.sourceUrl, { waitUntil: "networkidle", timeout: 45_000 });
    await page.screenshot({ path: shotPath, fullPage: true });
    await context.close();
    await browser.close();

    return {
      screenshots: [
        {
          id: "shot-home",
          title: `${input.productName} browser capture`,
          url: shotPath,
          alt: `${input.productName} captured from ${input.sourceUrl}`,
        },
      ],
      notes: ["Captured source screenshots with Playwright in the local release worker path."],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown capture failure.";

    return fallbackCapture(input, message);
  }
}
