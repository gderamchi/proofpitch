import { NextResponse } from "next/server";

import { getBillingHealth } from "@/lib/billing";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";

function providerHealth(envName: string) {
  return {
    configured: Boolean(process.env[envName]),
  };
}

async function getSupabaseHealth() {
  const configured = hasSupabaseAdminEnv();

  if (!configured) {
    return {
      configured: false,
      database: { ok: false, detail: "Supabase env vars are not fully configured." },
      exportBucket: { ok: false, detail: "Supabase env vars are not fully configured." },
    };
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return {
      configured: true,
      database: { ok: false, detail: "Unable to create Supabase admin client." },
      exportBucket: { ok: false, detail: "Unable to create Supabase admin client." },
    };
  }

  const [{ error: databaseError }, { data: bucket, error: bucketError }] = await Promise.all([
    admin.from("organizations").select("id").limit(1),
    admin.storage.getBucket("proofpitch-exports"),
  ]);

  return {
    configured: true,
    database: databaseError
      ? { ok: false, detail: databaseError.message }
      : { ok: true, detail: "Database reachable." },
    exportBucket: bucketError
      ? { ok: false, detail: bucketError.message }
      : { ok: true, detail: bucket.public ? "Bucket exists but is public." : "Private export bucket exists." },
  };
}

export async function GET() {
  const supabase = await getSupabaseHealth();
  const providers = {
    openai: providerHealth("OPENAI_API_KEY"),
    tavily: providerHealth("TAVILY_API_KEY"),
    pioneer: providerHealth("PIONEER_API_KEY"),
  };
  const ok =
    supabase.configured ? supabase.database.ok && supabase.exportBucket.ok : true;

  return NextResponse.json({
    ok,
    service: "proofpitch",
    providers,
    supabase,
    billing: getBillingHealth(),
    hasOpenAI: providers.openai.configured,
    hasTavily: providers.tavily.configured,
    hasPioneer: providers.pioneer.configured,
    hasSupabase: supabase.configured,
    billingMode: process.env.BILLING_MODE || "manual",
  });
}
