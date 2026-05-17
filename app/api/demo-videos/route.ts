import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { createDemoVideoProject } from "@/lib/demo-video-service";
import { CreateDemoVideoRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateDemoVideoRequestSchema.parse(body);
    const result = await createDemoVideoProject(input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to create demo video project.", detail }, { status: 500 });
  }
}
