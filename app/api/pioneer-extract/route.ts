import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { extractWithPioneer } from "@/lib/pioneer";

export const runtime = "nodejs";

const PioneerRequestSchema = z.object({
  rawInput: z.string().min(10).max(12000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = PioneerRequestSchema.parse(body);
    const result = await extractWithPioneer(input.rawInput);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: "Pioneer route failed.", detail }, { status: 500 });
  }
}
