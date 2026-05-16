import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getPitchPackDetail, updatePitchPack } from "@/lib/pitch-pack-service";
import { UpdatePitchPackRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getPitchPackDetail(id);

    if (!result) {
      return NextResponse.json({ error: "Pitch pack not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to fetch pitch pack.", detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = UpdatePitchPackRequestSchema.parse(body);
    const result = await updatePitchPack(id, input);

    if (!result) {
      return NextResponse.json({ error: "Pitch pack not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to update pitch pack.", detail }, { status: 500 });
  }
}
