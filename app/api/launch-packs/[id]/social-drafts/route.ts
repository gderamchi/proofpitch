import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { rebuildLaunchPackSocialDrafts } from "@/lib/launch-pack-service";
import { RefreshSocialDraftsRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const LAUNCH_PACK_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!LAUNCH_PACK_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid release pack id." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const input = RefreshSocialDraftsRequestSchema.parse(body);
    const result = await rebuildLaunchPackSocialDrafts(id, input);

    if (!result) {
      return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to refresh social drafts.", detail }, { status: 500 });
  }
}
