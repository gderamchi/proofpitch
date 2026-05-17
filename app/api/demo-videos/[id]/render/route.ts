import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { startDemoVideoRender } from "@/lib/demo-video-service";
import { RenderDemoVideoRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const DEMO_VIDEO_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!DEMO_VIDEO_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid demo video id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const input = RenderDemoVideoRequestSchema.parse(body);
    const result = await startDemoVideoRender(id, input, new URL(request.url).origin);

    if (!result) {
      return NextResponse.json({ error: "Demo video project not found." }, { status: 404 });
    }

    return NextResponse.json({
      project: result.project,
      render: result.render,
      uploadWarnings: result.uploadWarnings,
      videoUrl: result.videoUrl,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to render demo video.", detail }, { status: 500 });
  }
}
