import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedBrowserRecordingPath } from "@/lib/release-renderer";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid launch pack id." }, { status: 400 });
  }

  try {
    const video = await readFile(renderedBrowserRecordingPath(id));

    return new Response(new Uint8Array(video), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": String(video.byteLength),
        "Content-Type": "video/webm",
      },
    });
  } catch {
    return NextResponse.json({ error: "Browser recording is not available yet." }, { status: 404 });
  }
}
