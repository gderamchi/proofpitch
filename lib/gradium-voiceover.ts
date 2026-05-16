import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type VoiceoverSegmentInput = {
  companyDescription?: string;
  oneLiner?: string;
  outputDir: string;
  productName: string;
  sourceUrl: string;
  steps: string[];
};

type VoiceoverSegment = {
  durationSeconds?: number;
  path?: string;
  text: string;
};

type VoiceoverResult = {
  error?: string;
  segments: VoiceoverSegment[];
};

const DEFAULT_GRADIUM_VOICE_ID = "YTpq7expH9539ERJ";
const DEFAULT_GRADIUM_API_BASE_URL = "https://api.gradium.ai";
const GRADIUM_ENV_FILES = [".env.local", ".env.development.local", ".env"];

type GradiumConfig = {
  apiKey?: string;
  baseUrl: string;
  voiceId: string;
};

function parseEnvFile(source: string) {
  const entries = new Map<string, string>();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "").trim();

    entries.set(key, value);
  }

  return entries;
}

async function readLocalGradiumConfig() {
  const config = new Map<string, string>();

  for (const fileName of GRADIUM_ENV_FILES) {
    const filePath = path.join(/* turbopackIgnore: true */ process.cwd(), fileName);
    const source = await readFile(filePath, "utf8").catch(() => null);

    if (!source) {
      continue;
    }

    for (const [key, value] of parseEnvFile(source)) {
      if (key.startsWith("GRADIUM_") && value) {
        config.set(key, value);
      }
    }
  }

  return config;
}

function normalizeGradiumBaseUrl(value: string) {
  return value.replace(/\/+$/, "").replace(/\/api$/i, "");
}

async function getGradiumConfig(): Promise<GradiumConfig> {
  const local = await readLocalGradiumConfig();

  return {
    apiKey: process.env.GRADIUM_API_KEY || local.get("GRADIUM_API_KEY"),
    baseUrl: normalizeGradiumBaseUrl(
      process.env.GRADIUM_API_BASE_URL || local.get("GRADIUM_API_BASE_URL") || DEFAULT_GRADIUM_API_BASE_URL,
    ),
    voiceId: process.env.GRADIUM_VOICE_ID || local.get("GRADIUM_VOICE_ID") || DEFAULT_GRADIUM_VOICE_ID,
  };
}

function cleanSpokenTarget(value: string) {
  return value
    .replace(/^["“”]+|["“”.,]+$/g, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .trim();
}

function hostFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function shortSentence(value: string | undefined, maxWords = 12) {
  const cleanValue = value?.replace(/\s+/g, " ").replace(/[.!?]+$/g, "").trim();

  if (!cleanValue) {
    return "";
  }

  const words = cleanValue.split(" ");
  const clippedWords = words.length > maxWords ? words.slice(0, maxWords) : words;

  while (
    clippedWords.length > 1 &&
    /^(a|an|the|and|or|but|with|for|to|into|from|of|in|on)$/i.test(clippedWords[clippedWords.length - 1])
  ) {
    clippedWords.pop();
  }

  return clippedWords.join(" ");
}

function estimateSpeechSeconds(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;

  return Math.max(3.4, Math.min(7.6, words / 2.35 + 1.2));
}

function safeSpeechSeconds(measuredSeconds: number | undefined, text: string) {
  const estimate = estimateSpeechSeconds(text);

  if (!measuredSeconds || !Number.isFinite(measuredSeconds) || measuredSeconds <= 0) {
    return estimate;
  }

  if (measuredSeconds > 18 || measuredSeconds > estimate * 2.4) {
    return estimate;
  }

  return Math.max(2.6, measuredSeconds);
}

function wavDurationSeconds(buffer: Buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return undefined;
  }

  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt " && chunkSize >= 16) {
      byteRate = buffer.readUInt32LE(chunkDataOffset + 8);
    }

    if (chunkId === "data") {
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  return byteRate > 0 && dataSize > 0 ? dataSize / byteRate : undefined;
}

function salesFrameForTarget(target: string) {
  const normalized = target.toLowerCase();

  if (/pricing|price|plan|tarif|cost|billing/.test(normalized)) {
    return "turns the value story into a practical buying decision";
  }

  if (/secteur|sectors|industry|industries|use case|use cases|solution/.test(normalized)) {
    return "makes the product relevant to a specific buyer segment";
  }

  if (/case|customer|testimonial|review|story|proof/.test(normalized)) {
    return "adds the proof buyers need before they trust a new product";
  }

  if (/contact|demo|book|start|signup|sign up|get started|try/.test(normalized)) {
    return "makes the next step clear while intent is still high";
  }

  if (/feature|product|solution|platform|how it works/.test(normalized)) {
    return "turns the promise into something concrete";
  }

  return "adds one more useful layer to the product story";
}

function scrollLineForStep(index: number) {
  const lines = [
    "This section builds confidence by connecting the headline promise to concrete details.",
    "The page now gives buyers more context, which makes the offer easier to understand.",
    "These details matter because they turn a broad claim into a more specific product story.",
    "A strong product page keeps momentum by making the next step feel natural.",
    "By this point, the value should feel clear without asking the buyer to work too hard.",
  ];

  return lines[Math.min(Math.max(index - 1, 0), lines.length - 1)];
}

function observationPart(observation: string, label: string) {
  const match = observation.match(new RegExp(`${label}:\\s*([^|]+)`, "i"));

  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function lineForObservation(step: string) {
  const observation = step.replace(/^Observed page:\s*/i, "").trim();
  const headline = shortSentence(observationPart(observation, "headline"), 16);
  const details = shortSentence(observationPart(observation, "details"), 18);
  const options = shortSentence(observationPart(observation, "visible options"), 13);

  if (headline) {
    return `The page leads with ${headline}, which gives buyers a clear first reason to care.`;
  }

  if (details) {
    return `${details} gives the buyer a more concrete view of the product.`;
  }

  if (options) {
    return `The visible navigation points to ${options}, which helps buyers find the part most relevant to them.`;
  }

  return "The page keeps the story grounded in what buyers can actually see and evaluate.";
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

function lineForStep(
  step: string,
  index: number,
  {
    oneLiner,
    productName,
    sourceUrl,
  }: {
    oneLiner?: string;
    productName: string;
    sourceUrl: string;
  },
) {
  const cleanStep = step.replace(/\s+/g, " ").trim();
  const product = shortSentence(cleanSpokenTarget(productName || sourceUrl), 4) || "the product";
  const promise = shortSentence(oneLiner, 16);
  const host = hostFromUrl(sourceUrl).toLowerCase();
  const promiseStartsWithHost = Boolean(host && promise.toLowerCase().startsWith(host));

  if (/^Observed page:/i.test(cleanStep)) {
    return lineForObservation(cleanStep);
  }

  if (/^Opened first result/i.test(cleanStep)) {
    return "The selected result adds evidence and keeps the buyer moving from curiosity to confidence.";
  }

  if (/^Opened\s+/i.test(cleanStep)) {
    return promise && !promiseStartsWithHost
      ? `${product} starts with a clear promise: ${promise}.`
      : `${product} opens with a simple job: make the product outcome obvious quickly.`;
  }

  if (/^Handled consent banner/i.test(cleanStep)) {
    return "With the page fully visible, the product has a clean moment to make its value clear.";
  }

  if (/^Clicked\s+/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Clicked\s+/i, ""));

    return target
      ? `${target} ${salesFrameForTarget(target)}.`
      : "The next screen keeps the buyer focused on value, proof, and a clear next step.";
  }

  if (/^Explored page:\s*/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Explored page:\s*/i, ""));

    return target
      ? `${target} ${salesFrameForTarget(target)}.`
      : "The next section adds useful context without leaving the buyer on a static landing page.";
  }

  if (/^Searched for\s+/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Searched for\s+/i, ""));

    return target
      ? `For buyers asking about ${target}, the product needs to answer quickly and concretely.`
      : "Search helps buyers reach the answer they came for without extra friction.";
  }

  if (/^Scrolled page:\s*scroll down/i.test(cleanStep)) {
    return scrollLineForStep(index);
  }

  if (/^Scrolled page:/i.test(cleanStep)) {
    return scrollLineForStep(index);
  }

  if (/^Scrolled\b/i.test(cleanStep)) {
    return scrollLineForStep(index);
  }

  if (/^Could not find/i.test(cleanStep)) {
    return "Even when the layout changes, the strongest demos stay focused on the buyer outcome.";
  }

  return index === 0
    ? `${product} needs to make the product outcome visible from the first screen.`
    : "Each visible moment should answer the next question a buyer would naturally ask.";
}

function buildSalesNarration({
  companyDescription,
  oneLiner,
  productName,
  sourceUrl,
  steps,
}: {
  companyDescription?: string;
  oneLiner?: string;
  productName: string;
  sourceUrl: string;
  steps: string[];
}) {
  const desiredSegments = 16;
  const product = shortSentence(cleanSpokenTarget(productName || sourceUrl), 4) || "the product";
  const company = shortSentence(companyDescription, 18);
  const promise = shortSentence(oneLiner, 14);
  const stepLines = steps
    .slice(1, 18)
    .map((step, index) => lineForStep(step, index + 1, { oneLiner, productName, sourceUrl }));
  const intro = company
    ? `This is ${product}: ${company}.`
    : `${product} gives buyers a clear product story from the first screen.`;
  const promiseLine = promise
    ? `The promise is simple: ${promise}.`
    : "The product needs to make its value clear before the buyer loses momentum.";
  const supportLines = [
    "A strong product demo makes the buyer feel oriented, not overloaded.",
    "The best moments are the ones that connect a clear claim to visible proof.",
    "Use cases help the buyer recognize themselves inside the product.",
    "Specific pages make the offer easier to trust because they reduce ambiguity.",
    "Every section should make the next question easier to answer.",
    "The product feels stronger when the site shows who it helps and why now.",
    "Practical details keep the story credible without turning the demo into a feature list.",
    "By the end, the buyer should understand the product, the audience, and the next step.",
  ];
  const fallbackLines = [
    `${product} keeps the buyer focused on a concrete business outcome.`,
    "This section adds another useful reason to keep exploring the product.",
    "The website keeps building trust by making the offer more specific.",
  ];
  const lines = uniqueLines([intro, promiseLine, ...stepLines, ...supportLines]);

  while (lines.length < desiredSegments) {
    lines.push(fallbackLines[lines.length % fallbackLines.length]);
  }

  return lines.slice(0, desiredSegments).map((line) => ({
    durationSeconds: estimateSpeechSeconds(line),
    text: line,
  }));
}

async function synthesizeWithGradium(text: string, outputPath: string, config: GradiumConfig) {
  if (!config.apiKey) {
    return { skipped: true };
  }

  const response = await fetch(`${config.baseUrl}/api/post/speech/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({
      only_audio: true,
      output_format: "wav",
      text,
      voice_id: config.voiceId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new Error(`Gradium TTS failed with ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());

  await writeFile(outputPath, audio);

  return { durationSeconds: safeSpeechSeconds(wavDurationSeconds(audio), text), skipped: false };
}

export async function buildGradiumVoiceoverSegments({
  companyDescription,
  oneLiner,
  outputDir,
  productName,
  steps,
  sourceUrl,
}: VoiceoverSegmentInput): Promise<VoiceoverResult> {
  const voiceoverDir = path.join(outputDir, "voiceover");
  const config = await getGradiumConfig();
  const segments: VoiceoverSegment[] = buildSalesNarration({
    companyDescription,
    oneLiner,
    productName,
    sourceUrl,
    steps,
  });

  if (!config.apiKey) {
    return { segments };
  }

  try {
    await mkdir(voiceoverDir, { recursive: true });

    for (const [index, segment] of segments.entries()) {
      const outputPath = path.join(voiceoverDir, `segment-${index + 1}.wav`);
      const result = await synthesizeWithGradium(segment.text, outputPath, config);

      if (!result.skipped) {
        segment.durationSeconds = result.durationSeconds;
        segment.path = outputPath;
      }
    }

    return { segments };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Gradium voiceover generation failed.",
      segments,
    };
  }
}
