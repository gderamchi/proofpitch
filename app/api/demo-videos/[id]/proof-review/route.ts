import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { approveDemoVideoProofReview } from "@/lib/demo-video-service";
import { ApproveProofReviewRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = ApproveProofReviewRequestSchema.parse(body);
    const result = await approveDemoVideoProofReview(id, input);

    if (!result) {
      return NextResponse.json({ error: "Demo video project not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to approve proof review.", detail }, { status: 500 });
  }
}
