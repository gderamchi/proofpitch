import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedDemoVideoPath } from "@/lib/release-renderer";

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
    const video = await readFile(renderedDemoVideoPath(id));

    return new Response(new Uint8Array(video), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": String(video.byteLength),
        "Content-Type": "video/mp4",
      },
    });
  } catch {
    return NextResponse.json({ error: "Demo video is not rendered yet." }, { status: 404 });
  }
}
