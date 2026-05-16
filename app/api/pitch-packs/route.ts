import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  createPitchPack,
  listPitchPacks,
} from "@/lib/pitch-pack-service";
import { GeneratePitchPackRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await listPitchPacks());
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to list pitch packs.", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = GeneratePitchPackRequestSchema.parse(body);

    return NextResponse.json(await createPitchPack(input));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to create pitch pack.", detail }, { status: 500 });
  }
}
