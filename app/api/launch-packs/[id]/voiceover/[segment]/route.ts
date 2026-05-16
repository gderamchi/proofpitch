import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedVoiceoverSegmentPath } from "@/lib/release-paths";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
    segment: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, segment } = await context.params;

  if (!/^[a-zA-Z0-9-]+$/.test(id) || !/^\d+$/.test(segment)) {
    return NextResponse.json({ error: "Invalid voiceover segment." }, { status: 400 });
  }

  try {
    const audio = await readFile(renderedVoiceoverSegmentPath(id, segment));

    return new Response(new Uint8Array(audio), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": String(audio.byteLength),
        "Content-Type": "audio/wav",
      },
    });
  } catch {
    return NextResponse.json({ error: "Voiceover segment is not available yet." }, { status: 404 });
  }
}
