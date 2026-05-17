import { NextResponse } from "next/server";

import { getDemoVideoProjectDetail } from "@/lib/demo-video-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await getDemoVideoProjectDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Demo video project not found." }, { status: 404 });
    }

    return NextResponse.json(detail.project);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch demo video project.", detail }, { status: 500 });
  }
}
