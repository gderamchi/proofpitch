import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { buildOAuthStartUrl, OAuthProviderSchema } from "@/lib/social-oauth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { provider: rawProvider } = await context.params;
    const provider = OAuthProviderSchema.parse(rawProvider);
    const result = buildOAuthStartUrl(provider, request.url);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Unsupported OAuth provider.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to start OAuth flow.", detail }, { status: 501 });
  }
}
