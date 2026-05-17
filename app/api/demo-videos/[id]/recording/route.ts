import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedBrowserRecordingPath } from "@/lib/demo-video-renderer";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const DEMO_VIDEO_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!DEMO_VIDEO_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid demo video id." }, { status: 400 });
    }

    const video = await readFile(renderedBrowserRecordingPath(id));

    return new Response(new Uint8Array(video), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(video.byteLength),
        "Content-Type": "video/webm",
      },
    });
  } catch {
    return NextResponse.json({ error: "Browser recording is not rendered yet." }, { status: 404 });
  }
}
