import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { startLaunchPackDeckRender } from "@/lib/launch-pack-service";
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
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to render release assets.", detail }, { status: 500 });
  }
}
