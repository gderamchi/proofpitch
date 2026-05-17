import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { getSessionPayload } from "@/lib/account-service";
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
    const input = AuthCredentialsSchema.omit({ name: true }).parse(body);
    const { error } = await supabase.auth.signInWithPassword(input);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(await getSessionPayload());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to log in.", detail }, { status: 500 });
  }
}
