import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { captureWebsiteScreenshots } from "./demo-video-capture";
import { fetchWithRetry } from "./retry";
import { researchWithTavily } from "./tavily";
import {
  type DemoVideo,
  type HyperFramesRenderSpec,
  type ProductDemoScreenshot,
  type ProviderReport,
  type Voiceover,
} from "./schemas";

type RenderDemoVideoInput = {
  projectId: string;
  demoVideo: DemoVideo;
  voiceover: Voiceover;
  captureSite?: boolean;
  baseUrl?: string;
  dryRun?: boolean;
  force?: boolean;
};

type RenderArtifact = {
  type: "video" | "voiceover";
  format: "mp4" | "wav";
  status: "pending" | "ready" | "failed";
  path: string;
  error?: string;
};

type RenderDemoVideoResult = {
  enabled: boolean;
  outputDir?: string;
  commands: string[];
  artifacts: RenderArtifact[];
  error?: string;
  videoUrl?: string;
  voiceover: Voiceover;
  gradium: ProviderReport;
};

type ResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type HyperFramesGeneration = {
  compositionHtml: string;
  demoSteps: string[];
  captions: string[];
  designNotes: string;
  researchSummary: string;
  durationSeconds: number;
};

const hyperFramesGenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["compositionHtml", "demoSteps", "captions", "designNotes", "researchSummary", "durationSeconds"],
  properties: {
    compositionHtml: { type: "string" },
    demoSteps: { type: "array", minItems: 1, maxItems: 9, items: { type: "string" } },
    captions: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
    designNotes: { type: "string" },
    researchSummary: { type: "string" },
    durationSeconds: { type: "integer", minimum: 18, maximum: 90 },
  },
} as const;

const PROJECT_STORAGE_ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const ALLOWED_GSAP_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
const HYPERFRAMES_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "worker-src 'none'",
].join("; ");

function safeProjectStorageId(projectId: string) {
  if (!PROJECT_STORAGE_ID_PATTERN.test(projectId)) {
    throw new Error("Invalid demo video id for video asset storage.");
  }

  return projectId;
}

export function outputDirForDemoVideo(projectId: string) {
  const outputRoot = process.env.PROOFPITCH_OUTPUT_DIR ?? (process.env.VERCEL ? os.tmpdir() : process.cwd());

  return path.join(outputRoot, ".proofpitch", "demo-video-assets", safeProjectStorageId(projectId));
}

export function renderedDemoVideoPath(projectId: string) {
  return path.join(outputDirForDemoVideo(projectId), "demo-video.mp4");
}

export function renderedDemoVideoUrl(projectId: string) {
  return `/api/demo-videos/${encodeURIComponent(projectId)}/video`;
}

export function renderedBrowserRecordingPath(projectId: string) {
  return path.join(outputDirForDemoVideo(projectId), "browser-recording.webm");
}

export function renderedBrowserRecordingUrl(projectId: string) {
  return `/api/demo-videos/${encodeURIComponent(projectId)}/recording`;
}

export function renderedVoiceoverPath(projectId: string) {
  return path.join(outputDirForDemoVideo(projectId), "voiceover.wav");
}

function absoluteUrl(baseUrl: string | undefined, urlPath: string) {
  return new URL(urlPath, baseUrl || "http://localhost:3000").toString();
}

function commandLine(command: string, args: string[]) {
  return [command, ...args.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg))].join(" ");
}

function renderWorkerEnabled() {
  return process.env.PROOFPITCH_ENABLE_LOCAL_RENDER === "1" || process.env.VERCEL === "1";
}

function hyperframesCommand() {
  return path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "hyperframes.cmd" : "hyperframes");
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
    `<rect width="1440" height="1000" fill="#edf4f1"/>`,
    `<rect x="48" y="48" width="1344" height="904" fill="#fffdf7" stroke="#111827" stroke-width="3"/>`,
    `<text x="96" y="170" font-family="Arial,sans-serif" font-size="62" font-weight="700" fill="#111827">${escapeXml(title).slice(0, 80)}</text>`,
    `<text x="96" y="238" font-family="Arial,sans-serif" font-size="26" fill="#475569">${escapeXml(reason).slice(0, 130)}</text>`,
    `<rect x="96" y="340" width="900" height="48" fill="#111827"/>`,
    `<rect x="96" y="430" width="1180" height="300" fill="#e0f2f1" stroke="#111827" stroke-width="2"/>`,
    `</svg>`,
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function fallbackScreenshots(renderSpec: HyperFramesRenderSpec, reason: string): ProductDemoScreenshot[] {
  const screenshots = renderSpec.screenshots.length
    ? renderSpec.screenshots
    : [
        {
          action: "open" as const,
          title: `${renderSpec.productName} product entry`,
          url: renderSpec.sourceUrl,
          alt: `${renderSpec.productName} product entry`,
        },
      ];

  return screenshots.slice(0, 4).map((screenshot, index) => ({
    ...screenshot,
    action: screenshot.action ?? (index === 0 ? "open" : "scroll"),
    alt: screenshot.alt || `${renderSpec.productName} demo step ${index + 1}`,
    target: screenshot.target ?? screenshot.title,
    url: placeholderScreenshotDataUrl(screenshot.title, reason),
  }));
}

function extractOutputText(data: ResponsesApiOutput): string | undefined {
  if (data.output_text) {
    return data.output_text;
  }

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return undefined;
}

function allowedAssetPath(value: string) {
  return (/^(?:\.\/)?assets\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes("..")) || value.startsWith("#");
}

function allowedDataUrl(value: string) {
  return value.toLowerCase().startsWith("data:image/");
}

function allowedHyperFramesResourceUrl(attributeName: string, value: string) {
  const trimmed = value.trim();
  const lowerAttributeName = attributeName.toLowerCase();

  if (!trimmed) {
    return true;
  }

  if (lowerAttributeName === "src" && trimmed === ALLOWED_GSAP_SCRIPT_URL) {
    return true;
  }

  return allowedDataUrl(trimmed) || allowedAssetPath(trimmed);
}

function assertSafeHyperFramesResources(html: string) {
  const forbiddenMarkup = [
    [/<(?:iframe|object|embed|base)\b/i, "iframes, objects, embeds, and base tags are not allowed."],
    [/<form\b/i, "Forms are not allowed inside render compositions."],
  ] as const;
  const forbiddenScript = [
    [/navigator\.sendBeacon\s*\(/, "Network beacons are not allowed inside the render composition."],
    [/\bXMLHttpRequest\b/, "XMLHttpRequest is not allowed inside the render composition."],
    [/\bWebSocket\b/, "WebSocket is not allowed inside the render composition."],
    [/\bEventSource\b/, "EventSource is not allowed inside the render composition."],
    [/\bimport\s*\(/, "Dynamic imports are not allowed inside the render composition."],
    [/\bwindow\.open\s*\(/, "Window navigation is not allowed inside the render composition."],
    [/\blocation\.(?:assign|replace|href)\b/, "Location navigation is not allowed inside the render composition."],
  ] as const;

  for (const [pattern, message] of [...forbiddenMarkup, ...forbiddenScript]) {
    if (pattern.test(html)) {
      throw new Error(`Generated HyperFrames HTML rejected: ${message}`);
    }
  }

  const attributePattern = /\b(src|href|poster|data|xlink:href)\s*=\s*(["'])(.*?)\2/gi;
  let attributeMatch: RegExpExecArray | null;

  while ((attributeMatch = attributePattern.exec(html))) {
    const [, attributeName, , rawValue] = attributeMatch;

    if (!allowedHyperFramesResourceUrl(attributeName, rawValue)) {
      throw new Error(`Generated HyperFrames HTML rejected: resource URL is not allowed: ${rawValue.slice(0, 120)}`);
    }
  }

  const cssUrlPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  let cssMatch: RegExpExecArray | null;

  while ((cssMatch = cssUrlPattern.exec(html))) {
    const rawValue = cssMatch[2];

    if (!allowedDataUrl(rawValue.trim()) && !allowedAssetPath(rawValue.trim())) {
      throw new Error(`Generated HyperFrames HTML rejected: CSS resource URL is not allowed: ${rawValue.slice(0, 120)}`);
    }
  }
}

function withHyperFramesSecurityPolicy(html: string) {
  assertSafeHyperFramesResources(html);

  if (/http-equiv\s*=\s*(["'])Content-Security-Policy\1/i.test(html)) {
    return html;
  }

  const meta = `<meta http-equiv="Content-Security-Policy" content="${HYPERFRAMES_CONTENT_SECURITY_POLICY}">`;

  if (!/<head\b[^>]*>/i.test(html)) {
    throw new Error("Generated HyperFrames HTML rejected: missing head element for render security policy.");
  }

  return html.replace(/<head\b([^>]*)>/i, `<head$1>\n    ${meta}`);
}

function assertSafeHyperFramesHtml(html: string) {
  const violations = [
    [/Math\.random\s*\(/, "Math.random is not deterministic."],
    [/Date\.now\s*\(/, "Date.now is not deterministic."],
    [/\bfetch\s*\(/, "Network fetches are not allowed inside the render composition."],
    [/setTimeout\s*\(/, "Asynchronous timeline construction is not allowed."],
    [/setInterval\s*\(/, "Asynchronous timeline construction is not allowed."],
    [/repeat\s*:\s*-1/, "Infinite repeats are not allowed."],
  ] as const;

  for (const [pattern, message] of violations) {
    if (pattern.test(html)) {
      throw new Error(`Generated HyperFrames HTML rejected: ${message}`);
    }
  }

  if (!html.includes("data-composition-id")) {
    throw new Error("Generated HyperFrames HTML is missing data-composition-id.");
  }

  if (!html.includes("window.__timelines")) {
    throw new Error("Generated HyperFrames HTML is missing timeline registration.");
  }

  assertSafeHyperFramesResources(html);
}

async function runCommand(command: string, args: string[], cwd = process.cwd()) {
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
      cwd,
      stdio: "pipe",
      shell: false,
      env: {
        ...process.env,
        ...writableNpmEnv,
      },
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error([stderr.trim(), stdout.trim()].filter(Boolean).join("\n") || `${command} exited with code ${code}`));
    });
  });
}

export async function prepareHyperFramesRenderSpec(
  projectId: string,
  outputDir: string,
  renderSpec: HyperFramesRenderSpec,
  captureSite: boolean,
  baseUrl?: string,
) {
  if (!captureSite) {
    return renderSpec;
  }

  let capture: Awaited<ReturnType<typeof captureWebsiteScreenshots>>;

  try {
    capture = await captureWebsiteScreenshots({
      outputDir: path.join(outputDir, "captures"),
      pathInstructions: renderSpec.demoPath,
      productName: renderSpec.productName,
      sourceUrl: renderSpec.sourceUrl,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Browser capture unavailable.";

    return {
      ...renderSpec,
      screenshots: fallbackScreenshots(renderSpec, reason),
      captions: [...renderSpec.captions, `Browser capture fallback: ${reason}`].slice(0, 6),
      researchSummary: [renderSpec.researchSummary, `Browser capture fallback: ${reason}`].filter(Boolean).join("\n"),
    };
  }

  const recordingPath = capture.recordingPath ? renderedBrowserRecordingPath(projectId) : undefined;

  if (capture.recordingPath && recordingPath) {
    await copyFile(capture.recordingPath, recordingPath);
  }

  let researchSummary = renderSpec.researchSummary ?? "";

  if (!renderSpec.demoPath?.trim()) {
    const tavily = await researchWithTavily(
      `${renderSpec.productName}: ${renderSpec.oneLiner}. Identify the best public product demo workflow.`,
      renderSpec.sourceUrl,
    );
    const sourceLines = tavily.sources
      .slice(0, 3)
      .map((source) => `- ${source.title}: ${source.content} (${source.url})`)
      .join("\n");

    researchSummary = [
      researchSummary,
      capture.siteSummary ? `Site inspection:\n${capture.siteSummary}` : "",
      tavily.answer ? `Tavily answer:\n${tavily.answer}` : "",
      sourceLines ? `Tavily sources:\n${sourceLines}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return {
    ...renderSpec,
    browserRecordingUrl: recordingPath ? absoluteUrl(baseUrl, renderedBrowserRecordingUrl(projectId)) : undefined,
    screenshots: capture.screenshots,
    demoSteps: capture.steps.length ? capture.steps : renderSpec.demoSteps,
    captions: [
      ...renderSpec.captions,
      `Captured ${capture.screenshots.length} screen${capture.screenshots.length === 1 ? "" : "s"} for ${projectId}.`,
    ].slice(0, 6),
    researchSummary,
  };
}

async function generateHyperFramesWithOpenAI(renderSpec: HyperFramesRenderSpec): Promise<HyperFramesGeneration> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate the HyperFrames video composition.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const recordingAsset = renderSpec.browserRecordingUrl ? "assets/browser-recording.webm" : null;
  const response = await fetchWithRetry(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: [
          "You generate production HyperFrames HTML for ProofPitch product demo videos.",
          "Return JSON only through the provided structured output schema.",
          "The HTML must be a standalone HyperFrames index.html file, not JSX and not markdown.",
          "Use deterministic HTML/CSS/GSAP only: no Math.random, Date.now, fetch, setTimeout, setInterval, async timeline construction, or repeat:-1.",
          `If GSAP is loaded externally, the only allowed external script is ${ALLOWED_GSAP_SCRIPT_URL}; no other network, file, blob, iframe, form, or CSS url() resources are allowed.`,
          "Register a paused GSAP timeline on window.__timelines using composition id proofpitch-product-demo.",
          "Every visible timed element must include class clip, data-start, data-duration, and data-track-index.",
          "Use the ProofPitch visual identity: pale green canvas, square bordered founder-tool panels, dense UI, restrained teal emphasis.",
          recordingAsset
            ? `The dominant visual surface must be the browser recording at ${recordingAsset}.`
            : "No browser recording is available; use the provided screenshot data URLs and an explicit capture-blocked frame.",
          "Use visible captions for every core beat; captions must still work when no voiceover audio exists.",
        ].join("\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Build a HyperFrames product walkthrough composition from this render spec.",
                  "",
                  JSON.stringify(
                    {
                      ...renderSpec,
                      browserRecordingUrl: recordingAsset,
                      screenshots: renderSpec.screenshots.slice(0, 6),
                    },
                    null,
                    2,
                  ),
                  "",
                  "Requirements:",
                  "- Respect demoPath if present.",
                  "- If demoPath is absent, use researchSummary and visible site context to choose the most compelling demo path.",
                  "- Do not include pitch decks, slide previews, or PDF export language.",
                  "- The final composition should be inspectable, not a generic promo.",
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "hyperframes_generation",
            strict: true,
            schema: hyperFramesGenerationJsonSchema,
          },
        },
        reasoning: {
          effort: "low",
        },
        max_output_tokens: 8000,
        store: false,
      }),
    },
    { timeoutMs: 90_000 },
  );
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI composition generation failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text) as ResponsesApiOutput;

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const outputText = extractOutputText(data);

  if (!outputText) {
    throw new Error("OpenAI returned no HyperFrames composition.");
  }

  const generated = JSON.parse(outputText) as HyperFramesGeneration;
  const secureHtml = withHyperFramesSecurityPolicy(generated.compositionHtml);

  assertSafeHyperFramesHtml(secureHtml);

  return {
    ...generated,
    compositionHtml: secureHtml,
  };
}

async function writeHyperFramesProject({
  generated,
  projectDir,
  renderSpec,
}: {
  generated: HyperFramesGeneration;
  projectDir: string;
  renderSpec: HyperFramesRenderSpec;
}) {
  const assetsDir = path.join(projectDir, "assets");

  await mkdir(assetsDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "hyperframes.json"),
    JSON.stringify(
      {
        $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
        registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
        paths: {
          blocks: "compositions",
          components: "compositions/components",
          assets: "assets",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    path.join(projectDir, "DESIGN.md"),
    [
      "# ProofPitch HyperFrames Visual Identity",
      "",
      renderSpec.designNotes ?? generated.designNotes,
      "",
      "Use the real browser recording as the source of truth. Keep panels square, typography compact, captions readable, and motion precise.",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(projectDir, "index.html"), generated.compositionHtml, "utf8");
}

export async function synthesizeVoiceoverForDemo({
  outputDir,
  script,
}: {
  outputDir: string;
  script: string;
}): Promise<{ voiceover: Voiceover; path?: string; report: ProviderReport }> {
  const apiKey = process.env.GRADIUM_API_KEY;
  const voiceId = process.env.GRADIUM_VOICE_ID;

  if (!apiKey || !voiceId) {
    const missing = [
      !apiKey ? "GRADIUM_API_KEY" : null,
      !voiceId ? "GRADIUM_VOICE_ID" : null,
    ]
      .filter(Boolean)
      .join(" and ");

    return {
      voiceover: {
        status: "captions_only",
        provider: "gradium",
        script,
        reason: `${missing} not configured. Rendered with visible captions only.`,
      },
      report: {
        state: "missing",
        detail: `${missing} not configured; using captions-only video.`,
      },
    };
  }

  try {
    const response = await fetchWithRetry(
      "https://api.gradium.ai/api/post/speech/tts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          text: script,
          voice_id: voiceId,
          output_format: "wav",
          only_audio: true,
        }),
      },
      { timeoutMs: 90_000 },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gradium TTS failed with HTTP ${response.status}: ${detail.slice(0, 500)}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const audioPath = path.join(outputDir, "voiceover.wav");

    await writeFile(audioPath, bytes);

    return {
      path: audioPath,
      voiceover: {
        status: "ready",
        provider: "gradium",
        script,
        audioUrl: audioPath,
      },
      report: {
        state: "used",
        detail: "Gradium generated WAV voiceover for the demo video.",
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Gradium error.";

    return {
      voiceover: {
        status: "failed",
        provider: "gradium",
        script,
        reason: detail.replace(/\s+/g, " ").slice(0, 800),
      },
      report: {
        state: "failed",
        detail: `Gradium voiceover failed: ${detail.replace(/\s+/g, " ").slice(0, 800)}`,
      },
    };
  }
}

async function renderDemoVideoWithHyperFrames({
  outputDir,
  renderSpec,
  videoPath,
  voiceoverPath,
}: {
  outputDir: string;
  renderSpec: HyperFramesRenderSpec;
  videoPath: string;
  voiceoverPath?: string;
}) {
  const generated = renderSpec.compositionHtml
    ? {
        compositionHtml: withHyperFramesSecurityPolicy(renderSpec.compositionHtml),
        demoSteps: renderSpec.demoSteps,
        captions: renderSpec.captions,
        designNotes: renderSpec.designNotes ?? "ProofPitch HyperFrames composition.",
        researchSummary: renderSpec.researchSummary ?? "",
        durationSeconds: 24,
      }
    : await generateHyperFramesWithOpenAI(renderSpec);
  const projectDir = path.join(outputDir, "hyperframes");
  const rawVideoPath = voiceoverPath ? path.join(outputDir, "demo-video-silent.mp4") : videoPath;

  assertSafeHyperFramesHtml(generated.compositionHtml);

  await writeHyperFramesProject({
    generated,
    projectDir,
    renderSpec,
  });

  const recordingPath = path.join(outputDir, "browser-recording.webm");

  if (renderSpec.browserRecordingUrl && recordingPath) {
    await mkdir(path.join(projectDir, "assets"), { recursive: true });
    await copyFile(recordingPath, path.join(projectDir, "assets", "browser-recording.webm")).catch(() => undefined);
  }

  const hyperframes = hyperframesCommand();

  await runCommand(hyperframes, ["lint"], projectDir);
  await runCommand(hyperframes, ["validate"], projectDir);
  await runCommand(hyperframes, ["inspect"], projectDir);
  await runCommand(hyperframes, ["render", "--output", rawVideoPath, "--quality", "standard", "--workers", "1"], projectDir);

  if (voiceoverPath) {
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      rawVideoPath,
      "-i",
      voiceoverPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      videoPath,
    ]);
  }
}

export async function renderDemoVideoArtifacts({
  baseUrl,
  projectId,
  demoVideo,
  voiceover,
  captureSite = true,
  dryRun = false,
  force = false,
}: RenderDemoVideoInput): Promise<RenderDemoVideoResult> {
  const disabledVoiceover: Voiceover = {
    ...voiceover,
    status: voiceover.status === "pending" ? "captions_only" : voiceover.status,
    reason: voiceover.reason ?? "Render worker is disabled.",
  };

  if (!force && !renderWorkerEnabled()) {
    return {
      enabled: false,
      commands: [],
      artifacts: [],
      voiceover: disabledVoiceover,
      gradium: {
        state: "pending",
        detail: "Render worker is disabled.",
      },
    };
  }

  const outputDir = outputDirForDemoVideo(projectId);
  const specPath = path.join(outputDir, "hyperframes-spec.json");
  const videoPath = renderedDemoVideoPath(projectId);
  const hyperframes = hyperframesCommand();
  const renderSpecExists = Boolean(demoVideo.renderSpec);
  const voiceoverCommand = process.env.GRADIUM_API_KEY && process.env.GRADIUM_VOICE_ID
    ? "POST https://api.gradium.ai/api/post/speech/tts"
    : "captions-only voiceover fallback";
  const commands = renderSpecExists
    ? [
        voiceoverCommand,
        commandLine(hyperframes, ["lint"]),
        commandLine(hyperframes, ["validate"]),
        commandLine(hyperframes, ["inspect"]),
        commandLine(hyperframes, ["render", "--output", videoPath, "--quality", "standard", "--workers", "1"]),
      ]
    : [];
  const artifacts: RenderArtifact[] = renderSpecExists
    ? [
        {
          type: "video",
          format: "mp4",
          status: "pending",
          path: videoPath,
        },
      ]
    : [];

  if (!renderSpecExists) {
    return {
      enabled: true,
      outputDir,
      commands,
      artifacts: [],
      voiceover: {
        ...voiceover,
        status: "failed",
        reason: "Demo video render spec is missing.",
      },
      gradium: {
        state: "pending",
        detail: "Voiceover was not attempted because the render spec is missing.",
      },
      error: "Demo video render spec is missing.",
    };
  }

  if (dryRun) {
    return {
      enabled: true,
      outputDir,
      commands,
      artifacts,
      videoUrl: renderedDemoVideoUrl(projectId),
      voiceover,
      gradium: {
        state: "pending",
        detail: "Dry run only; Gradium voiceover was not requested.",
      },
    };
  }

  try {
    await mkdir(outputDir, { recursive: true });

    const renderSpec = await prepareHyperFramesRenderSpec(
      projectId,
      outputDir,
      demoVideo.renderSpec as HyperFramesRenderSpec,
      captureSite,
      baseUrl,
    );
    const voiceoverResult = await synthesizeVoiceoverForDemo({
      outputDir,
      script: voiceover.script,
    });
    const voiceoverArtifacts: RenderArtifact[] = voiceoverResult.path
      ? [
          {
            type: "voiceover",
            format: "wav",
            status: "ready",
            path: voiceoverResult.path,
          },
        ]
      : [];

    await writeFile(
      specPath,
      JSON.stringify(
        {
          ...renderSpec,
          voiceoverScript: voiceoverResult.voiceover.script,
        },
        null,
        2,
      ),
      "utf8",
    );
    await renderDemoVideoWithHyperFrames({
      outputDir,
      renderSpec: {
        ...renderSpec,
        voiceoverScript: voiceoverResult.voiceover.script,
      },
      videoPath,
      voiceoverPath: voiceoverResult.path,
    });

    artifacts[0] = {
      ...artifacts[0],
      status: "ready",
    };

    return {
      enabled: true,
      outputDir,
      commands,
      artifacts: [...artifacts, ...voiceoverArtifacts],
      videoUrl: renderedDemoVideoUrl(projectId),
      voiceover: voiceoverResult.voiceover,
      gradium: voiceoverResult.report,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo video renderer failed.";

    return {
      enabled: true,
      outputDir,
      commands,
      artifacts: artifacts.map((artifact) => ({
        ...artifact,
        status: artifact.status === "pending" ? "failed" : artifact.status,
        error: artifact.status === "pending" ? message : artifact.error,
      })),
      voiceover: {
        ...voiceover,
        status: "failed",
        reason: message,
      },
      gradium: {
        state: "pending",
        detail: "Voiceover state is included in the render error payload.",
      },
      error: message,
    };
  }
}
