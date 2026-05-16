import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { createLaunchPack } from "@/lib/launch-pack-service";
import { CreateLaunchPackRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function requestOrigin(request: Request) {
  const url = new URL(request.url);

  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateLaunchPackRequestSchema.parse(body);
    const result = await createLaunchPack(input, { origin: requestOrigin(request) });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to create release pack.", detail }, { status: 500 });
  }
}
