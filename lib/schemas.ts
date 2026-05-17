import { z } from "zod";

import { parseHttpUrl } from "./public-url";

export const ClaimStatusSchema = z.enum(["supported", "weak", "unsupported", "user_provided"]);
export const SourceDocumentTypeSchema = z.enum(["user_input", "web", "repo", "upload"]);
export const DemoVideoProjectStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: ClaimStatusSchema,
  sourceType: z.enum(["user_input", "web", "repo", "inference"]),
  sourceTitle: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  explanation: z.string(),
});

export const CreateDemoVideoRequestSchema = z.object({
  sourceUrl: z.string().url().refine((value) => {
    try {
      parseHttpUrl(value);
      return true;
    } catch {
      return false;
    }
  }, "Only http and https product URLs are supported."),
  productName: z.string().min(1).max(140),
  targetAudience: z.string().min(3).max(240),
  demoGoal: z.string().min(3).max(500),
  demoInstructions: z.string().max(2000).optional(),
}).strict();

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
  gradium: ProviderReportSchema.optional(),
});

export const SourceDocumentSummarySchema = z.object({
  id: z.string(),
  type: SourceDocumentTypeSchema,
  title: z.string(),
  url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const DemoScreenshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  alt: z.string(),
});

export const ProductDemoScreenshotSchema = z.object({
  title: z.string(),
  url: z.string(),
  alt: z.string(),
  action: z.enum(["open", "consent", "click", "search", "first_result", "scroll", "capture"]).optional(),
  target: z.string().optional(),
  pointer: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    })
    .optional(),
});

export const DemoBriefSchema = z.object({
  projectName: z.string(),
  oneLiner: z.string(),
  targetUser: z.string(),
  demoNarrative: z.string(),
  demoScript2Min: z.string(),
  demoSteps: z.array(z.string()).min(1),
  claims: z.array(ClaimSchema),
  providerUsage: z.object({
    openai: z.string(),
    tavily: z.string().optional(),
    pioneer: z.string().optional(),
  }),
  risks: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export const ProofReviewSchema = z.object({
  status: z.enum(["pending", "approved"]),
  acceptedClaimIds: z.array(z.string()),
  rejectedClaimIds: z.array(z.string()),
});

export const HyperFramesRenderSpecSchema = z.object({
  productName: z.string(),
  oneLiner: z.string(),
  sourceUrl: z.string().url(),
  browserRecordingUrl: z.string().optional(),
  demoPath: z.string().optional(),
  screenshots: z.array(ProductDemoScreenshotSchema),
  demoSteps: z.array(z.string()).min(1),
  captions: z.array(z.string()),
  voiceoverScript: z.string().optional(),
  compositionHtml: z.string().optional(),
  designNotes: z.string().optional(),
  researchSummary: z.string().optional(),
});

export const DemoVideoStatusSchema = z.enum(["pending", "ready", "failed"]);
export const DemoVideoSchema = z.object({
  status: DemoVideoStatusSchema,
  url: z.string().optional(),
  durationSeconds: z.number().int().min(0).max(600).optional(),
  uploadStatus: z.enum(["not_required", "pending", "uploaded"]),
  renderer: z.literal("hyperframes").optional(),
  compositionId: z.string().optional(),
  renderSpec: HyperFramesRenderSpecSchema.optional(),
  error: z.string().optional(),
});

export const VoiceoverStatusSchema = z.enum(["pending", "ready", "captions_only", "failed"]);
export const VoiceoverSchema = z.object({
  status: VoiceoverStatusSchema,
  provider: z.literal("gradium"),
  script: z.string(),
  audioUrl: z.string().optional(),
  reason: z.string().optional(),
});

export const DemoVideoProjectSchema = z.object({
  id: z.string(),
  organizationId: z.string().optional(),
  status: DemoVideoProjectStatusSchema,
  sourceUrl: z.string().url(),
  productName: z.string(),
  targetAudience: z.string(),
  demoGoal: z.string(),
  demoInstructions: z.string().optional(),
  proofReview: ProofReviewSchema,
  demoBrief: DemoBriefSchema,
  captions: z.array(z.string()),
  screenshots: z.array(DemoScreenshotSchema),
  demoVideo: DemoVideoSchema,
  voiceover: VoiceoverSchema,
  providers: ProviderReportsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const RenderDemoVideoRequestSchema = z
  .object({
    captureSite: z.boolean().default(true),
    dryRun: z.boolean().default(false),
    project: DemoVideoProjectSchema.optional(),
    renderVideo: z.literal(true).default(true),
  })
  .strict();

export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type SourceDocumentType = z.infer<typeof SourceDocumentTypeSchema>;
export type DemoVideoProjectStatus = z.infer<typeof DemoVideoProjectStatusSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type CreateDemoVideoRequest = z.infer<typeof CreateDemoVideoRequestSchema>;
export type ProviderReport = z.infer<typeof ProviderReportSchema>;
export type ProviderReports = z.infer<typeof ProviderReportsSchema>;
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummarySchema>;
export type DemoScreenshot = z.infer<typeof DemoScreenshotSchema>;
export type ProductDemoScreenshot = z.infer<typeof ProductDemoScreenshotSchema>;
export type DemoBrief = z.infer<typeof DemoBriefSchema>;
export type ProofReview = z.infer<typeof ProofReviewSchema>;
export type HyperFramesRenderSpec = z.infer<typeof HyperFramesRenderSpecSchema>;
export type DemoVideo = z.infer<typeof DemoVideoSchema>;
export type Voiceover = z.infer<typeof VoiceoverSchema>;
export type DemoVideoProject = z.infer<typeof DemoVideoProjectSchema>;
export type RenderDemoVideoRequest = z.infer<typeof RenderDemoVideoRequestSchema>;

export const demoBriefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "projectName",
    "oneLiner",
    "targetUser",
    "demoNarrative",
    "demoScript2Min",
    "demoSteps",
    "claims",
    "providerUsage",
    "risks",
    "nextSteps",
  ],
  properties: {
    projectName: { type: "string" },
    oneLiner: { type: "string" },
    targetUser: { type: "string" },
    demoNarrative: { type: "string" },
    demoScript2Min: { type: "string" },
    demoSteps: { type: "array", minItems: 1, items: { type: "string" } },
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
