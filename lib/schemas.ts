import { z } from "zod";

export const PlanIdSchema = z.enum(["free", "founder", "pro", "agency", "enterprise"]);
export const ClaimStatusSchema = z.enum(["supported", "weak", "unsupported", "user_provided"]);
export const SourceDocumentTypeSchema = z.enum(["user_input", "web", "repo", "upload"]);
export const LaunchPackStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export const DeckModeSchema = z.enum(["investor", "sales", "launch"]);
export const DeckRenderStateSchema = z.enum(["queued", "running", "ready", "failed"]);
export const DeckLayoutSchema = z.enum(["cover", "section", "two_column", "proof", "demo", "risks", "closing"]);
export const DeckSlideVisualKindSchema = z.enum([
  "statement",
  "screenshot",
  "workflow",
  "claim_stack",
  "risk_stack",
  "checklist",
]);

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: ClaimStatusSchema,
  sourceType: z.enum(["user_input", "web", "repo", "inference"]),
  sourceTitle: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  explanation: z.string(),
});

export const PitchPackSchema = z.object({
  projectName: z.string(),
  oneLiner: z.string(),
  targetUser: z.string(),
  problem: z.string(),
  solution: z.string(),
  whyNow: z.string(),
  executivePitch: z.string(),
  demoScript2Min: z.string(),
  liveDemoSteps: z.array(z.string()),
  claims: z.array(ClaimSchema),
  readmeSnippet: z.string(),
  providerUsage: z.object({
    openai: z.string(),
    tavily: z.string().optional(),
    pioneer: z.string().optional(),
  }),
  risks: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export const GeneratePitchPackRequestSchema = z.object({
  rawInput: z.string().min(10, "Paste at least one useful sentence.").max(12000),
  projectUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional(),
  ),
});

export const CreateLaunchPackRequestSchema = z.object({
  sourceUrl: z.string().url(),
  productName: z.string().min(1).max(140),
  targetAudience: z.string().min(3).max(240),
  launchGoal: z.string().min(3).max(500),
  demoInstructions: z.string().max(2000).optional(),
  deckMode: DeckModeSchema,
});

export const AuthCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
});

export const ProviderStateSchema = z.enum(["used", "missing", "failed", "fallback", "pending"]);

export const ProviderReportSchema = z.object({
  state: ProviderStateSchema,
  detail: z.string(),
});

export const ProviderReportsSchema = z.object({
  openai: ProviderReportSchema,
  tavily: ProviderReportSchema,
  pioneer: ProviderReportSchema,
});

export const QuotaSnapshotSchema = z.object({
  organizationId: z.string(),
  plan: PlanIdSchema,
  billingMode: z.string(),
  monthlyLimit: z.number(),
  usedThisPeriod: z.number(),
  remaining: z.number(),
  singlePackCredits: z.number(),
  periodStart: z.string(),
  source: z.enum(["supabase", "local"]),
});

export const PitchPackRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().nullable().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  plan: PlanIdSchema,
  quota: QuotaSnapshotSchema,
  createdAt: z.string(),
});

export const SourceDocumentSummarySchema = z.object({
  id: z.string(),
  type: SourceDocumentTypeSchema,
  title: z.string(),
  url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const ProviderRunSummarySchema = z.object({
  id: z.string().optional(),
  provider: z.enum(["openai", "tavily", "pioneer"]),
  status: ProviderStateSchema,
  latencyMs: z.number().nullable().optional(),
  error: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().optional(),
});

export const ExportSummarySchema = z.object({
  id: z.string(),
  type: z.enum(["markdown", "pdf"]),
  storageUrl: z.string().nullable().optional(),
  signedUrl: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const ProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultUrl: z.string().nullable().optional(),
  pitchPackCount: z.number(),
  latestPitchPackAt: z.string().nullable(),
});

export const LaunchScreenshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  alt: z.string(),
});

export const SlidevExportFormatSchema = z.enum(["pdf", "pptx", "png"]);

export const PitchDeckExportSchema = z.object({
  format: SlidevExportFormatSchema,
  status: z.enum(["pending", "ready", "failed"]),
  path: z.string().optional(),
  storageUrl: z.string().nullable().optional(),
  signedUrl: z.string().nullable().optional(),
  error: z.string().optional(),
});

export const DeckSlideVisualSchema = z.object({
  kind: DeckSlideVisualKindSchema,
  title: z.string().min(1).max(120),
  caption: z.string().max(320).optional(),
  url: z.string().min(1).max(2000).optional(),
  alt: z.string().max(240).optional(),
});

export const DeckSlideSpecSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  layout: DeckLayoutSchema,
  body: z.string().min(1).max(1200),
  claimIds: z.array(z.string()),
  notes: z.string().min(1).max(1200),
  visual: DeckSlideVisualSchema.optional(),
});

export const DeckOutlineSchema = z.object({
  status: z.enum(["pending", "ready"]),
  deckMode: DeckModeSchema,
  acceptedClaimIds: z.array(z.string()),
  slides: z.array(DeckSlideSpecSchema),
});

export const PitchDeckSchema = z.object({
  status: z.enum(["pending", "ready", "failed"]),
  format: z.literal("slidev"),
  title: z.string(),
  slideCount: z.number().int().min(0),
  markdown: z.string(),
  deckMode: DeckModeSchema,
  outline: DeckOutlineSchema,
  renderState: DeckRenderStateSchema,
  exports: z.array(PitchDeckExportSchema),
  error: z.string().optional(),
});

export const ProductDemoScreenshotSchema = z.object({
  title: z.string(),
  url: z.string(),
  alt: z.string(),
});

export const RemotionRenderPropsSchema = z.object({
  productName: z.string(),
  oneLiner: z.string(),
  sourceUrl: z.string().url(),
  screenshots: z.array(ProductDemoScreenshotSchema),
  demoSteps: z.array(z.string()).min(1),
  captions: z.array(z.string()),
});

export const DemoVideoSchema = z.object({
  status: z.enum(["pending", "ready", "failed"]),
  url: z.string().optional(),
  durationSeconds: z.number().int().min(0).max(600).optional(),
  uploadStatus: z.enum([
    "not_required",
    "pending",
    "uploaded",
    "manual_upload_required",
    "blocked_by_provider_review",
  ]),
  renderer: z.literal("remotion").optional(),
  compositionId: z.string().optional(),
  renderProps: RemotionRenderPropsSchema.optional(),
  error: z.string().optional(),
});

export const LaunchPackSchema = z.object({
  id: z.string(),
  organizationId: z.string().optional(),
  status: LaunchPackStatusSchema,
  sourceUrl: z.string().url(),
  productName: z.string(),
  targetAudience: z.string(),
  launchGoal: z.string(),
  demoInstructions: z.string().optional(),
  deckMode: DeckModeSchema,
  claimReview: z.object({
    status: z.enum(["pending", "approved"]),
    acceptedClaimIds: z.array(z.string()),
    rejectedClaimIds: z.array(z.string()),
  }),
  demoScript: z.string(),
  captions: z.array(z.string()),
  screenshots: z.array(LaunchScreenshotSchema),
  demoVideo: DemoVideoSchema,
  pitchDeck: PitchDeckSchema,
  launchChecklist: z.array(z.string()),
  pitchPack: PitchPackSchema,
  providers: ProviderReportsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const GeneratePitchPackResponseSchema = z.object({
  mode: z.enum(["live", "partial", "demo"]),
  pitchPack: PitchPackSchema,
  providers: ProviderReportsSchema,
  record: PitchPackRecordSchema.optional(),
  quota: QuotaSnapshotSchema.optional(),
});

export const ExportRequestSchema = z.object({
  type: z.enum(["markdown", "pdf"]).default("markdown"),
});

export const ApproveDeckOutlineRequestSchema = z.object({
  acceptedClaimIds: z.array(z.string()).min(1, "Accept at least one claim for the deck outline."),
  launchPack: LaunchPackSchema.optional(),
});

export const RenderLaunchDeckRequestSchema = z.object({
  dryRun: z.boolean().default(false),
  launchPack: LaunchPackSchema.optional(),
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(140),
  defaultUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional(),
  ),
});

export const UpdatePitchPackRequestSchema = z
  .object({
    projectName: z.string().min(1).max(140).optional(),
    approvalNote: z.string().max(500).nullable().optional(),
  })
  .refine((value) => value.projectName !== undefined || value.approvalNote !== undefined, {
    message: "Provide projectName or approvalNote.",
  });

export type PlanId = z.infer<typeof PlanIdSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type SourceDocumentType = z.infer<typeof SourceDocumentTypeSchema>;
export type LaunchPackStatus = z.infer<typeof LaunchPackStatusSchema>;
export type DeckMode = z.infer<typeof DeckModeSchema>;
export type DeckRenderState = z.infer<typeof DeckRenderStateSchema>;
export type DeckLayout = z.infer<typeof DeckLayoutSchema>;
export type DeckSlideVisualKind = z.infer<typeof DeckSlideVisualKindSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type PitchPack = z.infer<typeof PitchPackSchema>;
export type GeneratePitchPackRequest = z.infer<typeof GeneratePitchPackRequestSchema>;
export type CreateLaunchPackRequest = z.infer<typeof CreateLaunchPackRequestSchema>;
export type GeneratePitchPackResponse = z.infer<typeof GeneratePitchPackResponseSchema>;
export type ProviderReport = z.infer<typeof ProviderReportSchema>;
export type ProviderReports = z.infer<typeof ProviderReportsSchema>;
export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;
export type PitchPackRecord = z.infer<typeof PitchPackRecordSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type ProviderRunSummary = z.infer<typeof ProviderRunSummarySchema>;
export type ExportSummary = z.infer<typeof ExportSummarySchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type LaunchScreenshot = z.infer<typeof LaunchScreenshotSchema>;
export type SlidevExportFormat = z.infer<typeof SlidevExportFormatSchema>;
export type PitchDeckExport = z.infer<typeof PitchDeckExportSchema>;
export type DeckSlideVisual = z.infer<typeof DeckSlideVisualSchema>;
export type DeckSlideSpec = z.infer<typeof DeckSlideSpecSchema>;
export type DeckOutline = z.infer<typeof DeckOutlineSchema>;
export type PitchDeck = z.infer<typeof PitchDeckSchema>;
export type RemotionRenderProps = z.infer<typeof RemotionRenderPropsSchema>;
export type DemoVideo = z.infer<typeof DemoVideoSchema>;
export type LaunchPack = z.infer<typeof LaunchPackSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdatePitchPackRequest = z.infer<typeof UpdatePitchPackRequestSchema>;
export type ApproveDeckOutlineRequest = z.infer<typeof ApproveDeckOutlineRequestSchema>;
export type RenderLaunchDeckRequest = z.infer<typeof RenderLaunchDeckRequestSchema>;

export const pitchPackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "projectName",
    "oneLiner",
    "targetUser",
    "problem",
    "solution",
    "whyNow",
    "executivePitch",
    "demoScript2Min",
    "liveDemoSteps",
    "claims",
    "readmeSnippet",
    "providerUsage",
    "risks",
    "nextSteps",
  ],
  properties: {
    projectName: { type: "string" },
    oneLiner: { type: "string" },
    targetUser: { type: "string" },
    problem: { type: "string" },
    solution: { type: "string" },
    whyNow: { type: "string" },
    executivePitch: { type: "string" },
    demoScript2Min: { type: "string" },
    liveDemoSteps: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "status", "sourceType", "sourceTitle", "sourceUrl", "explanation"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          status: {
            type: "string",
            enum: ["supported", "weak", "unsupported", "user_provided"],
          },
          sourceType: {
            type: "string",
            enum: ["user_input", "web", "repo", "inference"],
          },
          sourceTitle: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
      },
    },
    readmeSnippet: { type: "string" },
    providerUsage: {
      type: "object",
      additionalProperties: false,
      required: ["openai", "tavily", "pioneer"],
      properties: {
        openai: { type: "string" },
        tavily: { type: "string" },
        pioneer: { type: "string" },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
  },
} as const;
