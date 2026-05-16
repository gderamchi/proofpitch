import { NextResponse } from "next/server";

import { getProductHuntAutofillPayload } from "@/lib/launch-pack-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const payload = await getProductHuntAutofillPayload(id, token);

    if (!payload) {
      return NextResponse.json({ error: "Autofill payload not found." }, { status: 404 });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch Product Hunt autofill payload.", detail }, { status: 500 });
  }
}
