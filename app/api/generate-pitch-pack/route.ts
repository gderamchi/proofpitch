import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { createPitchPack, QuotaExceededError } from "@/lib/pitch-pack-service";
import { GeneratePitchPackRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

function formatZodError(error: ZodError) {
  return z.treeifyError(error);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = GeneratePitchPackRequestSchema.parse(body);
    const result = await createPitchPack(input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
          details: formatZodError(error),
        },
        { status: 400 },
      );
    }

    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "Monthly Release Pack quota exceeded.",
          quota: error.quota,
          nextActions: ["wait_next_month"],
        },
        { status: 402 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json(
      {
        error: "Unable to generate pitch pack.",
        detail: message,
      },
      { status: 500 },
    );
  }
}
