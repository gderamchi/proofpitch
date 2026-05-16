import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { GeneratePitchPackRequestSchema } from "@/lib/schemas";
import { researchWithTavily } from "@/lib/tavily";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = GeneratePitchPackRequestSchema.parse(body);
    const result = await researchWithTavily(input.rawInput, input.projectUrl);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: "Tavily route failed.", detail }, { status: 500 });
  }
}
