import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getLaunchPackDetail, markLaunchPackDemoVideoReady, startLaunchPackDeckRender } from "@/lib/launch-pack-service";
import { renderReleaseArtifacts } from "@/lib/release-renderer";
import { RenderLaunchDeckRequestSchema, RenderLaunchVideoRequestSchema } from "@/lib/schemas";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const LAUNCH_PACK_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

async function uploadRenderedVideo(launchPackId: string, videoPath: string) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const bytes = await readFile(videoPath);
  const storagePath = `launch-packs/${launchPackId}/demo-video.mp4`;
  const bucket = admin.storage.from("proofpitch-exports");
  const { error: uploadError } = await bucket.upload(storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });

  if (uploadError) {
    throw new Error(`Video rendered but upload failed: ${uploadError.message}`);
  }

  const { data, error: signedUrlError } = await bucket.createSignedUrl(storagePath, 60 * 60);

  if (signedUrlError) {
    throw new Error(`Video rendered but signed URL creation failed: ${signedUrlError.message}`);
  }

  return data.signedUrl;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!LAUNCH_PACK_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid release pack id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const videoRenderRequested = body.renderVideo === true;

    if (!videoRenderRequested) {
      const input = RenderLaunchDeckRequestSchema.parse(body);
      const result = await startLaunchPackDeckRender(id, input);

      if (!result) {
        return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
      }

      return NextResponse.json({
        launchPack: result.launchPack,
        pitchDeck: result.launchPack.pitchDeck,
        render: result.render,
        requiresSignIn: false,
      });
    }

    const input = RenderLaunchVideoRequestSchema.parse(body);
    const detail = await getLaunchPackDetail(id);
    const launchPack = detail?.launchPack ?? input.launchPack;

    if (!launchPack || launchPack.id !== id) {
      return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
    }

    const result = await renderReleaseArtifacts({
      baseUrl: new URL(request.url).origin,
      launchPackId: id,
      pitchDeck: launchPack.pitchDeck,
      demoVideo: launchPack.demoVideo,
      captureSite: input.captureSite,
      dryRun: input.dryRun,
      renderDeck: false,
      renderVideo: true,
    });
    const videoArtifact = result.artifacts.find((artifact) => artifact.type === "video" && artifact.status === "ready");
    const uploadedVideoUrl = videoArtifact ? await uploadRenderedVideo(id, videoArtifact.path) : null;
    const videoUrl = uploadedVideoUrl ?? result.videoUrl;
    const updatedLaunchPack = videoArtifact && videoUrl
      ? await markLaunchPackDemoVideoReady({
          id,
          launchPack,
          videoUrl,
        })
      : null;

    return NextResponse.json({
      ...result,
      launchPack: updatedLaunchPack ?? launchPack,
      videoUrl,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to render release assets.", detail }, { status: 500 });
  }
}
