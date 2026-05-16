import { NextResponse } from "next/server";

import { getSessionPayload, UnauthorizedError } from "@/lib/pitch-pack-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getSessionPayload());
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ configured: true, user: null, organization: null, quota: null });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch session.", detail }, { status: 500 });
  }
}
