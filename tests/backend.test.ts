import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPitchPackMarkdown } from "../lib/markdown-export";
import { providerFailed } from "../lib/providers";
import {
  CreateLaunchPackRequestSchema,
  GeneratePitchPackRequestSchema,
  LaunchPackSchema,
  PitchPackSchema,
  PitchDeckSchema,
  RemotionRenderPropsSchema,
  type PitchPack,
} from "../lib/schemas";

const mockState = vi.hoisted(() => ({
  admin: null as MockSupabaseAdmin | null,
  user: null as { id: string; email: string } | null,
}));

const stripeState = vi.hoisted(() => ({
  instances: [] as Array<{ secret: string; apiVersion?: string }>,
  checkoutSessions: [] as Array<Record<string, unknown>>,
  webhookConstructions: [] as Array<{ payload: string; signature: string | null; secret: string }>,
}));

function buildPitchPack(rawInput = "ProofPitch turns notes into verified pitch packs."): PitchPack {
  return {
    projectName: "ProofPitch",
    oneLiner: "ProofPitch turns rough founder notes into verified pitch packs.",
    targetUser: "Founder-led B2B teams.",
    problem: "Pitch material mixes reusable story with unsupported claims.",
    solution: "ProofPitch creates a claim ledger before reusable copy.",
    whyNow: "AI copy is easy to generate, but source-backed claims are harder to trust.",
    executivePitch: `ProofPitch starts from this input: ${rawInput}`,
    demoScript2Min: "Paste context, generate the pack, review the claim ledger, then export Markdown.",
    liveDemoSteps: ["Paste context", "Generate pack", "Review claims", "Export Markdown"],
    claims: [
      {
        id: "claim-1",
        text: "ProofPitch creates a claim ledger.",
        status: "supported",
        sourceType: "user_input",
        sourceTitle: "Founder note",
        sourceUrl: null,
        explanation: "The user provided this capability in the input.",
      },
      {
        id: "claim-2",
        text: "ProofPitch improves conversion by 40%.",
        status: "unsupported",
        sourceType: "inference",
        sourceTitle: null,
        sourceUrl: null,
        explanation: "No source supports this metric.",
      },
    ],
    readmeSnippet: "ProofPitch turns rough notes into verified pitch packs.",
    providerUsage: {
      openai: "Structured generation.",
      tavily: "Research sources.",
      pioneer: "Claim extraction.",
    },
    risks: ["Verification is evidence-aided, not a legal guarantee."],
    nextSteps: ["Connect Supabase and export Markdown."],
  };
}

class MockQueryBuilder {
  private filters: Array<{ column: string; value: unknown }> = [];
  private payload: unknown;
  private operation: "select" | "insert" | "upsert" | "update" = "select";
  private inserted: unknown[] | null = null;

  constructor(
    private admin: MockSupabaseAdmin,
    private table: keyof MockSupabaseAdmin["tables"],
  ) {}

  select() {
    this.operation = this.operation === "select" ? "select" : this.operation;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  limit() {
    return this;
  }

  order() {
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  async maybeSingle() {
    const result = await this.resolve();
    const rows = Array.isArray(result.data) ? result.data : [];

    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const result = await this.resolve();
    const rows = Array.isArray(result.data) ? result.data : [result.data];

    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve() {
    if (this.operation === "insert") {
      return { data: this.ensureInserted(), error: null };
    }

    if (this.operation === "upsert") {
      const row = this.payload as Record<string, unknown>;
      const rows = this.admin.tables[this.table] as Array<Record<string, unknown>>;
      const index = rows.findIndex(
        (item) =>
          item.organization_id === row.organization_id &&
          item.period_start === row.period_start,
      );

      if (index >= 0) {
        rows[index] = { ...rows[index], ...row };
      } else {
        rows.push(row);
      }

      return { data: null, error: null };
    }

    if (this.operation === "update") {
      const rows = this.admin.tables[this.table] as Array<Record<string, unknown>>;
      const patch = this.payload as Record<string, unknown>;

      for (const row of rows) {
        if (this.matches(row)) {
          Object.assign(row, patch);
        }
      }

      return { data: null, error: null };
    }

    const rows = this.admin.tables[this.table] as Array<Record<string, unknown>>;
    return { data: rows.filter((row) => this.matches(row)), error: null };
  }

  private ensureInserted() {
    if (this.inserted) {
      return this.inserted;
    }

    const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
    const rows = this.admin.tables[this.table] as Array<Record<string, unknown>>;

    this.inserted = payloads.map((payload) => {
      const row = this.admin.materializeRow(this.table, payload as Record<string, unknown>);
      rows.push(row);
      return row;
    });

    return this.inserted;
  }

  private matches(row: Record<string, unknown>) {
    return this.filters.every((filter) => row[filter.column] === filter.value);
  }
}

class MockSupabaseAdmin {
  tables = {
    organizations: [] as Array<Record<string, unknown>>,
    organization_members: [] as Array<Record<string, unknown>>,
    projects: [] as Array<Record<string, unknown>>,
    pitch_packs: [] as Array<Record<string, unknown>>,
    source_documents: [] as Array<Record<string, unknown>>,
    claims: [] as Array<Record<string, unknown>>,
    provider_runs: [] as Array<Record<string, unknown>>,
    exports: [] as Array<Record<string, unknown>>,
    usage_counters: [] as Array<Record<string, unknown>>,
    launch_packs: [] as Array<Record<string, unknown>>,
  };

  uploads: Array<{ bucket: string; path: string }> = [];

  storage = {
    getBucket: async (id: string) => ({
      data: { id, public: false },
      error: null,
    }),
    from: (bucket: string) => ({
      upload: async (path: string) => {
        this.uploads.push({ bucket, path });
        return { data: { path }, error: null };
      },
      createSignedUrl: async (path: string) => ({
        data: { signedUrl: `https://signed.test/${path}` },
        error: null,
      }),
    }),
  };

  from(table: keyof MockSupabaseAdmin["tables"]) {
    return new MockQueryBuilder(this, table);
  }

  materializeRow(table: keyof MockSupabaseAdmin["tables"], payload: Record<string, unknown>) {
    const id = `${table}-${this.tables[table].length + 1}`;
    const createdAt = "2026-05-16T10:00:00.000Z";

    if (table === "organizations") {
      return {
        id,
        plan: "free",
        billing_mode: "manual",
        single_pack_credits: 0,
        created_at: createdAt,
        ...payload,
      };
    }

    if (table === "pitch_packs") {
      return {
        id,
        created_at: createdAt,
        ...payload,
      };
    }

    return {
      id,
      created_at: createdAt,
      ...payload,
    };
  }
}

vi.mock("../lib/supabase/server", () => ({
  hasSupabasePublicEnv: () => Boolean(mockState.admin),
  hasSupabaseAdminEnv: () => Boolean(mockState.admin),
  createSupabaseAdminClient: () => mockState.admin,
  createSupabaseRouteClient: async () =>
    mockState.user
      ? {
          auth: {
            getUser: async () => ({ data: { user: mockState.user }, error: null }),
          },
        }
      : null,
}));

vi.mock("../lib/pitch-pack", () => ({
  generatePitchPackWithRunLogs: vi.fn(async (input: { rawInput: string; projectUrl?: string }) => {
    const pitchPack = {
      projectName: "ProofPitch",
      oneLiner: "ProofPitch turns rough founder notes into verified pitch packs.",
      targetUser: "Founder-led B2B teams.",
      problem: "Pitch material mixes reusable story with unsupported claims.",
      solution: "ProofPitch creates a claim ledger before reusable copy.",
      whyNow: "AI copy is easy to generate, but source-backed claims are harder to trust.",
      executivePitch: `ProofPitch starts from this input: ${input.rawInput}`,
      demoScript2Min: "Paste context, generate the pack, review the claim ledger, then export Markdown.",
      liveDemoSteps: ["Paste context", "Generate pack", "Review claims", "Export Markdown"],
      claims: [
        {
          id: "claim-1",
          text: "ProofPitch creates a claim ledger.",
          status: "supported",
          sourceType: "user_input",
          sourceTitle: "Founder note",
          sourceUrl: null,
          explanation: "The user provided this capability in the input.",
        },
        {
          id: "claim-2",
          text: "ProofPitch improves conversion by 40%.",
          status: "unsupported",
          sourceType: "inference",
          sourceTitle: null,
          sourceUrl: null,
          explanation: "No source supports this metric.",
        },
      ],
      readmeSnippet: "ProofPitch turns rough notes into verified pitch packs.",
      providerUsage: {
        openai: "Structured generation.",
        tavily: "Research sources.",
        pioneer: "Claim extraction.",
      },
      risks: ["Verification is evidence-aided, not a legal guarantee."],
      nextSteps: ["Connect Supabase and export Markdown."],
    };

    return {
      mode: "demo",
      pitchPack,
      providers: {
        openai: { state: "fallback", detail: "OpenAI unavailable. Using local fallback." },
        tavily: { state: "used", detail: "Tavily returned 1 source." },
        pioneer: { state: "used", detail: "Pioneer returned 1 extraction item." },
      },
      providerRunLogs: [
        {
          provider: "openai",
          status: "fallback",
          detail: "Deterministic fallback used.",
          latencyMs: 0,
          requestId: "req-test",
        },
      ],
      sourceDocuments: [
        {
          type: "user_input",
          title: "Founder note",
          extractedText: input.rawInput,
          metadata: { source: "user_input" },
        },
        {
          type: "web",
          title: "Example source",
          url: input.projectUrl ?? "https://example.com",
          extractedText: "Example source content.",
          metadata: { provider: "tavily", score: 0.9 },
        },
      ],
      requestId: "req-test",
    };
  }),
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        create: async (input: Record<string, unknown>) => {
          stripeState.checkoutSessions.push(input);

          return {
            id: "cs_test_proofpitch",
            url: "https://checkout.stripe.test/proofpitch",
          };
        },
      },
    };

    webhooks = {
      constructEvent: (payload: string, signature: string | null, secret: string) => {
        stripeState.webhookConstructions.push({ payload, signature, secret });

        return JSON.parse(payload);
      },
    };

    constructor(secret: string, options?: { apiVersion?: string }) {
      stripeState.instances.push({ secret, apiVersion: options?.apiVersion });
    }
  },
}));

beforeEach(() => {
  mockState.admin = null;
  mockState.user = null;
  stripeState.instances = [];
  stripeState.checkoutSessions = [];
  stripeState.webhookConstructions = [];
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  (globalThis as typeof globalThis & { __proofpitchLocalStore?: unknown }).__proofpitchLocalStore =
    undefined;
  vi.resetModules();
});

describe("backend contracts", () => {
  it("builds a deterministic deck spec from accepted claims and compiles safe Slidev markdown", async () => {
    const { buildDeckSpec, buildSlidevMarkdownFromDeckSpec } = await import("../lib/deck-spec");
    const pitchPack = buildPitchPack();
    const input = {
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      demoInstructions: "Show the claim ledger and the product workflow.",
      deckMode: "sales" as const,
    };

    const outline = buildDeckSpec({
      input,
      pitchPack,
      acceptedClaimIds: ["claim-1"],
      screenshots: [
        {
          id: "shot-demo",
          title: "ProofPitch product workflow",
          url: "https://assets.test/workflow.png",
          alt: "ProofPitch product workflow screenshot",
        },
      ],
    });
    const compiled = buildSlidevMarkdownFromDeckSpec({
      input,
      outline,
      pitchPack,
    });

    expect(outline.status).toBe("ready");
    expect(outline.deckMode).toBe("sales");
    expect(outline.acceptedClaimIds).toEqual(["claim-1"]);
    expect(outline.slides.map((slide) => slide.title)).toContain("Proof Ledger");
    expect(outline.slides.find((slide) => slide.id === "product-demo")?.visual).toMatchObject({
      kind: "screenshot",
      url: "https://assets.test/workflow.png",
    });
    expect(outline.slides.flatMap((slide) => slide.claimIds)).toEqual(["claim-1"]);
    expect(JSON.stringify(outline)).not.toContain("40%");
    expect(compiled.markdown).toContain("theme: default");
    expect(compiled.markdown).toContain("---");
    expect(compiled.markdown).toContain("<!--");
    expect(compiled.markdown).toContain("https://assets.test/workflow.png");
    expect(compiled.markdown).toContain("ProofPitch creates a claim ledger.");
    expect(compiled.markdown).not.toContain("improves conversion by 40%");
    expect(compiled.slideCount).toBe(outline.slides.length);
  });

  it("keeps dense proof-ledger slides inside the deck schema limit", async () => {
    const { buildDeckSpec, buildSlidevMarkdownFromDeckSpec } = await import("../lib/deck-spec");
    const pitchPack = buildPitchPack();
    const input = {
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      demoInstructions: "Show the claim ledger and the product workflow.",
      deckMode: "sales" as const,
    };

    pitchPack.claims = Array.from({ length: 16 }, (_, index) => ({
      id: `claim-${index + 1}`,
      text: `ProofPitch evidence claim ${index + 1} has enough detail to resemble verbose provider output from a real product website, including the buyer context, source framing, and qualification notes.`,
      status: "supported",
      sourceType: "web",
      sourceTitle: "Provider research",
      sourceUrl: "https://example.com",
      explanation: "Provider research supported this claim.",
    }));

    const acceptedClaimIds = pitchPack.claims.map((claim) => claim.id);
    const outline = buildDeckSpec({
      input,
      pitchPack,
      acceptedClaimIds,
    });
    const proofSlide = outline.slides.find((slide) => slide.id === "proof-ledger");
    const compiled = buildSlidevMarkdownFromDeckSpec({
      input,
      outline,
      pitchPack,
    });

    expect(proofSlide?.body.length).toBeLessThanOrEqual(1200);
    expect(proofSlide?.body).toContain("more accepted claims");
    expect(proofSlide?.claimIds).toEqual(acceptedClaimIds);
    expect(compiled.slideCount).toBe(outline.slides.length);
  });

  it("validates MVP launch-pack inputs and generated output contracts", async () => {
    expect(() =>
      CreateLaunchPackRequestSchema.parse({
        sourceUrl: "not-a-url",
        productName: "ProofPitch",
        targetAudience: "Founder-led B2B teams",
        launchGoal: "Launch with a focused demo",
      }),
    ).toThrow();

    expect(CreateLaunchPackRequestSchema.parse({
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      deckMode: "sales",
    })).toEqual({
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      deckMode: "sales",
    });

    const launchPack = LaunchPackSchema.parse({
      id: "launch-1",
      status: "completed",
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      deckMode: "sales",
      claimReview: {
        status: "approved",
        acceptedClaimIds: ["claim-1"],
        rejectedClaimIds: ["claim-2"],
      },
      demoScript: "Open the product, show the proof ledger, then use the separate deck.",
      captions: ["Open the product", "Review evidence", "Publish after review"],
      screenshots: [
        {
          id: "shot-1",
          title: "Homepage",
          url: "https://assets.test/home.png",
          alt: "ProofPitch homepage screenshot",
        },
      ],
      demoVideo: {
        status: "pending",
        durationSeconds: 0,
        uploadStatus: "blocked_by_provider_review",
        renderer: "remotion",
        compositionId: "ProofPitchProductDemo",
        error: "Product demo video requires Playwright capture.",
        renderProps: {
          productName: "ProofPitch",
          oneLiner: "Turn a product URL into a release-ready proof pack.",
          sourceUrl: "https://example.com",
          screenshots: [
            {
              title: "Homepage",
              url: "https://assets.test/home.png",
              alt: "ProofPitch homepage screenshot",
            },
          ],
          demoSteps: ["Open the product", "Review evidence", "Use the deck"],
          captions: ["Open the product", "Review evidence", "Publish after review"],
        },
      },
      pitchDeck: {
        status: "ready",
        format: "slidev",
        title: "ProofPitch release deck",
        slideCount: 6,
        renderState: "queued",
        deckMode: "sales",
        outline: {
          status: "ready",
          deckMode: "sales",
          acceptedClaimIds: ["claim-1"],
          slides: [
            {
              id: "slide-1",
              title: "ProofPitch",
              layout: "cover",
              body: "ProofPitch turns rough notes into verified pitch packs.",
              claimIds: [],
              notes: "Open with the product promise.",
            },
          ],
        },
        markdown: "---\ntheme: default\n---\n# ProofPitch\n",
        exports: [
          {
            format: "pdf",
            status: "pending",
          },
        ],
      },
      launchChecklist: ["Review every channel", "Publish after review"],
      pitchPack: buildPitchPack(),
      providers: {
        openai: { state: "fallback", detail: "OpenAI unavailable. Using local fallback." },
        tavily: { state: "used", detail: "Tavily returned 1 source." },
        pioneer: { state: "used", detail: "Pioneer returned 1 extraction item." },
      },
      createdAt: "2026-05-16T10:00:00.000Z",
      updatedAt: "2026-05-16T10:00:00.000Z",
    });

    expect(PitchDeckSchema.parse(launchPack.pitchDeck).format).toBe("slidev");
    expect(RemotionRenderPropsSchema.parse(launchPack.demoVideo.renderProps).demoSteps).toHaveLength(3);
    expect(Object.keys(launchPack).sort()).toEqual([
      "captions",
      "claimReview",
      "createdAt",
      "deckMode",
      "demoScript",
      "demoVideo",
      "id",
      "launchChecklist",
      "launchGoal",
      "pitchDeck",
      "pitchPack",
      "productName",
      "providers",
      "screenshots",
      "sourceUrl",
      "status",
      "targetAudience",
      "updatedAt",
    ]);
  });

  it("validates pitch-pack inputs and generated output", () => {
    expect(() =>
      GeneratePitchPackRequestSchema.parse({ rawInput: "too short" }),
    ).toThrow();
    expect(() =>
      GeneratePitchPackRequestSchema.parse({
        rawInput: "ProofPitch turns rough notes into verified pitch packs.",
        projectUrl: "not-a-url",
      }),
    ).toThrow();

    expect(PitchPackSchema.parse(buildPitchPack()).claims).toHaveLength(2);
  });

  it("redacts known secrets from provider failure details", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret-value");

    const report = providerFailed("openai", new Error("bad key sk-test-secret-value"));

    expect(report.state).toBe("failed");
    expect(report.detail).not.toContain("sk-test-secret-value");
    expect(report.detail).toContain("[redacted]");
  });

  it("parses Pioneer nested entity output and claim risk", async () => {
    vi.stubEnv("PIONEER_API_KEY", "pioneer-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            result: {
              data: {
                entities: {
                  product: ["product demo videos", "pitch decks"],
                  claim: ["verifies claims"],
                },
                claim_risk: "weak",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const { extractWithPioneer } = await import("../lib/pioneer");
    const result = await extractWithPioneer("ProofPitch creates product demo videos and pitch decks.");

    expect(result.entities).toEqual([
      { type: "product", value: "product demo videos" },
      { type: "product", value: "pitch decks" },
      { type: "claim", value: "verifies claims" },
    ]);
    expect(result.claimRisk).toBe("weak");
    expect(result.report).toMatchObject({
      state: "used",
      detail: "Pioneer returned 3 extraction item(s) with weak claim risk.",
    });
  });

  it("renders Markdown exports with reusable sections", () => {
    const markdown = renderPitchPackMarkdown(buildPitchPack());

    expect(markdown).toContain("## Two-Minute Script");
    expect(markdown).toContain("## Claim Ledger");
    expect(markdown).toContain("## README / Website Snippet");
    expect(markdown).toContain("## Risks");
  });

  it("builds separate Slidev deck and blocked product-demo video metadata from a pitch pack", async () => {
    const { buildReleaseAssets } = await import("../lib/release-assets");
    const assets = await buildReleaseAssets({
      input: {
        sourceUrl: "https://example.com",
        productName: "ProofPitch",
        targetAudience: "Founder-led B2B teams",
        launchGoal: "Release with a pitch deck and product demo video",
        deckMode: "sales",
      },
      pitchPack: buildPitchPack(),
      screenshots: [
        {
          id: "shot-1",
          title: "Homepage",
          url: "https://assets.test/home.png",
          alt: "ProofPitch homepage",
        },
      ],
    });

    expect(assets.pitchDeck).toMatchObject({
      status: "pending",
      format: "slidev",
      title: "ProofPitch release deck",
      renderState: "queued",
      deckMode: "sales",
    });
    expect(assets.pitchDeck.slideCount).toBe(0);
    expect(assets.pitchDeck.markdown).toBe("");
    expect(assets.pitchDeck.outline).toMatchObject({ status: "pending", deckMode: "sales" });
    expect(Object.keys(assets).sort()).toEqual(["demoVideo", "pitchDeck", "releaseChecklist"]);
    expect(assets.demoVideo).toMatchObject({
      renderer: "remotion",
      compositionId: "ProofPitchProductDemo",
      status: "pending",
      uploadStatus: "blocked_by_provider_review",
    });
    expect(assets.demoVideo.url).toBeUndefined();
    expect(assets.demoVideo.error).toContain("Remotion render action");
    expect(assets.demoVideo.renderProps?.demoSteps.join(" ")).toContain("Paste context");
    expect(assets.demoVideo.renderProps?.demoPath).toBeUndefined();
  });

  it("keeps the local renderer disabled unless explicitly enabled and supports dry-run commands", async () => {
    const { buildReleaseAssets } = await import("../lib/release-assets");
    const { renderReleaseArtifacts } = await import("../lib/release-renderer");
    const assets = await buildReleaseAssets({
      input: {
        sourceUrl: "https://example.com",
        productName: "ProofPitch",
        targetAudience: "Founder-led B2B teams",
        launchGoal: "Release with a pitch deck and demo video",
        deckMode: "sales",
      },
      pitchPack: buildPitchPack(),
      screenshots: [],
    });

    const skipped = await renderReleaseArtifacts({
      launchPackId: "launch-1",
      pitchDeck: assets.pitchDeck,
      demoVideo: assets.demoVideo,
      dryRun: true,
    });
    expect(skipped).toMatchObject({
      enabled: false,
      artifacts: [],
    });

    vi.stubEnv("PROOFPITCH_ENABLE_LOCAL_RENDER", "1");
    const dryRun = await renderReleaseArtifacts({
      launchPackId: "launch-1",
      pitchDeck: assets.pitchDeck,
      demoVideo: assets.demoVideo,
      dryRun: true,
    });
    expect(dryRun.enabled).toBe(true);
    expect(dryRun.commands.join("\n")).toContain("@slidev/cli");
    expect(dryRun.commands.join("\n")).toContain(
      "@remotion/renderer renderMedia remotion/index.tsx",
    );
    expect(dryRun.videoUrl).toBe("/api/launch-packs/launch-1/video");
  });

  it("keeps user demo path instructions inside Remotion render props", async () => {
    const { buildReleaseAssets } = await import("../lib/release-assets");
    const assets = await buildReleaseAssets({
      input: {
        sourceUrl: "https://example.com",
        productName: "ProofPitch",
        targetAudience: "Founder-led B2B teams",
        launchGoal: "Release with a guided product demo video",
        demoInstructions: "Accept cookies, search pricing, then scroll to the CTA.",
        deckMode: "sales",
      },
      pitchPack: buildPitchPack(),
      screenshots: [],
    });

    expect(assets.demoVideo.renderProps?.demoPath).toBe(
      "Accept cookies, search pricing, then scroll to the CTA.",
    );
  });
});

describe("local backend flow", () => {
  it("creates a local release pack with claim review before outline, then approves an outline", async () => {
    const service = await import("../lib/launch-pack-service");
    const input = {
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      demoInstructions: "Show the claim ledger and the product workflow.",
      deckMode: "sales" as const,
    };

    const created = await service.createLaunchPack(input);
    const outlined = await service.approveLaunchPackDeckOutline(created.id, {
      acceptedClaimIds: ["claim-1"],
    });
    const detail = await service.getLaunchPackDetail(created.id);

    expect(created.status).toBe("running");
    expect(created.claimReview).toMatchObject({
      status: "pending",
      acceptedClaimIds: ["claim-1"],
      rejectedClaimIds: ["claim-2"],
    });
    expect(created.pitchDeck).toMatchObject({
      status: "pending",
      renderState: "queued",
      markdown: "",
    });
    expect(outlined?.status).toBe("completed");
    expect(outlined?.claimReview.status).toBe("approved");
    expect(outlined?.pitchDeck.status).toBe("ready");
    expect(outlined?.pitchDeck.markdown).toContain("# ProofPitch");
    expect(outlined?.pitchDeck.markdown).not.toContain("improves conversion by 40%");
    expect(created.demoVideo).toMatchObject({
      renderer: "remotion",
      compositionId: "ProofPitchProductDemo",
      uploadStatus: "blocked_by_provider_review",
    });
    expect(Object.keys(created.providers)).toEqual(["openai", "tavily", "pioneer"]);
    expect(Object.keys(created).sort()).toEqual([
      "captions",
      "claimReview",
      "createdAt",
      "deckMode",
      "demoInstructions",
      "demoScript",
      "demoVideo",
      "id",
      "launchChecklist",
      "launchGoal",
      "pitchDeck",
      "pitchPack",
      "productName",
      "providers",
      "screenshots",
      "sourceUrl",
      "status",
      "targetAudience",
      "updatedAt",
    ]);
    expect(detail?.launchPack.pitchDeck.outline?.status).toBe("ready");
  });

  it("exposes the claim gate, outline approval, and queued render job through API routes", async () => {
    vi.stubEnv("PROOFPITCH_ENABLE_LOCAL_RENDER", "1");
    const { POST: create } = await import("../app/api/launch-packs/route");
    const { POST: approveOutline } = await import("../app/api/launch-packs/[id]/outline/route");
    const { POST: render } = await import("../app/api/launch-packs/[id]/render/route");

    const createResponse = await create(
      new Request("https://proofpitch.test/api/launch-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: "https://example.com",
          productName: "ProofPitch",
          targetAudience: "Founder-led B2B teams",
          launchGoal: "Release with a pitch deck and product demo video",
          deckMode: "sales",
        }),
      }),
    );
    const created = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(created.claimReview.status).toBe("pending");
    expect(created.pitchDeck.status).toBe("pending");
    expect(created.pitchDeck.markdown).toBe("");

    const outlineResponse = await approveOutline(
      new Request(`https://proofpitch.test/api/launch-packs/${created.id}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedClaimIds: ["claim-1"] }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const outlined = await outlineResponse.json();

    expect(outlineResponse.status).toBe(200);
    expect(outlined.pitchDeck.outline.status).toBe("ready");
    expect(outlined.pitchDeck.markdown).toContain("Proof Ledger");

    const renderResponse = await render(
      new Request(`https://proofpitch.test/api/launch-packs/${created.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const renderBody = await renderResponse.json();

    expect(renderResponse.status).toBe(200);
    expect(renderBody.pitchDeck.renderState).toBe("queued");
    expect(renderBody.render.commands.join("\n")).toContain("@slidev/cli");
    expect(renderBody.render.commands.join("\n")).toContain("--format pdf");
  });

  it("approves and queues render from the request payload when anonymous local storage is unavailable", async () => {
    const { POST: create } = await import("../app/api/launch-packs/route");
    const { POST: approveOutline } = await import("../app/api/launch-packs/[id]/outline/route");
    const { POST: render } = await import("../app/api/launch-packs/[id]/render/route");

    const createResponse = await create(
      new Request("https://proofpitch.test/api/launch-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: "https://example.com",
          productName: "ProofPitch",
          targetAudience: "Founder-led B2B teams",
          launchGoal: "Release with a pitch deck and product demo video",
          deckMode: "sales",
        }),
      }),
    );
    const created = await createResponse.json();

    (globalThis as typeof globalThis & { __proofpitchLocalStore?: unknown }).__proofpitchLocalStore =
      undefined;

    const outlineResponse = await approveOutline(
      new Request(`https://proofpitch.test/api/launch-packs/${created.id}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedClaimIds: created.claimReview.acceptedClaimIds,
          launchPack: created,
        }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const outlined = await outlineResponse.json();

    expect(outlineResponse.status).toBe(200);
    expect(outlined.id).toBe(created.id);
    expect(outlined.pitchDeck.status).toBe("ready");
    expect(outlined.pitchDeck.markdown).toContain("Proof Ledger");

    const renderResponse = await render(
      new Request(`https://proofpitch.test/api/launch-packs/${created.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          launchPack: outlined,
        }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const renderBody = await renderResponse.json();

    expect(renderResponse.status).toBe(200);
    expect(renderBody.requiresSignIn).toBe(false);
    expect(renderBody.render.enabled).toBe(false);
    expect(renderBody.pitchDeck.renderState).toBe("queued");
  });

  it("allows public video render requests to carry the launch pack for serverless fallback", async () => {
    const service = await import("../lib/launch-pack-service");
    const { POST: render } = await import("../app/api/launch-packs/[id]/render/route");
    const created = await service.createLaunchPack({
      sourceUrl: "https://example.com",
      productName: "ProofPitch",
      targetAudience: "Founder-led B2B teams",
      launchGoal: "Release with a pitch deck and product demo video",
      demoInstructions: "Show the claim ledger and the product workflow.",
      deckMode: "sales",
    });
    const fallbackPack = {
      ...created,
      id: "fallback-pack",
    };

    const forcedResponse = await render(
      new Request("https://proofpitch.test/api/launch-packs/fallback-pack/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureSite: true,
          dryRun: true,
          force: true,
          launchPack: fallbackPack,
          renderDeck: false,
          renderVideo: true,
        }),
      }),
      { params: Promise.resolve({ id: "fallback-pack" }) },
    );
    const forcedBody = await forcedResponse.json();

    expect(forcedResponse.status).toBe(200);
    expect(forcedBody.enabled).toBe(true);
    expect(forcedBody.videoUrl).toBe("/api/launch-packs/fallback-pack/video");

    const fallbackResponse = await render(
      new Request("https://proofpitch.test/api/launch-packs/missing/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureSite: true,
          renderDeck: false,
          renderVideo: true,
        }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(fallbackResponse.status).toBe(404);
  });

  it("creates repeated local packs without quota blocking", async () => {
    const service = await import("../lib/pitch-pack-service");
    const input = {
      rawInput: "ProofPitch turns rough founder notes into verified pitch packs.",
      projectUrl: "https://example.com",
    };

    const first = await service.createPitchPack(input);
    const detail = await service.getPitchPackDetail(first.record?.id ?? "");
    const projects = await service.listProjects();

    expect(first.quota?.billingMode).toBe("free-access");
    expect(first.quota?.remaining).toBeGreaterThan(1_000_000);
    expect(detail?.sourceDocuments).toHaveLength(2);
    expect(detail?.providerRuns[0].metadata).toMatchObject({ requestId: "req-test" });
    expect(projects.items[0]).toMatchObject({ name: "ProofPitch", pitchPackCount: 1 });

    const second = await service.createPitchPack(input);

    expect(second.record?.id).toBeTruthy();
    expect(second.quota?.remaining).toBeGreaterThan(1_000_000);
  });
});

describe("Supabase-backed service flow", () => {
  it("persists pack detail, source documents, provider runs, updates metadata, and exports Markdown", async () => {
    const service = await import("../lib/pitch-pack-service");
    const admin = new MockSupabaseAdmin();
    mockState.admin = admin;
    mockState.user = { id: "user-1", email: "founder@example.com" };

    const input = {
      rawInput: "ProofPitch turns rough founder notes into verified pitch packs.",
      projectUrl: "https://example.com",
    };

    const created = await service.createPitchPack(input);
    const id = created.record?.id ?? "";

    expect(admin.tables.projects).toHaveLength(1);
    expect(admin.tables.pitch_packs).toHaveLength(1);
    expect(admin.tables.claims).toHaveLength(2);
    expect(admin.tables.source_documents).toHaveLength(2);
    expect(admin.tables.provider_runs[0].metadata).toMatchObject({ requestId: "req-test" });

    const detail = await service.getPitchPackDetail(id);
    expect(detail?.sourceDocuments[1]).toMatchObject({
      title: "Example source",
      url: "https://example.com",
    });

    const updated = await service.updatePitchPack(id, {
      projectName: "Renamed ProofPitch",
      approvalNote: "Founder approved for alpha.",
    });
    expect(updated?.pitchPack.projectName).toBe("Renamed ProofPitch");
    expect(updated?.approvalNote).toBe("Founder approved for alpha.");

    const exported = await service.exportPitchPack(id, "markdown");
    expect(exported.status).toBe(200);
    expect(exported.body.signedUrl).toContain("https://signed.test/");
    expect(admin.uploads[0]).toMatchObject({ bucket: "proofpitch-exports" });
  });
});

describe("Stripe billing routes", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_proofpitch");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_proofpitch");
    vi.stubEnv("STRIPE_FOUNDER_PRICE_ID", "price_founder");
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro");
    vi.stubEnv("STRIPE_AGENCY_PRICE_ID", "price_agency");
    vi.stubEnv("STRIPE_SINGLE_PRICE_ID", "price_single");
  });

  it("keeps checkout disabled while pricing is documentation-only", async () => {
    const { POST } = await import("../app/api/billing/checkout/route");
    const response = await POST(
      new Request("https://proofpitch.test/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "founder" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.pricing).toMatchObject({
      mode: "documentation_only",
      docs: "docs/BUSINESS_PLAN.md",
    });
    expect(stripeState.checkoutSessions).toHaveLength(0);
  });

  it("applies checkout webhook entitlements to organizations", async () => {
    const admin = new MockSupabaseAdmin();
    const organization = admin.materializeRow("organizations", {
      name: "ProofPitch workspace",
      plan: "free",
      billing_mode: "manual",
      single_pack_credits: 0,
    });
    admin.tables.organizations.push(organization);
    mockState.admin = admin;

    const { POST } = await import("../app/api/billing/webhook/route");
    const subscriptionResponse = await POST(
      new Request("https://proofpitch.test/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: JSON.stringify({
          type: "checkout.session.completed",
          data: {
            object: {
              metadata: {
                organizationId: organization.id,
                plan: "pro",
              },
            },
          },
        }),
      }),
    );

    expect(subscriptionResponse.status).toBe(200);
    expect(admin.tables.organizations[0]).toMatchObject({
      plan: "pro",
      billing_mode: "stripe",
      single_pack_credits: 0,
    });

    const singleResponse = await POST(
      new Request("https://proofpitch.test/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: JSON.stringify({
          type: "checkout.session.completed",
          data: {
            object: {
              metadata: {
                organizationId: organization.id,
                plan: "single",
              },
            },
          },
        }),
      }),
    );

    expect(singleResponse.status).toBe(200);
    expect(admin.tables.organizations[0]).toMatchObject({
      plan: "pro",
      billing_mode: "stripe",
      single_pack_credits: 1,
    });
    expect(stripeState.webhookConstructions[0]).toMatchObject({
      signature: "sig_test",
      secret: "whsec_proofpitch",
    });
  });
});
