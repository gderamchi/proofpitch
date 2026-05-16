import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { generateFalMedia } from "@/lib/fal";

export const runtime = "nodejs";

const FalRequestSchema = z.object({
  prompt: z.string().min(10).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = FalRequestSchema.parse(body);
    const result = await generateFalMedia(input.prompt);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: "fal route failed.", detail }, { status: 500 });
  }
}
