import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { renderedDemoVideoPath } from "@/lib/demo-video-renderer";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const DEMO_VIDEO_ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const EXPORT_BUCKET = "proofpitch-exports";

function videoResponse(video: Uint8Array) {
  const body = new ArrayBuffer(video.byteLength);
  new Uint8Array(body).set(video);

  return new Response(body, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(video.byteLength),
      "Content-Type": "video/mp4",
    },
  });
}

async function readSupabaseVideo(projectId: string) {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const storagePath = `demo-videos/${projectId}/demo-video.mp4`;
  const { data, error } = await admin.storage.from(EXPORT_BUCKET).download(storagePath);

  if (error || !data) {
    return null;
  }

  return new Uint8Array(await data.arrayBuffer());
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!DEMO_VIDEO_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid demo video id." }, { status: 400 });
    }

    const video = await readFile(renderedDemoVideoPath(id));

    return videoResponse(new Uint8Array(video));
  } catch {
    const { id } = await context.params;
    const video = DEMO_VIDEO_ID_PATTERN.test(id) ? await readSupabaseVideo(id) : null;

    if (video) {
      return videoResponse(video);
    }

    return NextResponse.json({ error: "Demo video is not rendered yet." }, { status: 404 });
  }
}
