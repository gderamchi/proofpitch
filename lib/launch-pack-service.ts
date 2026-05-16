import { generatePitchPackWithRunLogs } from "./pitch-pack";
import { captureLaunchDemo } from "./launch-capture";
import { buildReleaseAssets, type ReleaseAssets } from "./release-assets";
import { getLocalLaunchPack, saveLocalLaunchPack } from "./local-store";
import {
  CreateLaunchPackRequestSchema,
  LaunchPackSchema,
  type CreateLaunchPackRequest,
  type LaunchPack,
} from "./schemas";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "./supabase/server";
import { getAuthenticatedUser, getRequiredSupabaseContext } from "./pitch-pack-service";

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
  const demoScript = [
    `Open ${input.productName} at ${input.sourceUrl}.`,
    input.demoInstructions || "Show the first meaningful product workflow from the public page.",
    "Pause on the strongest proof moment and connect it to the release promise.",
    "Use the separate pitch deck after the product demo, not as a replacement for it.",
  ].join(" ");

  return LaunchPackSchema.parse({
    id: crypto.randomUUID(),
    status: "completed",
    sourceUrl: input.sourceUrl,
    productName: input.productName,
    targetAudience: input.targetAudience,
    launchGoal: input.launchGoal,
    demoInstructions: input.demoInstructions,
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
