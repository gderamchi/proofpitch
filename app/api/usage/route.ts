import { NextResponse } from "next/server";

import { getUsageSnapshot } from "@/lib/pitch-pack-service";
import { getPricingPlans, SINGLE_RELEASE_PACK_PRICE_EUR } from "@/lib/plans";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      quota: await getUsageSnapshot(),
      plans: getPricingPlans(),
      singleReleasePack: {
        priceEur: SINGLE_RELEASE_PACK_PRICE_EUR,
        creditsAdded: 1,
        billingMode: "manual",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch usage.", detail }, { status: 500 });
  }
}
