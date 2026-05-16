import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  LaunchPackNotFoundError,
  publishLaunchPack,
  ReviewRequiredError,
  SocialConnectionRequiredError,
} from "@/lib/launch-pack-service";
import { PublishLaunchPackRequestSchema, SocialChannelSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
    channel: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id, channel: rawChannel } = await context.params;
    const channel = SocialChannelSchema.parse(rawChannel);
    const body = await request.json();
    const input = PublishLaunchPackRequestSchema.parse(body);
    const result = await publishLaunchPack(id, channel, input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    if (error instanceof ReviewRequiredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }

    if (error instanceof SocialConnectionRequiredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }

    if (error instanceof LaunchPackNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to publish release pack.", detail }, { status: 500 });
  }
}
