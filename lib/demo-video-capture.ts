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
  screenshots: ProductDemoScreenshot[];
  steps: string[];
};

type PlaywrightPage = {
  goto: (url: string, options: { timeout: number; waitUntil: "domcontentloaded" | "networkidle" }) => Promise<unknown>;
  keyboard: {
    press: (key: string) => Promise<void>;
  };
  screenshot: (options: {
    fullPage?: boolean;
    path: string;
    quality?: number;
    type?: "jpeg" | "png";
  }) => Promise<unknown>;
  evaluate: <Result, Arg = unknown>(
    pageFunction: string | ((arg: Arg) => Result | Promise<Result>),
    arg?: Arg,
  ) => Promise<Result>;
  waitForLoadState: (state: "domcontentloaded" | "networkidle", options?: { timeout: number }) => Promise<void>;
};

type PlaywrightContext = {
  close: () => Promise<void>;
  newPage: () => Promise<PlaywrightPage>;
};

type PlaywrightBrowser = {
  close: () => Promise<void>;
  newContext: (options: {
    deviceScaleFactor?: number;
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
  clicked: boolean;
  text?: string;
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

async function clickBestTextMatch(page: PlaywrightPage, labels: string[]): Promise<TextClickResult> {
  return page.evaluate(
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
          element.click();

          return { clicked: true, text };
        }
      }

      return { clicked: false };
    },
    labels,
  );
}

async function acceptCookieBanners(page: PlaywrightPage) {
  for (const labels of [cookieAcceptLabels, cookieDismissLabels]) {
    const result: TextClickResult = await clickBestTextMatch(page, labels).catch(() => ({ clicked: false }));

    if (result.clicked) {
      await waitForPage(page);

      return result.text ? `Handled consent banner: ${result.text}` : "Handled consent banner.";
    }
  }

  return null;
}

async function clickInstructionTarget(page: PlaywrightPage, label: string) {
  const result: TextClickResult = await clickBestTextMatch(page, [label]).catch(() => ({ clicked: false }));

  if (result.clicked) {
    await waitForPage(page);

    return true;
  }

  return false;
}

async function searchWithinPage(page: PlaywrightPage, query: string) {
  const focused = await page.evaluate((searchQuery) => {
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
        element.focus();
        element.value = searchQuery;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, data: searchQuery }));
        element.dispatchEvent(new Event("change", { bubbles: true }));

        return true;
      }
    }

    return false;
  }, query);

  if (!focused) {
    return false;
  }

  await page.keyboard.press("Enter");
  await waitForPage(page);

  return true;
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
        const label = (target.innerText || target.textContent || target.getAttribute("aria-label") || target.href)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        target.click();

        return { clicked: true, label };
      }
    }

    return { clicked: false };
  });

  if (result.clicked) {
    await waitForPage(page);

    return result.label ? `Opened first result: ${result.label}.` : "Opened first result.";
  }

  return "Could not find a first result to open.";
}

async function scrollDemoPage(page: PlaywrightPage) {
  await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.72)));
  await new Promise((resolve) => setTimeout(resolve, 700));
}

async function runInstruction(page: PlaywrightPage, instruction: DemoInstruction) {
  if (instruction.action === "scroll") {
    await scrollDemoPage(page);

    return `Scrolled page: ${instruction.raw}`;
  }

  if (instruction.action === "search") {
    const didSearch = await searchWithinPage(page, instruction.query);

    return didSearch
      ? `Searched for "${instruction.query}".`
      : `Could not find a search field for "${instruction.query}".`;
  }

  if (instruction.action === "first-result") {
    return clickFirstResult(page);
  }

  const clicked = await clickInstructionTarget(page, instruction.label);

  return clicked ? `Clicked "${instruction.label}".` : `Could not find "${instruction.label}".`;
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
  fileName,
  outputDir,
  page,
  productName,
  title,
  sourceUrl,
}: {
  fileName: string;
  outputDir: string;
  page: PlaywrightPage;
  productName: string;
  title: string;
  sourceUrl: string;
}): Promise<ProductDemoScreenshot> {
  const filePath = path.join(outputDir, fileName);

  await page.screenshot({
    path: filePath,
    type: "jpeg",
    quality: 84,
    fullPage: false,
  });

  return {
    title: `${productName} ${title}`,
    url: await screenshotToDataUrl(filePath),
    alt: `${productName} captured from ${sourceUrl}`,
  };
}

export async function captureWebsiteScreenshots({
  outputDir,
  pathInstructions,
  productName,
  sourceUrl,
}: CaptureWebsiteScreenshotsInput): Promise<CaptureWebsiteScreenshotsResult> {
  await mkdir(outputDir, { recursive: true });

  const chromium = await getChromium();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 1000 },
  });

  try {
    const page = await context.newPage();
    const screenshots: ProductDemoScreenshot[] = [];
    const steps: string[] = [];

    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForPage(page);

    steps.push(`Opened ${sourceUrl}.`);
    const consentStep = await acceptCookieBanners(page);

    if (consentStep) {
      steps.push(consentStep);
    }

    screenshots.push(
      await captureFrame({
        fileName: "capture-1.jpg",
        outputDir,
        page,
        productName,
        title: "entry screen",
        sourceUrl,
      }),
    );

    const instructions = enrichInstructions(parseInstructions(pathInstructions));

    for (const [index, instruction] of instructions.entries()) {
      steps.push(await runInstruction(page, instruction));
      screenshots.push(
        await captureFrame({
          fileName: `capture-${index + 2}.jpg`,
          outputDir,
          page,
          productName,
          title: instruction.raw,
          sourceUrl,
        }),
      );
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
        await new Promise((resolve) => setTimeout(resolve, 450));
        steps.push("Scrolled to capture more of the page.");
        screenshots.push(
          await captureFrame({
            fileName: `capture-${screenshots.length + 1}.jpg`,
            outputDir,
            page,
            productName,
            title: titles[screenshots.length - 1] ?? `screen ${screenshots.length + 1}`,
            sourceUrl,
          }),
        );
      }
    }

    return {
      screenshots: screenshots.slice(0, 8),
      steps: steps.slice(0, 10),
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
