import { readFile } from "node:fs/promises";

import { generateDemoBriefWithRunLogs } from "./demo-brief";
import { captureDemoVideo } from "./demo-capture";
import { getLocalDemoVideoProject, saveLocalDemoVideoProject, updateLocalDemoVideoProject } from "./local-store";
import {
  ApproveProofReviewRequestSchema,
  CreateDemoVideoRequestSchema,
  DemoVideoProjectSchema,
  RenderDemoVideoRequestSchema,
  type ApproveProofReviewRequest,
  type Claim,
  type CreateDemoVideoRequest,
  type DemoBrief,
  type DemoVideoProject,
  type RenderDemoVideoRequest,
} from "./schemas";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "./supabase/server";
import { getOptionalSupabaseContext, type SupabaseContext } from "./account-service";

const HYPERFRAMES_COMPOSITION_ID = "proofpitch-product-demo";
const EXPORT_BUCKET = "proofpitch-exports";
const DEFAULT_EXPORT_CONTENT_TYPES = [
  "application/pdf",
  "text/markdown;charset=utf-8",
  "text/markdown",
  "text/plain",
  "video/mp4",
  "audio/wav",
];

type DemoVideoProjectDetail = {
  project: DemoVideoProject;
};

export class DemoVideoProjectNotFoundError extends Error {
  code = "demo_video_project_not_found";

  constructor() {
    super("Demo video project not found.");
  }
}

function defaultAcceptedClaimIds(demoBrief: DemoBrief) {
  return demoBrief.claims
    .filter((claim) => claim.status !== "unsupported")
    .map((claim) => claim.id);
}

function buildProofReview(demoBrief: DemoBrief) {
  const acceptedClaimIds = defaultAcceptedClaimIds(demoBrief);
  const accepted = new Set(acceptedClaimIds);

  return {
    status: "pending" as const,
    acceptedClaimIds,
    rejectedClaimIds: demoBrief.claims
      .filter((claim) => !accepted.has(claim.id))
      .map((claim) => claim.id),
  };
}

function acceptedClaims(project: Pick<DemoVideoProject, "demoBrief" | "proofReview">): Claim[] {
  const accepted = new Set(project.proofReview.acceptedClaimIds);

  return project.demoBrief.claims.filter((claim) => accepted.has(claim.id) && claim.status !== "unsupported");
}

function compact(value: string, max = 520) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 3).replace(/\s+\S*$/, "")}...`;
}

function buildVoiceoverScript({
  demoBrief,
  input,
  proofReview,
}: {
  demoBrief: DemoBrief;
  input: Pick<CreateDemoVideoRequest, "sourceUrl" | "productName" | "targetAudience" | "demoGoal" | "demoInstructions">;
  proofReview: DemoVideoProject["proofReview"];
}) {
  const accepted = acceptedClaims({ demoBrief, proofReview });
  const proofLine = accepted[0]?.text
    ? `The proof to narrate is: ${accepted[0].text}.`
    : "No reviewed proof claim is ready yet, so keep the narration factual and screen-based.";

  return [
    `This is ${input.productName}.`,
    `It is being demonstrated for ${input.targetAudience}.`,
    `The goal is: ${input.demoGoal}.`,
    input.demoInstructions ? `Follow this path: ${input.demoInstructions}.` : `Open ${input.sourceUrl} and follow the clearest visible product workflow.`,
    compact(demoBrief.demoNarrative, 420),
    proofLine,
    ...demoBrief.demoSteps.slice(0, 4).map((step, index) => `Step ${index + 1}: ${step}`),
    "Close by inviting the viewer to inspect the product screen and the accepted proof claim.",
  ].join(" ");
}

function buildCaptions({
  demoBrief,
  input,
  proofReview,
}: {
  demoBrief: DemoBrief;
  input: Pick<CreateDemoVideoRequest, "productName" | "demoGoal">;
  proofReview: DemoVideoProject["proofReview"];
}) {
  const accepted = acceptedClaims({ demoBrief, proofReview });

  return [
    `${input.productName}: ${demoBrief.oneLiner}`,
    compact(input.demoGoal, 140),
    accepted[0]?.text ? `Proof: ${compact(accepted[0].text, 150)}` : "Proof review controls the final narration.",
    ...demoBrief.demoSteps.slice(0, 3),
  ].slice(0, 6);
}

function createRenderSpec({
  input,
  demoBrief,
  screenshots,
  proofReview,
}: {
  input: CreateDemoVideoRequest;
  demoBrief: DemoBrief;
  screenshots: DemoVideoProject["screenshots"];
  proofReview: DemoVideoProject["proofReview"];
}) {
  return {
    productName: input.productName,
    oneLiner: demoBrief.oneLiner,
    sourceUrl: input.sourceUrl,
    demoPath: input.demoInstructions,
    screenshots: screenshots.map((screenshot) => ({
      action: "capture" as const,
      title: screenshot.title,
      url: screenshot.url,
      alt: screenshot.alt,
      target: screenshot.title,
    })),
    demoSteps: [
      `Open ${input.productName} at ${input.sourceUrl}.`,
      input.demoInstructions || "Show the first meaningful public product workflow.",
      ...demoBrief.demoSteps.slice(0, 4),
    ],
    captions: buildCaptions({ demoBrief, input, proofReview }),
    voiceoverScript: buildVoiceoverScript({ demoBrief, input, proofReview }),
    designNotes:
      "Use ProofPitch's pale green workspace canvas, square bordered panels, dense founder-tool UI, readable captions, and restrained teal emphasis.",
    researchSummary: "Initial demo-video context only. The render worker can enrich this before writing the composition.",
  };
}

function buildDemoVideo({
  input,
  demoBrief,
  screenshots,
  captureVideoUrl,
  proofReview,
}: {
  input: CreateDemoVideoRequest;
  demoBrief: DemoBrief;
  screenshots: DemoVideoProject["screenshots"];
  captureVideoUrl?: string;
  proofReview: DemoVideoProject["proofReview"];
}) {
  const renderSpec = createRenderSpec({ input, demoBrief, screenshots, proofReview });

  if (captureVideoUrl) {
    return {
      status: "ready" as const,
      url: captureVideoUrl,
      uploadStatus: "uploaded" as const,
      durationSeconds: 60,
      renderer: "hyperframes" as const,
      compositionId: HYPERFRAMES_COMPOSITION_ID,
      renderSpec,
    };
  }

  return {
    status: "pending" as const,
    uploadStatus: "pending" as const,
    durationSeconds: 0,
    renderer: "hyperframes" as const,
    compositionId: HYPERFRAMES_COMPOSITION_ID,
    renderSpec,
    error:
      "Demo video is ready to render. Use the HyperFrames render action to capture the site and assemble the MP4.",
  };
}

function projectInput(project: DemoVideoProject): CreateDemoVideoRequest {
  return {
    sourceUrl: project.sourceUrl,
    productName: project.productName,
    targetAudience: project.targetAudience,
    demoGoal: project.demoGoal,
    demoInstructions: project.demoInstructions,
  };
}

function refreshNarration(project: DemoVideoProject): DemoVideoProject {
  const input = projectInput(project);
  const script = buildVoiceoverScript({
    demoBrief: project.demoBrief,
    input,
    proofReview: project.proofReview,
  });
  const captions = buildCaptions({
    demoBrief: project.demoBrief,
    input,
    proofReview: project.proofReview,
  });

  return DemoVideoProjectSchema.parse({
    ...project,
    captions,
    demoVideo: {
      ...project.demoVideo,
      renderSpec: project.demoVideo.renderSpec
        ? {
            ...project.demoVideo.renderSpec,
            captions,
            voiceoverScript: script,
          }
        : project.demoVideo.renderSpec,
    },
    voiceover: {
      status: project.voiceover.status === "ready" ? "pending" : project.voiceover.status,
      provider: "gradium",
      script,
      reason: project.voiceover.status === "captions_only" ? project.voiceover.reason : undefined,
    },
    updatedAt: new Date().toISOString(),
  });
}

async function saveSupabaseDemoVideoProject(ctx: SupabaseContext, project: DemoVideoProject) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error } = await admin.from("demo_video_projects").insert({
    id: project.id,
    organization_id: ctx.organization.id,
    source_url: project.sourceUrl,
    product_name: project.productName,
    target_audience: project.targetAudience,
    demo_goal: project.demoGoal,
    status: project.status,
    output_json: project,
    video_url: project.demoVideo.url ?? null,
    voiceover_url: project.voiceover.audioUrl ?? null,
    screenshots: project.screenshots,
    created_by: ctx.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateSupabaseDemoVideoProject(ctx: SupabaseContext, project: DemoVideoProject) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error } = await admin
    .from("demo_video_projects")
    .update({
      status: project.status,
      output_json: project,
      video_url: project.demoVideo.url ?? null,
      voiceover_url: project.voiceover.audioUrl ?? null,
      screenshots: project.screenshots,
    })
    .eq("id", project.id)
    .eq("organization_id", ctx.organization.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function persistDemoVideoProject(project: DemoVideoProject) {
  const ctx = await getOptionalSupabaseContext();

  if (ctx) {
    await updateSupabaseDemoVideoProject(ctx, project);
    return {
      source: "supabase" as const,
      ctx,
    };
  }

  if (!updateLocalDemoVideoProject(project)) {
    saveLocalDemoVideoProject({ project });
  }

  return {
    source: "local" as const,
    ctx: null,
  };
}

export async function createDemoVideoProject(input: CreateDemoVideoRequest): Promise<DemoVideoProject> {
  const demoInput = CreateDemoVideoRequestSchema.parse(input);
  const [generation, capture, ctx] = await Promise.all([
    generateDemoBriefWithRunLogs(demoInput),
    captureDemoVideo({
      sourceUrl: demoInput.sourceUrl,
      productName: demoInput.productName,
      targetAudience: demoInput.targetAudience,
      demoGoal: demoInput.demoGoal,
      demoInstructions: demoInput.demoInstructions,
    }),
    getOptionalSupabaseContext(),
  ]);
  const now = new Date().toISOString();
  const proofReview = buildProofReview(generation.demoBrief);
  const voiceoverScript = buildVoiceoverScript({
    demoBrief: generation.demoBrief,
    input: demoInput,
    proofReview,
  });
  const captions = buildCaptions({
    demoBrief: generation.demoBrief,
    input: demoInput,
    proofReview,
  });
  const project = DemoVideoProjectSchema.parse({
    id: crypto.randomUUID(),
    status: "running",
    sourceUrl: demoInput.sourceUrl,
    productName: demoInput.productName,
    targetAudience: demoInput.targetAudience,
    demoGoal: demoInput.demoGoal,
    demoInstructions: demoInput.demoInstructions,
    proofReview,
    demoBrief: generation.demoBrief,
    captions,
    screenshots: capture.screenshots,
    demoVideo: buildDemoVideo({
      input: demoInput,
      demoBrief: generation.demoBrief,
      screenshots: capture.screenshots,
      captureVideoUrl: capture.videoUrl,
      proofReview,
    }),
    voiceover: {
      status: "pending",
      provider: "gradium",
      script: voiceoverScript,
    },
    providers: generation.providers,
    createdAt: now,
    updatedAt: now,
  });

  if (ctx) {
    await saveSupabaseDemoVideoProject(ctx, project);
  } else {
    saveLocalDemoVideoProject({
      project,
      providerRunLogs: generation.providerRunLogs,
      sourceDocuments: generation.sourceDocuments,
    });
  }

  return project;
}

export async function approveDemoVideoProofReview(
  id: string,
  input: ApproveProofReviewRequest,
): Promise<DemoVideoProject | null> {
  const approval = ApproveProofReviewRequestSchema.parse(input);
  const detail = await getDemoVideoProjectDetail(id);

  if (!detail && approval.project?.id !== id) {
    return null;
  }

  const base = detail?.project ?? approval.project;

  if (!base) {
    return null;
  }

  const accepted = new Set(approval.acceptedClaimIds);
  const safeAcceptedClaimIds = base.demoBrief.claims
    .filter((claim) => accepted.has(claim.id) && claim.status !== "unsupported")
    .map((claim) => claim.id);

  if (!safeAcceptedClaimIds.length) {
    throw new Error("Accept at least one supported, weak, or user-provided claim for the demo narration.");
  }

  const safeAccepted = new Set(safeAcceptedClaimIds);
  const updated = refreshNarration({
    ...base,
    status: "completed",
    proofReview: {
      status: "approved",
      acceptedClaimIds: safeAcceptedClaimIds,
      rejectedClaimIds: base.demoBrief.claims
        .filter((claim) => !safeAccepted.has(claim.id))
        .map((claim) => claim.id),
    },
    updatedAt: new Date().toISOString(),
  });

  await persistDemoVideoProject(updated);

  return updated;
}

async function uploadRenderedAsset({
  contentType,
  localPath,
  projectId,
  storageName,
}: {
  contentType: string;
  localPath: string;
  projectId: string;
  storageName: string;
}) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const bytes = await readFile(localPath);
  const storagePath = `demo-videos/${projectId}/${storageName}`;
  const bucket = admin.storage.from(EXPORT_BUCKET);
  let { error: uploadError } = await bucket.upload(storagePath, bytes, {
    contentType,
    upsert: true,
  });

  if (isUnsupportedMimeError(uploadError, contentType)) {
    await ensureExportMimeTypeAllowed(admin, contentType);
    ({ error: uploadError } = await bucket.upload(storagePath, bytes, {
      contentType,
      upsert: true,
    }));
  }

  if (uploadError) {
    throw new Error(`${storageName} rendered but upload failed: ${uploadError.message}`);
  }

  const { data, error: signedUrlError } = await bucket.createSignedUrl(storagePath, 60 * 60);

  if (signedUrlError) {
    throw new Error(`${storageName} rendered but signed URL creation failed: ${signedUrlError.message}`);
  }

  return data.signedUrl;
}

function isUnsupportedMimeError(error: { message?: string } | null, contentType: string) {
  return Boolean(error?.message?.toLowerCase().includes(`mime type ${contentType.toLowerCase()} is not supported`));
}

async function ensureExportMimeTypeAllowed(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  contentType: string,
) {
  const { data } = await admin.storage.getBucket(EXPORT_BUCKET);
  const bucket = data as Record<string, unknown> | null;
  const rawAllowedTypes = bucket?.allowed_mime_types ?? bucket?.allowedMimeTypes;

  if (rawAllowedTypes === null) {
    return;
  }

  const allowedTypes = Array.isArray(rawAllowedTypes)
    ? rawAllowedTypes.filter((item): item is string => typeof item === "string")
    : DEFAULT_EXPORT_CONTENT_TYPES;

  if (allowedTypes.includes(contentType)) {
    return;
  }

  const { error } = await admin.storage.updateBucket(EXPORT_BUCKET, {
    public: false,
    allowedMimeTypes: [...allowedTypes, contentType],
  });

  if (error) {
    throw new Error(`Export bucket update failed for ${contentType}: ${error.message}`);
  }
}

export async function startDemoVideoRender(
  id: string,
  input: RenderDemoVideoRequest,
  baseUrl?: string,
) {
  const request = RenderDemoVideoRequestSchema.parse(input);
  const detail = await getDemoVideoProjectDetail(id);
  const project = detail?.project ?? request.project;

  if (!project || project.id !== id) {
    return null;
  }

  const { renderDemoVideoArtifacts } = await import("./demo-video-renderer");
  const result = await renderDemoVideoArtifacts({
    baseUrl,
    projectId: id,
    demoVideo: project.demoVideo,
    voiceover: project.voiceover,
    captureSite: request.captureSite,
    dryRun: request.dryRun,
  });
  const videoArtifact = result.artifacts.find((artifact) => artifact.type === "video" && artifact.status === "ready");
  const voiceoverArtifact = result.artifacts.find((artifact) => artifact.type === "voiceover" && artifact.status === "ready");
  const uploadWarnings: string[] = [];
  let uploadedVideoUrl: string | null = null;
  let uploadedVoiceoverUrl: string | null = null;

  if (videoArtifact) {
    try {
      uploadedVideoUrl = await uploadRenderedAsset({
        contentType: "video/mp4",
        localPath: videoArtifact.path,
        projectId: id,
        storageName: "demo-video.mp4",
      });
    } catch (error) {
      uploadWarnings.push(error instanceof Error ? error.message : "demo-video.mp4 rendered but upload failed.");
    }
  }

  if (voiceoverArtifact) {
    try {
      uploadedVoiceoverUrl = await uploadRenderedAsset({
        contentType: "audio/wav",
        localPath: voiceoverArtifact.path,
        projectId: id,
        storageName: "voiceover.wav",
      });
    } catch (error) {
      uploadWarnings.push(error instanceof Error ? error.message : "voiceover.wav rendered but upload failed.");
    }
  }

  const videoUrl = uploadedVideoUrl ?? result.videoUrl;
  const voiceoverAudioUrl = uploadedVoiceoverUrl ?? result.voiceover.audioUrl;
  const updated = DemoVideoProjectSchema.parse({
    ...project,
    status: videoArtifact ? "completed" : result.error ? "failed" : project.status,
    demoVideo: videoArtifact && videoUrl
      ? {
          ...project.demoVideo,
          status: "ready",
          url: videoUrl,
          durationSeconds: project.demoVideo.durationSeconds && project.demoVideo.durationSeconds > 0
            ? project.demoVideo.durationSeconds
            : 24,
          uploadStatus: videoUrl.startsWith("http") ? "uploaded" : "not_required",
          error: undefined,
        }
      : result.error
        ? {
            ...project.demoVideo,
            status: "failed",
            uploadStatus: "pending",
            error: result.error,
          }
        : project.demoVideo,
    voiceover: {
      ...result.voiceover,
      ...(voiceoverAudioUrl ? { audioUrl: voiceoverAudioUrl } : {}),
    },
    providers: {
      ...project.providers,
      gradium: result.gradium,
    },
    updatedAt: new Date().toISOString(),
  });

  await persistDemoVideoProject(updated);

  return {
    project: updated,
    render: result,
    uploadWarnings,
    videoUrl,
  };
}

async function getSupabaseDemoVideoProject(id: string): Promise<DemoVideoProjectDetail | null> {
  const ctx = await getOptionalSupabaseContext();

  if (!ctx) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { data: project, error } = await admin
    .from("demo_video_projects")
    .select("output_json")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!project) {
    return null;
  }

  return {
    project: DemoVideoProjectSchema.parse((project as { output_json: unknown }).output_json),
  };
}

export async function getDemoVideoProjectDetail(id: string): Promise<DemoVideoProjectDetail | null> {
  const supabaseProject = await getSupabaseDemoVideoProject(id);

  if (supabaseProject) {
    return supabaseProject;
  }

  const stored = getLocalDemoVideoProject(id);

  if (!stored) {
    return null;
  }

  return {
    project: stored.project,
  };
}
