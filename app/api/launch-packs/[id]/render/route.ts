import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getLaunchPackDetail, startLaunchPackDeckRender } from "@/lib/launch-pack-service";
import { renderReleaseArtifacts } from "@/lib/release-renderer";
import { RenderLaunchDeckRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const videoRenderRequested =
      body.renderVideo !== undefined || body.renderDeck !== undefined || body.captureSite !== undefined || body.force !== undefined;

    if (!videoRenderRequested) {
      const input = RenderLaunchDeckRequestSchema.parse(body);
      const result = await startLaunchPackDeckRender(id, input);

      if (!result) {
        return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
      }

      return NextResponse.json({
        pitchDeck: result.launchPack.pitchDeck,
        render: result.render,
        requiresSignIn: false,
      });
    }

    const detail = await getLaunchPackDetail(id);
    const launchPack = detail?.launchPack ?? body.launchPack;

    if (!launchPack || launchPack.id !== id) {
      return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
    }

    const result = await renderReleaseArtifacts({
      baseUrl: new URL(request.url).origin,
      launchPackId: id,
      pitchDeck: launchPack.pitchDeck,
      demoVideo: launchPack.demoVideo,
      captureSite: body.captureSite !== false,
      dryRun: body.dryRun === true,
      force: body.force === true,
      renderDeck: body.renderDeck === true,
      renderVideo: body.renderVideo !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to render release assets.", detail }, { status: 500 });
  }
}
