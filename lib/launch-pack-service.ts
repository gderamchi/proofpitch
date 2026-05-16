import { generatePitchPackWithRunLogs } from "./pitch-pack";
import { captureLaunchDemo } from "./launch-capture";
import {
  buildApprovedPitchDeck,
  buildReleaseAssets,
  type ReleaseAssets,
} from "./release-assets";
import { getLocalLaunchPack, saveLocalLaunchPack, updateLocalLaunchPack } from "./local-store";
import { buildClaimReview } from "./deck-spec";
import { renderReleaseArtifacts } from "./release-renderer";
import {
  ApproveDeckOutlineRequestSchema,
  CreateLaunchPackRequestSchema,
  LaunchPackSchema,
  RenderLaunchDeckRequestSchema,
  type ApproveDeckOutlineRequest,
  type CreateLaunchPackRequest,
  type LaunchPack,
  type RenderLaunchDeckRequest,
} from "./schemas";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "./supabase/server";
import { getAuthenticatedUser, getRequiredSupabaseContext } from "./pitch-pack-service";
import { readFile } from "node:fs/promises";

type LaunchPackDetail = {
  launchPack: LaunchPack;
};

type SupabaseContext = Awaited<ReturnType<typeof getRequiredSupabaseContext>>;

export class LaunchPackNotFoundError extends Error {
  code = "launch_pack_not_found";

  constructor() {
    super("Release pack not found.");
  }
}

async function getLaunchContext(): Promise<SupabaseContext | null> {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  return getRequiredSupabaseContext();
}

function shortGoal(input: CreateLaunchPackRequest) {
  return input.launchGoal.replace(/\s+/g, " ").trim();
}

function buildRawPitchInput(input: CreateLaunchPackRequest) {
  return [
    `${input.productName} needs a focused pitch deck and a real product demo video.`,
    `Deck mode: ${input.deckMode}.`,
    `Audience: ${input.targetAudience}.`,
    `Release goal: ${shortGoal(input)}.`,
    input.demoInstructions
      ? `Demo path: ${input.demoInstructions}.`
      : "Demo path: infer the strongest public walkthrough from the product URL.",
    "Create conservative copy with visible proof and no unsupported metrics.",
  ].join("\n");
}

function buildLaunchPack({
  input,
  pitchPack,
  screenshots,
  captureNotes,
  releaseAssets,
  providers,
}: {
  input: CreateLaunchPackRequest;
  pitchPack: LaunchPack["pitchPack"];
  screenshots: LaunchPack["screenshots"];
  captureNotes: string[];
  releaseAssets: ReleaseAssets;
  providers: LaunchPack["providers"];
}): LaunchPack {
  const now = new Date().toISOString();
  const claimReview = buildClaimReview(pitchPack);
  const demoScript = [
    `Open ${input.productName} at ${input.sourceUrl}.`,
    input.demoInstructions || "Show the first meaningful product workflow from the public page.",
    "Pause on the strongest proof moment and connect it to the release promise.",
    "Use the separate pitch deck after the product demo, not as a replacement for it.",
  ].join(" ");

  return LaunchPackSchema.parse({
    id: crypto.randomUUID(),
    status: "running",
    sourceUrl: input.sourceUrl,
    productName: input.productName,
    targetAudience: input.targetAudience,
    launchGoal: input.launchGoal,
    demoInstructions: input.demoInstructions,
    deckMode: input.deckMode,
    claimReview,
    demoScript,
    captions: [
      `${input.productName}: ${pitchPack.oneLiner}`,
      "Product demo and pitch deck are separate assets.",
      "Claims stay reviewable before external use.",
      ...captureNotes.slice(0, 1),
    ],
    screenshots,
    demoVideo: releaseAssets.demoVideo,
    pitchDeck: releaseAssets.pitchDeck,
    launchChecklist: releaseAssets.releaseChecklist,
    pitchPack,
    providers,
    createdAt: now,
    updatedAt: now,
  });
}

async function saveSupabaseLaunchPack(ctx: SupabaseContext, launchPack: LaunchPack) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error } = await admin.from("launch_packs").insert({
    id: launchPack.id,
    organization_id: ctx.organization.id,
    source_url: launchPack.sourceUrl,
    product_name: launchPack.productName,
    target_audience: launchPack.targetAudience,
    launch_goal: launchPack.launchGoal,
    status: launchPack.status,
    output_json: launchPack,
    video_url: launchPack.demoVideo.url ?? null,
    screenshots: launchPack.screenshots,
    created_by: ctx.user.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function updateSupabaseLaunchPack(ctx: SupabaseContext, launchPack: LaunchPack) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error } = await admin
    .from("launch_packs")
    .update({
      status: launchPack.status,
      output_json: launchPack,
      video_url: launchPack.demoVideo.url ?? null,
      screenshots: launchPack.screenshots,
    })
    .eq("id", launchPack.id)
    .eq("organization_id", ctx.organization.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function persistLaunchPack(launchPack: LaunchPack) {
  const ctx = await getLaunchContext();

  if (ctx) {
    await updateSupabaseLaunchPack(ctx, launchPack);
    return {
      source: "supabase" as const,
      ctx,
    };
  }

  updateLocalLaunchPack(launchPack.id, launchPack);

  return {
    source: "local" as const,
    ctx: null,
  };
}

export async function createLaunchPack(input: CreateLaunchPackRequest): Promise<LaunchPack> {
  const launchInput = CreateLaunchPackRequestSchema.parse(input);
  const [generation, capture, ctx] = await Promise.all([
    generatePitchPackWithRunLogs({
      rawInput: buildRawPitchInput(launchInput),
      projectUrl: launchInput.sourceUrl,
    }),
    captureLaunchDemo(launchInput),
    getLaunchContext(),
  ]);
  const { pitchPack, providers } = generation;
  const launchPack = buildLaunchPack({
    input: launchInput,
    pitchPack,
    screenshots: capture.screenshots,
    captureNotes: capture.notes,
    releaseAssets: await buildReleaseAssets({
      input: launchInput,
      pitchPack,
      screenshots: capture.screenshots,
      captureVideoUrl: capture.videoUrl,
    }),
    providers,
  });

  if (ctx) {
    await saveSupabaseLaunchPack(ctx, launchPack);
  } else {
    saveLocalLaunchPack(launchPack);
  }

  return launchPack;
}

function launchPackInput(launchPack: LaunchPack): CreateLaunchPackRequest {
  return {
    sourceUrl: launchPack.sourceUrl,
    productName: launchPack.productName,
    targetAudience: launchPack.targetAudience,
    launchGoal: launchPack.launchGoal,
    demoInstructions: launchPack.demoInstructions,
    deckMode: launchPack.deckMode,
  };
}

export async function approveLaunchPackDeckOutline(
  id: string,
  input: ApproveDeckOutlineRequest,
): Promise<LaunchPack | null> {
  const approval = ApproveDeckOutlineRequestSchema.parse(input);
  const detail = await getLaunchPackDetail(id);

  if (!detail && approval.launchPack?.id !== id) {
    return null;
  }

  const base = detail?.launchPack ?? approval.launchPack;

  if (!base) {
    return null;
  }

  const pitchDeck = buildApprovedPitchDeck({
    input: launchPackInput(base),
    pitchPack: base.pitchPack,
    acceptedClaimIds: approval.acceptedClaimIds,
    screenshots: base.screenshots,
  });

  if (!pitchDeck.outline.acceptedClaimIds.length) {
    throw new Error("Accept at least one supported, weak, or user-provided claim for the deck.");
  }

  const accepted = new Set(pitchDeck.outline.acceptedClaimIds);
  const updated = LaunchPackSchema.parse({
    ...base,
    status: "completed",
    claimReview: {
      status: "approved",
      acceptedClaimIds: pitchDeck.outline.acceptedClaimIds,
      rejectedClaimIds: base.pitchPack.claims
        .filter((claim) => !accepted.has(claim.id))
        .map((claim) => claim.id),
    },
    pitchDeck,
    updatedAt: new Date().toISOString(),
  });

  await persistLaunchPack(updated);

  return updated;
}

function patchPitchDeck(launchPack: LaunchPack, patch: Partial<LaunchPack["pitchDeck"]>) {
  return LaunchPackSchema.parse({
    ...launchPack,
    pitchDeck: {
      ...launchPack.pitchDeck,
      ...patch,
    },
    updatedAt: new Date().toISOString(),
  });
}

async function uploadRenderedPdf(ctx: SupabaseContext, launchPack: LaunchPack, pdfPath: string) {
  const bytes = await readFile(pdfPath);
  const storagePath = `launch-packs/${launchPack.id}/pitch-deck.pdf`;
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const bucket = admin.storage.from("proofpitch-exports");
  const { error: uploadError } = await bucket.upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error: signedUrlError } = await bucket.createSignedUrl(storagePath, 60 * 60);

  if (signedUrlError) {
    throw new Error(signedUrlError.message);
  }

  return {
    storageUrl: `storage://proofpitch-exports/${storagePath}`,
    signedUrl: data.signedUrl,
  };
}

export async function startLaunchPackDeckRender(
  id: string,
  input: RenderLaunchDeckRequest,
) {
  const request = RenderLaunchDeckRequestSchema.parse(input);
  const detail = await getLaunchPackDetail(id);

  if (!detail && request.launchPack?.id !== id) {
    return null;
  }

  const launchPack = detail?.launchPack ?? request.launchPack;

  if (!launchPack) {
    return null;
  }

  if (launchPack.pitchDeck.status !== "ready" || !launchPack.pitchDeck.markdown) {
    throw new Error("Approve the deck outline before rendering the PDF.");
  }

  const persistence = await persistLaunchPack(
    patchPitchDeck(launchPack, {
      renderState: request.dryRun ? "queued" : "running",
    }),
  );

  const runningPack = (await getLaunchPackDetail(id))?.launchPack ?? launchPack;
  const render = await renderReleaseArtifacts({
    launchPackId: id,
    pitchDeck: runningPack.pitchDeck,
    demoVideo: runningPack.demoVideo,
    dryRun: request.dryRun,
  });

  if (request.dryRun || !render.enabled) {
    const queued = patchPitchDeck(runningPack, { renderState: "queued" });
    await persistLaunchPack(queued);

    return {
      launchPack: queued,
      render,
      requiresSignIn: false,
    };
  }

  if (render.error) {
    const failed = patchPitchDeck(runningPack, {
      renderState: "failed",
      exports: runningPack.pitchDeck.exports.map((item) =>
        item.format === "pdf" ? { ...item, status: "failed" as const, error: render.error } : item,
      ),
    });
    await persistLaunchPack(failed);

    return {
      launchPack: failed,
      render,
      requiresSignIn: false,
    };
  }

  const pdf = render.artifacts.find((artifact) => artifact.type === "deck" && artifact.format === "pdf");
  let pdfExport = runningPack.pitchDeck.exports.find((item) => item.format === "pdf") ?? {
    format: "pdf" as const,
    status: "pending" as const,
  };

  if (pdf?.status === "ready") {
    pdfExport = {
      ...pdfExport,
      status: "ready",
      path: pdf.path,
    };

    if (persistence.source === "supabase") {
      pdfExport = {
        ...pdfExport,
        ...(await uploadRenderedPdf(persistence.ctx, runningPack, pdf.path)),
      };
    }
  }

  const ready = patchPitchDeck(runningPack, {
    renderState: pdf?.status === "ready" ? "ready" : "failed",
    exports: [
      pdfExport,
      ...runningPack.pitchDeck.exports.filter((item) => item.format !== "pdf"),
    ],
  });
  await persistLaunchPack(ready);

  return {
    launchPack: ready,
    render,
    requiresSignIn: false,
  };
}

async function getSupabaseLaunchPack(id: string): Promise<LaunchPackDetail | null> {
  const ctx = await getLaunchContext();

  if (!ctx) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { data: pack, error } = await admin
    .from("launch_packs")
    .select("output_json")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!pack) {
    return null;
  }

  return {
    launchPack: LaunchPackSchema.parse((pack as { output_json: unknown }).output_json),
  };
}

export async function getLaunchPackDetail(id: string): Promise<LaunchPackDetail | null> {
  const supabasePack = await getSupabaseLaunchPack(id);

  if (supabasePack) {
    return supabasePack;
  }

  const stored = getLocalLaunchPack(id);

  if (!stored) {
    return null;
  }

  return {
    launchPack: stored.launchPack,
  };
}
