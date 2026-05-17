import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalStoreForTests } from "../lib/local-store";
import {
  CreateDemoVideoRequestSchema,
  DemoVideoProjectSchema,
  HyperFramesRenderSpecSchema,
  type CreateDemoVideoRequest,
  type DemoVideoProject,
} from "../lib/schemas";

const sampleInput: CreateDemoVideoRequest = {
  sourceUrl: "https://example.com",
  productName: "ProofPitch",
  targetAudience: "Founder-led B2B teams",
  demoGoal: "Show a generated product demo video.",
  demoInstructions: "Open the page, render the video, then play the MP4.",
};

function clearProviderEnv() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.TAVILY_API_KEY;
  delete process.env.PIONEER_API_KEY;
  delete process.env.GRADIUM_API_KEY;
  delete process.env.GRADIUM_VOICE_ID;
  delete process.env.PROOFPITCH_ENABLE_LOCAL_RENDER;
  delete process.env.PROOFPITCH_PLAYWRIGHT_CAPTURE;
}

beforeEach(() => {
  clearProviderEnv();
  resetLocalStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearProviderEnv();
});

describe("demo video schemas", () => {
  it("validates the video-first request contract and rejects deck mode", () => {
    expect(CreateDemoVideoRequestSchema.parse(sampleInput)).toMatchObject({
      productName: "ProofPitch",
      demoGoal: "Show a generated product demo video.",
    });
    expect(() =>
      CreateDemoVideoRequestSchema.parse({
        ...sampleInput,
        sourceUrl: "not-a-url",
      }),
    ).toThrow();
    expect(() =>
      CreateDemoVideoRequestSchema.strict().parse({
        ...sampleInput,
        deckMode: "sales",
      }),
    ).toThrow();
    expect(() =>
      CreateDemoVideoRequestSchema.parse({
        ...sampleInput,
        sourceUrl: "file:///etc/passwd",
      }),
    ).toThrow();
  });

  it("validates HyperFrames render specs with voiceover script metadata", () => {
    const spec = HyperFramesRenderSpecSchema.parse({
      productName: "ProofPitch",
      oneLiner: "Proof-aware demo video.",
      sourceUrl: "https://example.com",
      screenshots: [
        {
          title: "Home",
          url: "data:image/svg+xml;base64,PHN2Zy8+",
          alt: "Home screen",
        },
      ],
      demoSteps: ["Open the product."],
      captions: ["Proof-aware captions."],
      voiceoverScript: "Open the product and narrate the generated walkthrough.",
    });

    expect(spec.voiceoverScript).toContain("generated walkthrough");
  });
});

describe("public URL guards", () => {
  it("blocks local and private addresses before browser capture", async () => {
    const { assertPublicHttpUrl } = await import("../lib/public-url");

    await expect(assertPublicHttpUrl("http://localhost:3000")).rejects.toThrow("public HTTP(S) host");
    await expect(assertPublicHttpUrl("http://127.0.0.1:54322")).rejects.toThrow("public HTTP(S) host");
    await expect(assertPublicHttpUrl("http://10.0.0.8")).rejects.toThrow("public HTTP(S) host");
  });
});

describe("demo video service", () => {
  it("creates a fallback demo project with automatic narration context", async () => {
    const service = await import("../lib/demo-video-service");
    const created = await service.createDemoVideoProject(sampleInput);

    expect(DemoVideoProjectSchema.parse(created)).toMatchObject({
      productName: "ProofPitch",
      proofReview: { status: "approved" },
      demoVideo: { status: "pending", renderer: "hyperframes" },
      voiceover: { status: "pending", provider: "gradium" },
    });
    expect(created).not.toHaveProperty("pitchDeck");
    expect(created).not.toHaveProperty("deckMode");

    const detail = await service.getDemoVideoProjectDetail(created.id);
    expect(created.voiceover.script).toContain(sampleInput.productName);
    expect(created.captions.join(" ")).not.toContain("Proof:");
    expect(detail?.project.proofReview.status).toBe("approved");
  });

  it("supports public render fallback bodies when the render worker is disabled", async () => {
    const service = await import("../lib/demo-video-service");
    const created = await service.createDemoVideoProject(sampleInput);
    const result = await service.startDemoVideoRender(created.id, {
      captureSite: true,
      dryRun: false,
      project: created,
      renderVideo: true,
    });

    expect(result?.render.enabled).toBe(false);
    expect(result?.project.voiceover.status).toBe("captions_only");
    expect(result?.project.voiceover.reason).toContain("Render worker is disabled");
    expect(result?.videoUrl).toBeUndefined();
  });
});

describe("demo video routes", () => {
  it("creates and returns disabled render state through public API routes", async () => {
    const { POST: create } = await import("../app/api/demo-videos/route");
    const { POST: render } = await import("../app/api/demo-videos/[id]/render/route");

    const createdResponse = await create(
      new Request("https://proofpitch.test/api/demo-videos", {
        method: "POST",
        body: JSON.stringify(sampleInput),
      }),
    );
    const created = (await createdResponse.json()) as DemoVideoProject;

    expect(createdResponse.status).toBe(200);
    expect(created.proofReview.status).toBe("approved");

    const renderResponse = await render(
      new Request(`https://proofpitch.test/api/demo-videos/${created.id}/render`, {
        method: "POST",
        body: JSON.stringify({
          captureSite: true,
          dryRun: false,
          project: created,
          renderVideo: true,
        }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const rendered = await renderResponse.json();

    expect(renderResponse.status).toBe(200);
    expect(rendered.render.enabled).toBe(false);
    expect(rendered.project.voiceover.status).toBe("captions_only");
  });
});

describe("video renderer voiceover behavior", () => {
  it("fills required HyperFrames root attributes when GPT omits them", async () => {
    const { ensureHyperFramesCompositionRoot } = await import("../lib/demo-video-renderer");
    const html = '<main class="shell" data-composition-id="proofpitch-product-demo"><div></div></main>';
    const normalized = ensureHyperFramesCompositionRoot(html, 24);

    expect(normalized).toContain('data-composition-id="proofpitch-product-demo"');
    expect(normalized).toContain('data-start="0"');
    expect(normalized).toContain('data-duration="24"');
    expect(normalized).toContain('data-width="1920"');
    expect(normalized).toContain('data-height="1080"');
  });

  it("returns captions-only voiceover when Gradium is not configured", async () => {
    const { synthesizeVoiceoverForDemo } = await import("../lib/demo-video-renderer");
    const tmp = await mkdtemp(path.join(os.tmpdir(), "proofpitch-voiceover-"));

    try {
      const result = await synthesizeVoiceoverForDemo({
        outputDir: tmp,
        script: "Narrate the generated walkthrough.",
      });

      expect(result.voiceover.status).toBe("captions_only");
      expect(result.report.state).toBe("missing");
      expect(result.path).toBeUndefined();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("writes Gradium WAV bytes when voiceover is configured", async () => {
    process.env.GRADIUM_API_KEY = "gradium-test-key";
    process.env.GRADIUM_VOICE_ID = "voice-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 })),
    );
    const { synthesizeVoiceoverForDemo } = await import("../lib/demo-video-renderer");
    const tmp = await mkdtemp(path.join(os.tmpdir(), "proofpitch-voiceover-"));

    try {
      const result = await synthesizeVoiceoverForDemo({
        outputDir: tmp,
        script: "Narrate the generated walkthrough.",
      });

      expect(result.voiceover.status).toBe("ready");
      expect(result.report.state).toBe("used");
      expect(result.path).toBe(path.join(tmp, "voiceover.wav"));
      expect(await readFile(result.path as string)).toEqual(Buffer.from([82, 73, 70, 70]));
      expect(fetch).toHaveBeenCalledWith(
        "https://eu.api.gradium.ai/api/post/speech/tts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-api-key": "gradium-test-key",
          }),
        }),
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("dry-runs video-only HyperFrames commands without Slidev artifacts", async () => {
    process.env.PROOFPITCH_ENABLE_LOCAL_RENDER = "1";
    const { renderDemoVideoArtifacts } = await import("../lib/demo-video-renderer");
    const result = await renderDemoVideoArtifacts({
      projectId: "demo-1",
      dryRun: true,
      demoVideo: {
        status: "pending",
        uploadStatus: "pending",
        renderer: "hyperframes",
        renderSpec: {
          productName: "ProofPitch",
          oneLiner: "Proof-aware demo video.",
          sourceUrl: "https://example.com",
          screenshots: [],
          demoSteps: ["Open the product."],
          captions: ["Proof-aware captions."],
        },
      },
      voiceover: {
        status: "pending",
        provider: "gradium",
        script: "Narrate the generated walkthrough.",
      },
    });

    expect(result.enabled).toBe(true);
    expect(result.videoUrl).toBe("/api/demo-videos/demo-1/video");
    expect(result.artifacts).toEqual([
      expect.objectContaining({ type: "video", format: "mp4", status: "pending" }),
    ]);
    expect(result.commands.join("\n")).toContain("hyperframes");
    expect(result.commands.join("\n")).not.toContain("slidev");
  });
});
