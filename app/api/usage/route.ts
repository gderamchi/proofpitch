import { NextResponse } from "next/server";

import { getUsageSnapshot } from "@/lib/pitch-pack-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      quota: await getUsageSnapshot(),
      pricing: {
        mode: "documentation_only",
        docs: "docs/BUSINESS_PLAN.md",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch usage.", detail }, { status: 500 });
  }
}
