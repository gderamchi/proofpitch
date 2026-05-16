import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Checkout is disabled while ProofPitch is in free access mode.",
      pricing: {
        mode: "documentation_only",
        docs: "docs/BUSINESS_PLAN.md",
      },
    },
    { status: 410 },
  );
}
