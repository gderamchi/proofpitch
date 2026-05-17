import { NextResponse } from "next/server";

import { getSessionPayload } from "@/lib/account-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getSessionPayload());
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch session.", detail }, { status: 500 });
  }
}
