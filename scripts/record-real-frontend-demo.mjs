import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-chromium";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const rawDir = path.join(repoRoot, ".proofpitch", "browser-recordings");
const assetDir = path.join(repoRoot, "hyperframes", "proofpitch-demo", "assets");
const finalPath = path.join(assetDir, "proofpitch-browser-recording.mp4");

const baseUrl = process.env.PROOFPITCH_DEMO_BASE_URL ?? "https://proofpitch.vercel.app";
const productUrl = process.env.PROOFPITCH_DEMO_PRODUCT_URL ?? "https://proofpitch.vercel.app";
const durationSeconds = Number(process.env.PROOFPITCH_DEMO_DURATION_SECONDS ?? "75");
const headed = process.env.PROOFPITCH_DEMO_HEADED === "1";
const shortcutModifier = process.platform === "darwin" ? "Meta" : "Control";

async function installCursor(page) {
  await page.addStyleTag({
    content: `
      #proofpitch-demo-cursor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483647;
        width: 34px;
        height: 42px;
        pointer-events: none;
        transform: translate(96px, 96px);
        transition: transform 260ms ease;
        filter: drop-shadow(0 8px 10px rgba(17, 24, 39, 0.32));
      }

      #proofpitch-demo-cursor svg {
        width: 34px;
        height: 42px;
      }

      #proofpitch-demo-cursor-label {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483646;
        transform: translate(132px, 82px);
        transition: transform 260ms ease, opacity 180ms ease;
        border: 2px solid #111827;
        background: #fffdf7;
        color: #111827;
        padding: 6px 9px;
        font: 700 12px/1 Inter, ui-sans-serif, system-ui, Arial, sans-serif;
        letter-spacing: 0;
        pointer-events: none;
        opacity: 0.92;
      }

      #proofpitch-demo-click-ring {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483645;
        width: 54px;
        height: 54px;
        border: 4px solid #0f766e;
        border-radius: 999px;
        opacity: 0;
        pointer-events: none;
        transform: translate(86px, 84px) scale(0.55);
      }

      #proofpitch-demo-click-ring.proofpitch-demo-pulse {
        animation: proofpitchDemoPulse 520ms ease-out;
      }

      @keyframes proofpitchDemoPulse {
        0% { opacity: 0.88; transform: var(--ring-transform) scale(0.55); }
        100% { opacity: 0; transform: var(--ring-transform) scale(1.8); }
      }
    `,
  });

  await page.evaluate(() => {
    if (document.getElementById("proofpitch-demo-cursor")) {
      return;
    }

    const cursor = document.createElement("div");
    cursor.id = "proofpitch-demo-cursor";
    cursor.innerHTML = `
      <svg viewBox="0 0 46 56" aria-hidden="true">
        <path d="M5 4L5 43L16 34L24 52L34 48L26 31L41 31L5 4Z" fill="#fffdf7" stroke="#111827" stroke-width="5" stroke-linejoin="round" />
      </svg>
    `;

    const label = document.createElement("div");
    label.id = "proofpitch-demo-cursor-label";
    label.textContent = "open app";

    const ring = document.createElement("div");
    ring.id = "proofpitch-demo-click-ring";

    document.body.append(cursor, label, ring);
  });
}

async function moveTo(page, locator, label, offset = { x: 0.5, y: 0.5 }) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(`Cannot locate element for demo action: ${label}`);
  }

  const x = Math.round(box.x + box.width * offset.x);
  const y = Math.round(box.y + box.height * offset.y);

  await page.evaluate(
    ({ x: nextX, y: nextY, label: nextLabel }) => {
      const cursor = document.getElementById("proofpitch-demo-cursor");
      const labelNode = document.getElementById("proofpitch-demo-cursor-label");
      const ring = document.getElementById("proofpitch-demo-click-ring");

      cursor.style.transform = `translate(${nextX}px, ${nextY}px)`;
      labelNode.style.transform = `translate(${nextX + 38}px, ${Math.max(8, nextY - 18)}px)`;
      labelNode.textContent = nextLabel;
      ring.style.transform = `translate(${nextX - 25}px, ${nextY - 25}px)`;
      ring.style.setProperty("--ring-transform", `translate(${nextX - 25}px, ${nextY - 25}px)`);
    },
    { x, y, label },
  );

  await page.mouse.move(x, y, { steps: 16 });
  await page.waitForTimeout(320);
}

async function pulseClick(page) {
  await page.evaluate(() => {
    const ring = document.getElementById("proofpitch-demo-click-ring");
    ring.classList.remove("proofpitch-demo-pulse");
    void ring.offsetWidth;
    ring.classList.add("proofpitch-demo-pulse");
  });
}

async function click(page, locator, label, offset) {
  await moveTo(page, locator, label, offset);
  await pulseClick(page);
  await locator.click({ delay: 60 });
  await page.waitForTimeout(480);
}

async function replaceText(page, locator, value, label) {
  await click(page, locator, label);
  await page.keyboard.press(`${shortcutModifier}+A`);
  await page.keyboard.type(value, { delay: 10 });
  await page.waitForTimeout(280);
}

async function main() {
  await rm(rawDir, { recursive: true, force: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(assetDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120_000);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await installCursor(page);
  await page.waitForTimeout(900);

  await replaceText(page, page.getByPlaceholder("Public product URL"), productUrl, "enter real URL");
  await replaceText(page, page.getByPlaceholder("Product name"), "ProofPitch", "product name");
  await replaceText(page, page.getByPlaceholder("Target audience"), "Founder-led B2B teams", "target audience");
  await replaceText(
    page,
    page.getByPlaceholder("Demo goal"),
    "Show the product URL to proof-aware demo video workflow.",
    "launch goal",
  );
  await replaceText(
    page,
    page.getByPlaceholder(/Demo path/),
    "Open the page, review the form, show the proof review, then render the demo video.",
    "demo path",
  );

  await click(page, page.getByRole("button", { name: /Generate demo brief/i }), "generate brief");
  await page.waitForSelector("text=Proof review");
  await page.waitForTimeout(1200);

  await moveTo(page, page.getByText("Proof review"), "proof review", { x: 0.3, y: 0.5 });
  await page.waitForTimeout(1000);

  await click(page, page.getByRole("button", { name: /Approve for narration/i }), "approve narration");
  await page.waitForSelector("text=Narration ready");
  await page.waitForTimeout(1200);
  await moveTo(page, page.getByText("Video brief"), "video brief", { x: 0.4, y: 0.5 });
  await page.waitForTimeout(3600);

  const rawVideoPath = await page.video().path();
  await context.close();
  await browser.close();

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      rawVideoPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-r",
      "30",
      "-g",
      "30",
      "-keyint_min",
      "30",
      "-sc_threshold",
      "0",
      "-vf",
      `fps=30,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,tpad=stop_mode=clone:stop_duration=${durationSeconds},format=yuv420p`,
      "-t",
      String(durationSeconds),
      "-an",
      "-movflags",
      "+faststart",
      finalPath,
    ],
    { stdio: "inherit" },
  );

  console.log(`Recorded real frontend demo: ${finalPath}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
