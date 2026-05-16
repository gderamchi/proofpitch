import { NextResponse } from "next/server";

import { getLaunchPackDetail } from "@/lib/launch-pack-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getLaunchPackDetail(id);

    if (!result) {
      return NextResponse.json({ error: "Release pack not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch release pack.", detail }, { status: 500 });
  }
}
