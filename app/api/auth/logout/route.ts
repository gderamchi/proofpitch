import { NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseRouteClient();

  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false });
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true });
}
