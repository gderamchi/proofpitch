import type { CreateDemoVideoRequest, DemoScreenshot } from "./schemas";
import { mkdir } from "node:fs/promises";
import { assertPublicHttpUrl } from "./public-url";

type CaptureResult = {
  screenshots: DemoScreenshot[];
  notes: string[];
  videoUrl?: string;
};

function baseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function fallbackCapture(input: CreateDemoVideoRequest, reason?: string): CaptureResult {
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
        id: "shot-proof",
        title: `${input.productName} proof point`,
        url: `${safeBase}#proofpitch-proof`,
        alt: `${input.productName} proof-ready product screenshot`,
      },
    ],
    notes: reason
      ? [`Browser capture used source references: ${reason}`]
      : ["Browser capture used source references. Enable PROOFPITCH_PLAYWRIGHT_CAPTURE=1 in the worker to capture real screenshots."],
  };
}

export async function captureDemoVideo(input: CreateDemoVideoRequest): Promise<CaptureResult> {
  if (process.env.PROOFPITCH_PLAYWRIGHT_CAPTURE !== "1") {
    return fallbackCapture(input);
  }

  try {
    await assertPublicHttpUrl(input.sourceUrl);

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
              route: (
                url: string,
                handler: (route: {
                  abort: () => Promise<void>;
                  continue: () => Promise<void>;
                  request: () => { url: () => string };
                }) => Promise<void>,
              ) => Promise<unknown>;
              screenshot: (options: { path: string; fullPage: boolean }) => Promise<unknown>;
              video: () => { path: () => Promise<string> } | null;
            }>;
            close: () => Promise<void>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    }>;
    const { chromium } = await dynamicImport("playwright-chromium");
    const assetDir = process.env.PROOFPITCH_VIDEO_ASSET_DIR || ".proofpitch/demo-video-assets";
    await mkdir(assetDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      recordVideo: { dir: assetDir, size: { width: 1440, height: 1000 } },
    });
    const page = await context.newPage();
    const shotPath = `${assetDir}/${crypto.randomUUID()}-homepage.png`;

    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      const protocol = new URL(requestUrl).protocol;

      if (protocol !== "http:" && protocol !== "https:") {
        await route.continue();
        return;
      }

      try {
        await assertPublicHttpUrl(requestUrl);
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    await page.goto(input.sourceUrl, { waitUntil: "networkidle", timeout: 45_000 });
    await page.screenshot({ path: shotPath, fullPage: true });
    const video = page.video();
    await context.close();
    const videoUrl = video ? await video.path() : undefined;
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
      notes: ["Captured source screenshots with Playwright in the local demo-video worker path."],
      videoUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown capture failure.";

    return fallbackCapture(input, message);
  }
}
