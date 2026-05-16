import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { exportPitchPack } from "@/lib/pitch-pack-service";
import { ExportRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = ExportRequestSchema.parse(body);
    const result = await exportPitchPack(id, input.type);

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to export pitch pack.", detail }, { status: 500 });
  }
}
