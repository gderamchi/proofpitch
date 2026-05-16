import { NextResponse } from "next/server";

import { transcribeWithGradium } from "@/lib/gradium";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      {
        error: "Missing audio file.",
      },
      { status: 400 },
    );
  }

  const result = await transcribeWithGradium(audio);
  const status = result.report.state === "failed" ? 502 : 200;

  return NextResponse.json(result, { status });
}
