import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getSessionPayload } from "@/lib/pitch-pack-service";
import { AuthCredentialsSchema } from "@/lib/schemas";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseRouteClient();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const input = AuthCredentialsSchema.parse(body);
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      return NextResponse.json({
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
            }
          : null,
        needsEmailConfirmation: true,
      });
    }

    return NextResponse.json(await getSessionPayload());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to sign up.", detail }, { status: 500 });
  }
}
