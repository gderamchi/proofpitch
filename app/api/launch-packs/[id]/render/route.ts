import { NextResponse } from "next/server";

import { getLaunchPackDetail } from "@/lib/launch-pack-service";
import { renderReleaseArtifacts } from "@/lib/release-renderer";

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
    const detail = await getLaunchPackDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
    }

    const result = await renderReleaseArtifacts({
      launchPackId: id,
      pitchDeck: detail.launchPack.pitchDeck,
      demoVideo: detail.launchPack.demoVideo,
      dryRun: body.dryRun !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to render release assets.", detail }, { status: 500 });
  }
}
