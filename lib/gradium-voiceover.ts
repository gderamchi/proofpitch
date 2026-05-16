import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type VoiceoverSegmentInput = {
  outputDir: string;
  steps: string[];
};

type VoiceoverSegment = {
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

function lineForStep(step: string, index: number) {
  const cleanStep = step.replace(/\s+/g, " ").trim();

  if (/^Opened\s+/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Opened\s+/i, ""));

    return `Opening ${target} to start the product walkthrough.`;
  }

  if (/^Handled consent banner/i.test(cleanStep)) {
    return "Clearing the consent banner so the demo can continue.";
  }

  if (/^Clicked\s+/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Clicked\s+/i, ""));

    return `Clicking ${target} to move through the flow.`;
  }

  if (/^Searched for\s+/i.test(cleanStep)) {
    const target = cleanSpokenTarget(cleanStep.replace(/^Searched for\s+/i, ""));

    return `Searching for ${target} inside the interface.`;
  }

  if (/^Opened first result/i.test(cleanStep)) {
    return "Opening the first relevant result to continue the demo.";
  }

  if (/^Scrolled page:\s*scroll down/i.test(cleanStep)) {
    return "Scrolling down to reveal the next part of the page.";
  }

  if (/^Scrolled page:/i.test(cleanStep)) {
    return "Continuing the scroll to highlight the important content.";
  }

  if (/^Could not find/i.test(cleanStep)) {
    return "The agent is looking for the requested element and adapting the path.";
  }

  return index === 0
    ? "Starting the navigation on the site."
    : "Continuing the walkthrough to build the demo.";
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

  return { skipped: false };
}

export async function buildGradiumVoiceoverSegments({
  outputDir,
  steps,
}: VoiceoverSegmentInput): Promise<VoiceoverResult> {
  const voiceoverDir = path.join(outputDir, "voiceover");
  const config = await getGradiumConfig();
  const segments: VoiceoverSegment[] = steps.slice(0, 10).map((step, index) => ({
    text: lineForStep(step, index),
  }));

  if (!config.apiKey) {
    return { segments };
  }

  try {
    await mkdir(voiceoverDir, { recursive: true });

    for (const [index, segment] of segments.entries()) {
      const outputPath = path.join(voiceoverDir, `segment-${index + 1}.wav`);
      const result = await synthesizeWithGradium(segment.text, outputPath, config);

      if (!result.skipped) {
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
