import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { OAuthProviderSchema } from "@/lib/social-oauth";

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
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing OAuth code." }, { status: 400 });
    }

    return NextResponse.json(
      {
        provider,
        connected: false,
        codeReceived: true,
        nextAction:
          "Token exchange and encrypted social_connections storage are intentionally gated before production credentials are added.",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Unsupported OAuth provider.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to finish OAuth flow.", detail }, { status: 500 });
  }
}
