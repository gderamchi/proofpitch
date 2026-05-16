import { buildProductHuntAutofillUrl } from "./product-hunt-bookmarklet";
import { generatePitchPackWithRunLogs } from "./pitch-pack";
import { captureLaunchDemo } from "./launch-capture";
import { buildReleaseAssets, type ReleaseAssets } from "./release-assets";
import {
  getLocalLaunchPack,
  saveLocalLaunchPack,
  updateLocalLaunchPackDraft,
} from "./local-store";
import {
  ChannelDraftSchema,
  CreateLaunchPackRequestSchema,
  LaunchPackSchema,
  SocialChannelSchema,
  type ChannelDraft,
  type CreateLaunchPackRequest,
  type LaunchPack,
  type ProductHuntLaunch,
  type PublishLaunchPackRequest,
  type SocialChannel,
} from "./schemas";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "./supabase/server";
import {
  getAuthenticatedUser,
  getRequiredSupabaseContext,
} from "./pitch-pack-service";

type LaunchPackCreateResult = LaunchPack & {
  channelDrafts: ChannelDraft[];
};

type LaunchPackDetail = {
  launchPack: LaunchPack;
  channelDrafts: ChannelDraft[];
};

type SupabaseContext = Awaited<ReturnType<typeof getRequiredSupabaseContext>>;

const PRODUCT_HUNT_NEW_POST_URL = "https://www.producthunt.com/posts/new";

export class LaunchPackNotFoundError extends Error {
  code = "launch_pack_not_found";

  constructor() {
    super("Release pack not found.");
  }
}

export class ReviewRequiredError extends Error {
  code = "review_required";

  constructor() {
    super("Review confirmation is required before publishing.");
  }
}

export class SocialConnectionRequiredError extends Error {
  code = "connection_required";

  constructor(channel: SocialChannel) {
    super(`${channel} is not connected for this organization.`);
  }
}

function getPublicOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ||
    "http://localhost:3000"
  );
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
    `${input.productName} needs a release-ready pitch deck, demo video, voiceover, and social posts.`,
    `Audience: ${input.targetAudience}.`,
    `Release goal: ${shortGoal(input)}.`,
    input.demoInstructions ? `Demo path: ${input.demoInstructions}.` : "Demo path: infer the strongest public walkthrough from the product URL.",
    "Create release-ready copy with conservative claims and visible proof.",
  ].join("\n");
}

function buildProductHuntLaunch(
  input: CreateLaunchPackRequest,
  pitchPack: LaunchPack["pitchPack"],
  screenshots: LaunchPack["screenshots"],
  demoVideoUrl?: string,
): ProductHuntLaunch {
  const galleryUrls = screenshots.map((screenshot) => screenshot.url).slice(0, 8);

  return {
    productName: input.productName,
    tagline: pitchPack.oneLiner.slice(0, 80),
    topics: ["productivity", "marketing", "artificial-intelligence"],
    pricing: "Paid",
    thumbnailUrl: galleryUrls[0],
    galleryUrls,
    youtubeUrl: demoVideoUrl?.includes("youtube") ? demoVideoUrl : undefined,
    interactiveDemoUrl: input.sourceUrl,
    description: [
      pitchPack.executivePitch,
      "",
      "ProofPitch prepared the release assets with a review-first workflow. Product Hunt is an optional handoff after the pitch deck, demo video, voiceover, and posts are approved.",
    ].join("\n").trim(),
    makerComment: [
      `Hey Product Hunt, we are releasing ${input.productName}.`,
      pitchPack.problem,
      pitchPack.solution,
      "We would love feedback on whether this makes release prep more concrete for teams with a real product already live.",
    ].join("\n\n"),
    faq: [
      {
        question: "Does ProofPitch auto-submit the Product Hunt launch?",
        answer: "No. Product Hunt is an optional manual handoff after the release assets are reviewed.",
      },
      {
        question: "Where does the demo come from?",
        answer: "V1 starts from a public product URL and creates Remotion render props plus reviewable source captures.",
      },
    ],
    checklist: [
      "Review Product Hunt product name and tagline.",
      "Confirm topics, pricing, thumbnail, gallery, and demo URL.",
      "Upload or confirm the YouTube/Remotion demo video before release.",
      "Paste the maker comment as the first comment after posting.",
      "Submit manually from the maker account.",
    ],
  };
}

function buildLaunchPack({
  input,
  pitchPack,
  screenshots,
  captureNotes,
  releaseAssets,
}: {
  input: CreateLaunchPackRequest;
  pitchPack: LaunchPack["pitchPack"];
  screenshots: LaunchPack["screenshots"];
  captureNotes: string[];
  releaseAssets: ReleaseAssets;
}): LaunchPack {
  const now = new Date().toISOString();
  const demoScript = [
    `Open ${input.productName} at ${input.sourceUrl}.`,
    input.demoInstructions || "Show the first meaningful product workflow from the public page.",
    "Pause on the strongest proof moment and connect it to the release promise.",
    "Close with the generated deck, demo video, and safest next step.",
  ].join(" ");
  const videoUrl = releaseAssets.demoVideo.url;
  const productHunt = buildProductHuntLaunch(input, pitchPack, screenshots, videoUrl);
  const launchPack = LaunchPackSchema.parse({
    id: crypto.randomUUID(),
    status: "completed",
    sourceUrl: input.sourceUrl,
    productName: input.productName,
    targetAudience: input.targetAudience,
    launchGoal: input.launchGoal,
    releaseChannels: input.releaseChannels,
    demoInstructions: input.demoInstructions,
    demoScript,
    captions: [
      `${input.productName}: ${pitchPack.oneLiner}`,
      "Release video storyboard from the public product URL.",
      "Claims stay reviewable before publishing.",
      ...captureNotes.slice(0, 1),
    ],
    screenshots,
    demoVideo: releaseAssets.demoVideo,
    pitchDeck: releaseAssets.pitchDeck,
    voiceover: releaseAssets.voiceover,
    productHunt,
    socialPosts: releaseAssets.socialPosts,
    youtube: releaseAssets.youtube,
    launchChecklist: releaseAssets.releaseChecklist,
    pitchPack,
    createdAt: now,
    updatedAt: now,
  });

  return launchPack;
}

function createDrafts(launchPack: LaunchPack, origin = getPublicOrigin()): ChannelDraft[] {
  const now = new Date().toISOString();
  const productHuntToken = crypto.randomUUID();
  const productHuntAutofillUrl = buildProductHuntAutofillUrl({
    launchPackId: launchPack.id,
    token: productHuntToken,
    origin,
  });
  const base = {
    launchPackId: launchPack.id,
    reviewStatus: "pending_review" as const,
    createdAt: now,
    updatedAt: now,
  };

  const drafts: ChannelDraft[] = [];

  if (launchPack.releaseChannels.includes("product_hunt")) {
    drafts.push(ChannelDraftSchema.parse({
      ...base,
      id: crypto.randomUUID(),
      channel: "product_hunt",
      payload: launchPack.productHunt,
      publishStatus: "manual_handoff",
      safeAutofillUrl: productHuntAutofillUrl,
      autofillToken: productHuntToken,
      externalUrl: PRODUCT_HUNT_NEW_POST_URL,
    }));
  }

  if (launchPack.releaseChannels.includes("youtube")) {
    drafts.push(ChannelDraftSchema.parse({
      ...base,
      id: crypto.randomUUID(),
      channel: "youtube",
      payload: launchPack.youtube,
      publishStatus: "connection_required",
    }));
  }

  if (launchPack.releaseChannels.includes("linkedin")) {
    drafts.push(ChannelDraftSchema.parse({
      ...base,
      id: crypto.randomUUID(),
      channel: "linkedin",
      payload: launchPack.socialPosts.linkedin,
      publishStatus: "connection_required",
    }));
  }

  if (launchPack.releaseChannels.includes("x")) {
    drafts.push(ChannelDraftSchema.parse({
      ...base,
      id: crypto.randomUUID(),
      channel: "x",
      payload: { posts: launchPack.socialPosts.x },
      publishStatus: "connection_required",
    }));
  }

  return drafts;
}

async function saveSupabaseLaunchPack(
  ctx: SupabaseContext,
  launchPack: LaunchPack,
  channelDrafts: ChannelDraft[],
) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error: packError } = await admin.from("launch_packs").insert({
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

  if (packError) {
    throw new Error(packError.message);
  }

  const { error: draftError } = await admin.from("channel_drafts").insert(
    channelDrafts.map((draft) => ({
      id: draft.id,
      launch_pack_id: launchPack.id,
      organization_id: ctx.organization.id,
      channel: draft.channel,
      payload: draft.payload,
      review_status: draft.reviewStatus,
      publish_status: draft.publishStatus,
      safe_autofill_url: draft.safeAutofillUrl ?? null,
      autofill_token: draft.autofillToken ?? null,
      external_id: draft.externalId ?? null,
      external_url: draft.externalUrl ?? null,
      error: draft.error ?? null,
    })),
  );

  if (draftError) {
    throw new Error(draftError.message);
  }
}

export async function createLaunchPack(
  input: CreateLaunchPackRequest,
  options?: { origin?: string },
): Promise<LaunchPackCreateResult> {
  const launchInput = CreateLaunchPackRequestSchema.parse(input);
  const [{ pitchPack }, capture, ctx] = await Promise.all([
    generatePitchPackWithRunLogs({
      rawInput: buildRawPitchInput(launchInput),
      projectUrl: launchInput.sourceUrl,
    }).then((response) => ({
      pitchPack: response.pitchPack,
    })),
    captureLaunchDemo(launchInput),
    getLaunchContext(),
  ]);
  const launchPack = buildLaunchPack({
    input: launchInput,
    pitchPack,
    screenshots: capture.screenshots,
    captureNotes: capture.notes,
    releaseAssets: await buildReleaseAssets({
      input: launchInput,
      pitchPack,
      screenshots: capture.screenshots,
    }),
  });
  const channelDrafts = createDrafts(launchPack, options?.origin);

  if (ctx) {
    await saveSupabaseLaunchPack(ctx, launchPack, channelDrafts);
  } else {
    saveLocalLaunchPack(launchPack, channelDrafts);
  }

  return {
    ...launchPack,
    channelDrafts,
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

  const [{ data: pack, error: packError }, { data: drafts, error: draftsError }] = await Promise.all([
    admin
      .from("launch_packs")
      .select("output_json")
      .eq("id", id)
      .eq("organization_id", ctx.organization.id)
      .maybeSingle(),
    admin
      .from("channel_drafts")
      .select("id,launch_pack_id,channel,payload,review_status,publish_status,safe_autofill_url,autofill_token,external_id,external_url,error,created_at,updated_at")
      .eq("launch_pack_id", id)
      .eq("organization_id", ctx.organization.id),
  ]);

  if (packError) {
    throw new Error(packError.message);
  }

  if (draftsError) {
    throw new Error(draftsError.message);
  }

  if (!pack) {
    return null;
  }

  return {
    launchPack: LaunchPackSchema.parse((pack as { output_json: unknown }).output_json),
    channelDrafts: ((drafts ?? []) as Array<Record<string, unknown>>).map((draft) =>
      ChannelDraftSchema.parse({
        id: draft.id,
        launchPackId: draft.launch_pack_id,
        channel: draft.channel,
        payload: draft.payload,
        reviewStatus: draft.review_status,
        publishStatus: draft.publish_status,
        safeAutofillUrl: draft.safe_autofill_url ?? undefined,
        autofillToken: draft.autofill_token ?? undefined,
        externalId: draft.external_id ?? null,
        externalUrl: draft.external_url ?? null,
        error: draft.error ?? null,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
      }),
    ),
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
    channelDrafts: stored.channelDrafts,
  };
}

function requireReview(input: PublishLaunchPackRequest) {
  if (!input.reviewConfirmed) {
    throw new ReviewRequiredError();
  }
}

function getDraft(detail: LaunchPackDetail, channel: SocialChannel) {
  const draft = detail.channelDrafts.find((item) => item.channel === channel);

  if (!draft) {
    throw new LaunchPackNotFoundError();
  }

  return draft;
}

async function updateDraft(launchPackId: string, draft: ChannelDraft) {
  const ctx = await getLaunchContext();

  if (!ctx) {
    updateLocalLaunchPackDraft(launchPackId, draft);
    return;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase admin client is unavailable.");
  }

  const { error } = await admin
    .from("channel_drafts")
    .update({
      review_status: draft.reviewStatus,
      publish_status: draft.publishStatus,
      external_id: draft.externalId ?? null,
      external_url: draft.externalUrl ?? null,
      error: draft.error ?? null,
      updated_at: draft.updatedAt,
    })
    .eq("id", draft.id)
    .eq("organization_id", ctx.organization.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function publishLaunchPack(
  launchPackId: string,
  channel: SocialChannel,
  input: PublishLaunchPackRequest,
) {
  SocialChannelSchema.parse(channel);
  requireReview(input);
  const detail = await getLaunchPackDetail(launchPackId);

  if (!detail) {
    throw new LaunchPackNotFoundError();
  }

  const draft = getDraft(detail, channel);
  const reviewedDraft = ChannelDraftSchema.parse({
    ...draft,
    reviewStatus: "reviewed",
    updatedAt: new Date().toISOString(),
  });

  if (channel === "product_hunt") {
    const nextDraft = ChannelDraftSchema.parse({
      ...reviewedDraft,
      publishStatus: "manual_handoff",
      externalUrl: PRODUCT_HUNT_NEW_POST_URL,
    });

    await updateDraft(launchPackId, nextDraft);
    return nextDraft;
  }

  await updateDraft(launchPackId, {
    ...reviewedDraft,
    publishStatus: "connection_required",
    error: `${channel} OAuth connection required before publishing.`,
  });
  throw new SocialConnectionRequiredError(channel);
}

export async function getProductHuntAutofillPayload(launchPackId: string, token: string) {
  const detail = await getLaunchPackDetail(launchPackId);

  if (!detail) {
    return null;
  }

  const draft = detail.channelDrafts.find(
    (item) => item.channel === "product_hunt" && item.autofillToken === token,
  );

  if (!draft) {
    return null;
  }

  return {
    productHunt: detail.launchPack.productHunt,
    neverSubmit: true,
  };
}
