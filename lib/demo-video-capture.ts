import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ProductDemoScreenshot } from "./schemas";

type CaptureWebsiteScreenshotsInput = {
  outputDir: string;
  pathInstructions?: string;
  productName: string;
  sourceUrl: string;
};

type CaptureWebsiteScreenshotsResult = {
  recordingPath?: string;
  screenshots: ProductDemoScreenshot[];
  steps: string[];
};

type PointerPosition = NonNullable<ProductDemoScreenshot["pointer"]>;

type PlaywrightPage = {
  goto: (url: string, options: { timeout: number; waitUntil: "domcontentloaded" | "networkidle" }) => Promise<unknown>;
  keyboard: {
    press: (key: string) => Promise<void>;
    type: (text: string, options?: { delay?: number }) => Promise<void>;
  };
  mouse: {
    click: (x: number, y: number) => Promise<void>;
    move: (x: number, y: number, options?: { steps?: number }) => Promise<void>;
    wheel: (deltaX: number, deltaY: number) => Promise<void>;
  };
  screenshot: (options: {
    animations?: "allow" | "disabled";
    fullPage?: boolean;
    path: string;
    quality?: number;
    timeout?: number;
    type?: "jpeg" | "png";
  }) => Promise<unknown>;
  evaluate: <Result, Arg = unknown>(
    pageFunction: string | ((arg: Arg) => Result | Promise<Result>),
    arg?: Arg,
  ) => Promise<Result>;
  waitForLoadState: (state: "domcontentloaded" | "networkidle", options?: { timeout: number }) => Promise<void>;
  video: () => { path: () => Promise<string> } | null;
};

type PlaywrightContext = {
  close: () => Promise<void>;
  newPage: () => Promise<PlaywrightPage>;
};

type PlaywrightBrowser = {
  close: () => Promise<void>;
  newContext: (options: {
    deviceScaleFactor?: number;
    recordVideo?: { dir: string; size: { height: number; width: number } };
    viewport: { height: number; width: number };
  }) => Promise<PlaywrightContext>;
};

type DemoInstruction =
  | {
      action: "click";
      label: string;
      raw: string;
    }
  | {
      action: "search";
      query: string;
      raw: string;
    }
  | {
      action: "first-result";
      raw: string;
    }
  | {
      action: "scroll";
      raw: string;
    };

type TextClickResult = {
  clientPoint?: { x: number; y: number };
  clicked: boolean;
  pointer?: PointerPosition;
  text?: string;
};

type DemoInstructionRunResult = {
  pointer?: PointerPosition;
  step: string;
};

const cookieAcceptLabels = [
  "accept all",
  "accept cookies",
  "allow all",
  "i agree",
  "agree",
  "got it",
  "continue",
  "tout accepter",
  "accepter",
  "j'accepte",
  "j’accepte",
  "autoriser tous les cookies",
  "aceptar todo",
  "aceitar tudo",
  "alle akzeptieren",
  "akzeptieren",
  "accetta tutto",
];

const cookieDismissLabels = [
  "reject all",
  "decline",
  "not now",
  "no thanks",
  "skip",
  "continuer sans accepter",
  "tout refuser",
  "refuser",
  "ignorer",
  "más tarde",
  "rechazar todo",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanTarget(value: string) {
  return value
    .replace(/^["'“”‘’]+|["'“”‘’.,;:]+$/g, "")
    .replace(/^(le|la|les|un|une|the|a|an)\s+/i, "")
    .trim();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    `<text x="96" y="150" font-family="Georgia,serif" font-size="58" font-weight="700" fill="#111827">${escapeXml(title)}</text>`,
    `<text x="96" y="230" font-family="Arial,sans-serif" font-size="28" fill="#334155">${escapeXml(reason).slice(0, 150)}</text>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function splitInstructionText(instructions: string) {
  return instructions
    .split(/\n|(?:\s+(?:puis|ensuite|apres|après|then|next|and then)\s+)|[.;]/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 9);
}

function extractQuotedText(value: string) {
  return (
    value.match(/["“”'‘’]([^"“”'‘’]{2,80})["“”'‘’]/)?.[1]?.trim() ??
    value.match(/(?:search|chercher|recherche|type|tape)\s+(.{2,80})$/i)?.[1]?.trim() ??
    null
  );
}

function parseInstruction(raw: string): DemoInstruction | null {
  const normalized = normalize(raw);
  const quoted = extractQuotedText(raw);

  if (
    /\b(first|premier|premiere|première|1er|1ere|1ère)\b/.test(normalized) &&
    /\b(video|result|résultat|resultat|card|item)\b/.test(normalized)
  ) {
    return { action: "first-result", raw };
  }

  if (/\b(scroll|descend|defile|défile|bas de page|down)\b/.test(normalized)) {
    return { action: "scroll", raw };
  }

  if (/\b(search|chercher|recherche|type|tape)\b/.test(normalized)) {
    const query = cleanTarget(quoted ?? raw.replace(/^(search|chercher|recherche|type|tape)\s*/i, ""));

    return query ? { action: "search", query, raw } : null;
  }

  if (/\b(click|clique|ouvre|open|go to|va sur|appuie|select|choisis|watch|regarde)\b/.test(normalized)) {
    const label = cleanTarget(
      quoted ??
        raw.replace(
          /^(click(?: on)?|clique(?: sur)?|ouvre|open|go to|va sur|appuie(?: sur)?|select|choisis|watch|regarde)\s*/i,
          "",
        ),
    );

    return label ? { action: "click", label, raw } : null;
  }

  if (quoted) {
    return { action: "click", label: cleanTarget(quoted), raw };
  }

  return null;
}

function parseInstructions(instructions?: string) {
  if (!instructions?.trim()) {
    return [];
  }

  return splitInstructionText(instructions).map(parseInstruction).filter((item): item is DemoInstruction => Boolean(item));
}

async function getChromium() {
  const { chromium } = await import("playwright-chromium");

  return chromium as {
    launch: (options: { headless: boolean }) => Promise<PlaywrightBrowser>;
  };
}

function uniqueScrollPositions(scrollHeight: number, viewportHeight: number) {
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const positions = [0, Math.round(maxScroll * 0.45), maxScroll];

  return [...new Set(positions)].slice(0, 3);
}

async function screenshotToDataUrl(filePath: string) {
  const buffer = await readFile(filePath);

  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function waitForPage(page: PlaywrightPage) {
  await page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
}

async function installCursorOverlay(page: PlaywrightPage) {
  await page
    .evaluate(() => {
      const existing = document.getElementById("proofpitch-agent-cursor");

      if (existing) {
        return;
      }

      const style = document.createElement("style");
      style.id = "proofpitch-agent-cursor-style";
      style.textContent = `
        #proofpitch-agent-cursor {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 2147483647;
          pointer-events: none;
          transform: translate(12vw, 78vh);
          transition: transform 620ms cubic-bezier(.22,1,.36,1);
          width: 42px;
          height: 52px;
          filter: drop-shadow(0 8px 14px rgba(0,0,0,.3));
        }
        .proofpitch-agent-ripple {
          position: fixed;
          z-index: 2147483646;
          width: 56px;
          height: 56px;
          margin-left: -21px;
          margin-top: -18px;
          border: 4px solid #14b8a6;
          border-radius: 999px;
          pointer-events: none;
          animation: proofpitch-agent-ripple 760ms ease-out forwards;
        }
        @keyframes proofpitch-agent-ripple {
          from { opacity: .95; transform: scale(.55); }
          to { opacity: 0; transform: scale(2.35); }
        }
      `;
      const cursor = document.createElement("div");
      cursor.id = "proofpitch-agent-cursor";
      cursor.innerHTML = `
        <svg width="42" height="52" viewBox="0 0 46 56" aria-hidden="true">
          <path d="M5 4L5 43L16 34L24 52L34 48L26 31L41 31L5 4Z"
            fill="#fffaf0" stroke="#111827" stroke-linejoin="round" stroke-width="5" />
        </svg>
      `;
      document.documentElement.append(style, cursor);
    })
    .catch(() => undefined);
}

async function moveCursor(page: PlaywrightPage, clientPoint: { x: number; y: number }) {
  await installCursorOverlay(page);
  await page
    .evaluate((point) => {
      document.getElementById("proofpitch-agent-cursor")?.style.setProperty(
        "transform",
        `translate(${point.x}px, ${point.y}px)`,
      );
    }, clientPoint)
    .catch(() => undefined);
  await page.mouse.move(clientPoint.x, clientPoint.y, { steps: 18 }).catch(() => undefined);
  await wait(680);
}

async function markCursorClick(page: PlaywrightPage, clientPoint: { x: number; y: number }) {
  await page
    .evaluate((point) => {
      const ripple = document.createElement("div");
      ripple.className = "proofpitch-agent-ripple";
      ripple.style.left = `${point.x}px`;
      ripple.style.top = `${point.y}px`;
      document.documentElement.append(ripple);
      window.setTimeout(() => ripple.remove(), 900);
    }, clientPoint)
    .catch(() => undefined);
  await wait(260);
}

async function reinstallCursorAfterNavigation(page: PlaywrightPage) {
  await waitForPage(page);
  await installCursorOverlay(page);
}

async function clickBestTextMatch(page: PlaywrightPage, labels: string[]): Promise<TextClickResult> {
  const result = await page.evaluate(
    (candidateLabels) => {
      const normalizeText = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[’`]/g, "'")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const labelsToMatch = candidateLabels.map(normalizeText).filter(Boolean);
      const isVisible = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, a, input[type='button'], input[type='submit'], [role='button'], [role='link']",
        ),
      );

      for (const element of candidates) {
        const text = normalizeText(
          element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("value") || "",
        );

        if (!text || !isVisible(element)) {
          continue;
        }

        const match = labelsToMatch.find((label) => text === label || text.includes(label) || label.includes(text));

        if (match) {
          const rect = element.getBoundingClientRect();

          return {
            clientPoint: {
              x: Math.min(window.innerWidth - 4, Math.max(4, rect.left + rect.width / 2)),
              y: Math.min(window.innerHeight - 4, Math.max(4, rect.top + rect.height / 2)),
            },
            clicked: true,
            pointer: {
              x: Math.min(100, Math.max(0, ((rect.left + rect.width / 2) / window.innerWidth) * 100)),
              y: Math.min(100, Math.max(0, ((rect.top + rect.height / 2) / window.innerHeight) * 100)),
            },
            text,
          };
        }
      }

      return { clicked: false };
    },
    labels,
  );

  if (result.clicked && result.clientPoint) {
    await moveCursor(page, result.clientPoint);
    await page.mouse.click(result.clientPoint.x, result.clientPoint.y);
    await markCursorClick(page, result.clientPoint);
  }

  return result;
}

async function acceptCookieBanners(page: PlaywrightPage) {
  for (const labels of [cookieAcceptLabels, cookieDismissLabels]) {
    const result: TextClickResult = await clickBestTextMatch(page, labels).catch(() => ({ clicked: false }));

    if (result.clicked) {
      await reinstallCursorAfterNavigation(page);

      return {
        pointer: result.pointer,
        step: result.text ? `Handled consent banner: ${result.text}` : "Handled consent banner.",
      };
    }
  }

  return null;
}

async function clickInstructionTarget(page: PlaywrightPage, label: string) {
  const result: TextClickResult = await clickBestTextMatch(page, [label]).catch(() => ({ clicked: false }));

  if (result.clicked) {
    await reinstallCursorAfterNavigation(page);
  }

  return result;
}

async function searchWithinPage(page: PlaywrightPage, query: string) {
  const focused = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const selectors = [
      "input[type='search']",
      "input[name='search_query']",
      "input[name='q']",
      "input[placeholder*='Search' i]",
      "input[aria-label*='Search' i]",
      "textarea[aria-label*='Search' i]",
      "input",
      "textarea",
    ];

    for (const selector of selectors) {
      const element = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)).find(
        (item) => !item.disabled && !item.readOnly && isVisible(item),
      );

      if (element) {
        const rect = element.getBoundingClientRect();

        return {
          clientPoint: {
            x: Math.min(window.innerWidth - 4, Math.max(4, rect.left + rect.width / 2)),
            y: Math.min(window.innerHeight - 4, Math.max(4, rect.top + rect.height / 2)),
          },
          focused: true,
          pointer: {
            x: Math.min(100, Math.max(0, ((rect.left + rect.width / 2) / window.innerWidth) * 100)),
            y: Math.min(100, Math.max(0, ((rect.top + rect.height / 2) / window.innerHeight) * 100)),
          },
        };
      }
    }

    return { focused: false };
  });

  if (!focused.focused) {
    return { searched: false };
  }

  if (focused.clientPoint) {
    await moveCursor(page, focused.clientPoint);
    await page.mouse.click(focused.clientPoint.x, focused.clientPoint.y);
    await markCursorClick(page, focused.clientPoint);
  }

  await page.keyboard.press("Meta+A").catch(() => page.keyboard.press("Control+A").catch(() => undefined));
  await page.keyboard.type(query, { delay: 45 }).catch(() => undefined);
  await page.keyboard.press("Enter");
  await reinstallCursorAfterNavigation(page);

  return { pointer: focused.pointer, searched: true };
}

async function clickFirstResult(page: PlaywrightPage) {
  const result = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 60 && rect.height > 30;
    };
    const selectors = [
      "a#video-title",
      "ytd-video-renderer a#thumbnail",
      "a[href*='/watch']",
      "a[href*='/shorts']",
      "main a[href]",
      "[role='main'] a[href]",
      "article a[href]",
      "a[href]",
    ];

    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector)).filter((element) => {
        const href = element.href || "";
        const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || "").trim();

        return (
          isVisible(element) &&
          href &&
          !href.startsWith("javascript:") &&
          !href.includes("#") &&
          !/privacy|terms|cookie|signin|login|account/i.test(href) &&
          !/privacy|terms|cookie|sign in|log in/i.test(text)
        );
      });
      const target = candidates[0];

      if (target) {
        const rect = target.getBoundingClientRect();
        const label = (target.innerText || target.textContent || target.getAttribute("aria-label") || target.href)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);

        return {
          clientPoint: {
            x: Math.min(window.innerWidth - 4, Math.max(4, rect.left + rect.width / 2)),
            y: Math.min(window.innerHeight - 4, Math.max(4, rect.top + rect.height / 2)),
          },
          clicked: true,
          label,
          pointer: {
            x: Math.min(100, Math.max(0, ((rect.left + rect.width / 2) / window.innerWidth) * 100)),
            y: Math.min(100, Math.max(0, ((rect.top + rect.height / 2) / window.innerHeight) * 100)),
          },
        };
      }
    }

    return { clicked: false };
  });

  if (result.clicked) {
    if (result.clientPoint) {
      await moveCursor(page, result.clientPoint);
      await page.mouse.click(result.clientPoint.x, result.clientPoint.y);
      await markCursorClick(page, result.clientPoint);
    }

    await reinstallCursorAfterNavigation(page);

    return {
      pointer: result.pointer,
      step: result.label ? `Opened first result: ${result.label}.` : "Opened first result.",
    };
  }

  return { step: "Could not find a first result to open." };
}

async function scrollDemoPage(page: PlaywrightPage) {
  const point = await page.evaluate(() => ({
    x: Math.round(window.innerWidth * 0.91),
    y: Math.round(window.innerHeight * 0.74),
  }));

  await moveCursor(page, point);

  for (let index = 0; index < 4; index += 1) {
    await page.mouse.wheel(0, 240);
    await wait(220);
  }

  await wait(500);
}

async function runInstruction(page: PlaywrightPage, instruction: DemoInstruction): Promise<DemoInstructionRunResult> {
  if (instruction.action === "scroll") {
    await scrollDemoPage(page);

    return { pointer: { x: 91, y: 74 }, step: `Scrolled page: ${instruction.raw}` };
  }

  if (instruction.action === "search") {
    const search = await searchWithinPage(page, instruction.query);

    return {
      pointer: search.pointer,
      step: search.searched
        ? `Searched for "${instruction.query}".`
        : `Could not find a search field for "${instruction.query}".`,
    };
  }

  if (instruction.action === "first-result") {
    return clickFirstResult(page);
  }

  const result = await clickInstructionTarget(page, instruction.label);

  return {
    pointer: result.pointer,
    step: result.clicked ? `Clicked "${instruction.label}".` : `Could not find "${instruction.label}".`,
  };
}

function enrichInstructions(instructions: DemoInstruction[]) {
  const enriched = [...instructions];
  const hasScroll = enriched.some((instruction) => instruction.action === "scroll");
  const hasFirstResult = enriched.some((instruction) => instruction.action === "first-result");
  const hasSearch = enriched.some((instruction) => instruction.action === "search");

  if (hasSearch && !hasFirstResult) {
    enriched.push({ action: "first-result", raw: "open the first result" });
  }

  while (enriched.length < 5) {
    enriched.push({
      action: "scroll",
      raw: hasScroll ? "continue scrolling through the page" : "scroll down",
    });
  }

  return enriched.slice(0, 9);
}

async function captureFrame({
  action = "capture",
  fileName,
  outputDir,
  page,
  pointer,
  productName,
  target,
  title,
  sourceUrl,
}: {
  action?: ProductDemoScreenshot["action"];
  fileName: string;
  outputDir: string;
  page: PlaywrightPage;
  pointer?: PointerPosition;
  productName: string;
  target?: string;
  title: string;
  sourceUrl: string;
}): Promise<ProductDemoScreenshot> {
  const filePath = path.join(outputDir, fileName);
  let url: string;

  try {
    await page.screenshot({
      animations: "disabled",
      path: filePath,
      type: "jpeg",
      quality: 84,
      fullPage: false,
      timeout: 12_000,
    });
    url = await screenshotToDataUrl(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture screenshot.";

    url = placeholderScreenshotDataUrl(title, message);
  }

  return {
    action,
    title: `${productName} ${title}`,
    url,
    alt: `${productName} captured from ${sourceUrl}`,
    pointer,
    target,
  };
}

export async function captureWebsiteScreenshots({
  outputDir,
  pathInstructions,
  productName,
  sourceUrl,
}: CaptureWebsiteScreenshotsInput): Promise<CaptureWebsiteScreenshotsResult> {
  await mkdir(outputDir, { recursive: true });
  const recordingDir = path.join(outputDir, "recordings");

  await mkdir(recordingDir, { recursive: true });

  const chromium = await getChromium();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    recordVideo: { dir: recordingDir, size: { width: 1440, height: 1000 } },
    viewport: { width: 1440, height: 1000 },
  });
  let contextClosed = false;

  try {
    const page = await context.newPage();
    const video = page.video();
    const startedAt = Date.now();
    const screenshots: ProductDemoScreenshot[] = [];
    const steps: string[] = [];

    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForPage(page);
    await installCursorOverlay(page);
    await wait(1_200);

    steps.push(`Opened ${sourceUrl}.`);
    const consentStep = await acceptCookieBanners(page);

    if (consentStep) {
      steps.push(consentStep.step);
    }

    screenshots.push(
      await captureFrame({
        action: consentStep ? "consent" : "open",
        fileName: "capture-1.jpg",
        outputDir,
        page,
        pointer: consentStep?.pointer,
        productName,
        target: consentStep?.step ?? sourceUrl,
        title: "entry screen",
        sourceUrl,
      }),
    );

    const instructions = enrichInstructions(parseInstructions(pathInstructions));

    for (const [index, instruction] of instructions.entries()) {
      const run = await runInstruction(page, instruction);

      steps.push(run.step);
      screenshots.push(
        await captureFrame({
          action: instruction.action === "first-result" ? "first_result" : instruction.action,
          fileName: `capture-${index + 2}.jpg`,
          outputDir,
          page,
          pointer: run.pointer,
          productName,
          target:
            instruction.action === "click"
              ? instruction.label
              : instruction.action === "search"
                ? instruction.query
                : instruction.raw,
          title: instruction.raw,
          sourceUrl,
        }),
      );
      await wait(1_050);
    }

    if (screenshots.length < 3) {
      const scrollHeight = await page
        .evaluate(() =>
          Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
          ),
        )
        .catch(() => 1000);
      const positions = uniqueScrollPositions(scrollHeight, 1000);
      const titles = ["product detail", "proof moment"];

      for (const position of positions.slice(1)) {
        if (screenshots.length >= 3) {
          break;
        }

        await page.evaluate((scrollY) => window.scrollTo(0, scrollY), position);
        await wait(450);
        steps.push("Scrolled to capture more of the page.");
        screenshots.push(
          await captureFrame({
            action: "scroll",
            fileName: `capture-${screenshots.length + 1}.jpg`,
            outputDir,
            page,
            pointer: { x: 91, y: 74 },
            productName,
            target: "page",
            title: titles[screenshots.length - 1] ?? `screen ${screenshots.length + 1}`,
            sourceUrl,
          }),
        );
      }
    }

    const elapsed = Date.now() - startedAt;

    if (elapsed < 24_000) {
      await wait(24_000 - elapsed);
    }

    await context.close();
    contextClosed = true;

    return {
      recordingPath: video ? await video.path().catch(() => undefined) : undefined,
      screenshots: screenshots.slice(0, 8),
      steps: steps.slice(0, 10),
    };
  } finally {
    if (!contextClosed) {
      await context.close().catch(() => undefined);
    }
    await browser.close().catch(() => undefined);
  }
}
