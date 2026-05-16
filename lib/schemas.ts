import { z } from "zod";

export const PlanIdSchema = z.enum(["free", "founder", "pro", "agency", "enterprise"]);
export const ClaimStatusSchema = z.enum(["supported", "weak", "unsupported", "user_provided"]);
export const SourceDocumentTypeSchema = z.enum(["user_input", "web", "repo", "audio", "upload"]);
export const LaunchPackStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export const SocialChannelSchema = z.enum(["product_hunt", "youtube", "linkedin", "x"]);
export const DefaultReleaseChannels = ["youtube", "linkedin", "x"] as const;
export const ReviewStatusSchema = z.enum(["pending_review", "reviewed"]);
export const PublishStatusSchema = z.enum([
  "pending_review",
  "ready_to_publish",
  "published",
  "failed",
  "connection_required",
  "manual_handoff",
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
  generatedMediaPrompt: z.string(),
  generatedMediaUrl: z.string().optional(),
  readmeSnippet: z.string(),
  providerUsage: z.object({
    openai: z.string(),
    gradium: z.string().optional(),
    tavily: z.string().optional(),
    pioneer: z.string().optional(),
    fal: z.string().optional(),
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
  releaseChannels: z
    .array(SocialChannelSchema)
    .min(1)
    .max(4)
    .default([...DefaultReleaseChannels]),
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
  provider: z.enum(["openai", "tavily", "fal", "gradium", "pioneer"]),
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

export const PitchDeckSchema = z.object({
  status: z.enum(["pending", "ready", "failed"]),
  format: z.literal("slidev"),
  title: z.string(),
  slideCount: z.number().int().min(1),
  markdown: z.string(),
  exports: z.array(PitchDeckExportSchema),
  error: z.string().optional(),
});

export const VoiceoverSchema = z.object({
  status: z.enum(["pending", "ready", "script_only", "failed"]),
  provider: z.enum(["openai", "none"]),
  script: z.string(),
  audioUrl: z.string().optional(),
  format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).default("wav"),
  voice: z.string().optional(),
  error: z.string().optional(),
});

export const RemotionSceneSchema = z.object({
  title: z.string(),
  body: z.string(),
  kind: z.enum(["hook", "problem", "solution", "proof", "demo", "cta"]),
});

export const RemotionRenderPropsSchema = z.object({
  productName: z.string(),
  oneLiner: z.string(),
  sourceUrl: z.string().url(),
  deckTitle: z.string(),
  slideCount: z.number().int().min(1),
  voiceoverUrl: z.string().optional(),
  scenes: z.array(RemotionSceneSchema).min(1),
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

export const ProductHuntLaunchSchema = z.object({
  productName: z.string(),
  tagline: z.string(),
  topics: z.array(z.string()),
  pricing: z.string(),
  thumbnailUrl: z.string().optional(),
  galleryUrls: z.array(z.string()),
  youtubeUrl: z.string().optional(),
  interactiveDemoUrl: z.string(),
  description: z.string(),
  makerComment: z.string(),
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
  checklist: z.array(z.string()),
});

export const SocialMediaAssetSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string(),
  madeWithAi: z.boolean().optional(),
});

export const LinkedInPostSchema = z.object({
  text: z.string(),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
  media: z.array(SocialMediaAssetSchema).optional(),
});

export const XPostSchema = z.object({
  text: z.string().max(280),
  media: z.array(SocialMediaAssetSchema).optional(),
});

export const YouTubeMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  privacyStatus: z.enum(["private", "unlisted", "public"]),
  tags: z.array(z.string()),
});

export const LaunchPackSchema = z.object({
  id: z.string(),
  organizationId: z.string().optional(),
  status: LaunchPackStatusSchema,
  sourceUrl: z.string().url(),
  productName: z.string(),
  targetAudience: z.string(),
  launchGoal: z.string(),
  releaseChannels: z.array(SocialChannelSchema),
  demoInstructions: z.string().optional(),
  demoScript: z.string(),
  captions: z.array(z.string()),
  screenshots: z.array(LaunchScreenshotSchema),
  demoVideo: DemoVideoSchema,
  pitchDeck: PitchDeckSchema,
  voiceover: VoiceoverSchema,
  productHunt: ProductHuntLaunchSchema,
  socialPosts: z.object({
    linkedin: LinkedInPostSchema,
    x: z.array(XPostSchema),
  }),
  youtube: YouTubeMetadataSchema,
  launchChecklist: z.array(z.string()),
  pitchPack: PitchPackSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ChannelDraftSchema = z.object({
  id: z.string(),
  launchPackId: z.string(),
  channel: SocialChannelSchema,
  payload: z.record(z.string(), z.unknown()),
  reviewStatus: ReviewStatusSchema,
  publishStatus: PublishStatusSchema,
  safeAutofillUrl: z.string().optional(),
  autofillToken: z.string().optional(),
  externalId: z.string().nullable().optional(),
  externalUrl: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PublishLaunchPackRequestSchema = z.object({
  reviewConfirmed: z.boolean(),
});

export const GeneratePitchPackResponseSchema = z.object({
  mode: z.enum(["live", "partial", "demo"]),
  pitchPack: PitchPackSchema,
  providers: z.object({
    openai: ProviderReportSchema,
    tavily: ProviderReportSchema,
    fal: ProviderReportSchema,
    gradium: ProviderReportSchema,
    pioneer: ProviderReportSchema,
  }),
  record: PitchPackRecordSchema.optional(),
  quota: QuotaSnapshotSchema.optional(),
});

export const ExportRequestSchema = z.object({
  type: z.enum(["markdown", "pdf"]).default("markdown"),
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
export type SocialChannel = z.infer<typeof SocialChannelSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type PublishStatus = z.infer<typeof PublishStatusSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type PitchPack = z.infer<typeof PitchPackSchema>;
export type GeneratePitchPackRequest = z.infer<typeof GeneratePitchPackRequestSchema>;
export type CreateLaunchPackRequest = z.infer<typeof CreateLaunchPackRequestSchema>;
export type GeneratePitchPackResponse = z.infer<typeof GeneratePitchPackResponseSchema>;
export type ProviderReport = z.infer<typeof ProviderReportSchema>;
export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;
export type PitchPackRecord = z.infer<typeof PitchPackRecordSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type ProviderRunSummary = z.infer<typeof ProviderRunSummarySchema>;
export type ExportSummary = z.infer<typeof ExportSummarySchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type LaunchScreenshot = z.infer<typeof LaunchScreenshotSchema>;
export type SlidevExportFormat = z.infer<typeof SlidevExportFormatSchema>;
export type PitchDeckExport = z.infer<typeof PitchDeckExportSchema>;
export type PitchDeck = z.infer<typeof PitchDeckSchema>;
export type Voiceover = z.infer<typeof VoiceoverSchema>;
export type RemotionScene = z.infer<typeof RemotionSceneSchema>;
export type RemotionRenderProps = z.infer<typeof RemotionRenderPropsSchema>;
export type DemoVideo = z.infer<typeof DemoVideoSchema>;
export type ProductHuntLaunch = z.infer<typeof ProductHuntLaunchSchema>;
export type LinkedInPost = z.infer<typeof LinkedInPostSchema>;
export type XPost = z.infer<typeof XPostSchema>;
export type YouTubeMetadata = z.infer<typeof YouTubeMetadataSchema>;
export type LaunchPack = z.infer<typeof LaunchPackSchema>;
export type ChannelDraft = z.infer<typeof ChannelDraftSchema>;
export type PublishLaunchPackRequest = z.infer<typeof PublishLaunchPackRequestSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdatePitchPackRequest = z.infer<typeof UpdatePitchPackRequestSchema>;

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
    "generatedMediaPrompt",
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
    generatedMediaPrompt: { type: "string" },
    readmeSnippet: { type: "string" },
    providerUsage: {
      type: "object",
      additionalProperties: false,
      required: ["openai", "gradium", "tavily", "pioneer", "fal"],
      properties: {
        openai: { type: "string" },
        gradium: { type: "string" },
        tavily: { type: "string" },
        pioneer: { type: "string" },
        fal: { type: "string" },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
  },
} as const;
