import { NextResponse } from "next/server";

import {
  applyCheckoutEntitlement,
  CheckoutPlanSchema,
  constructStripeWebhookEvent,
} from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const event = constructStripeWebhookEvent(payload, request.headers.get("stripe-signature"));

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const parsedPlan = CheckoutPlanSchema.safeParse(session.metadata?.plan);
      const organizationId = session.metadata?.organizationId;

      if (parsedPlan.success && organizationId) {
        const admin = createSupabaseAdminClient();

        if (!admin) {
          throw new Error("Supabase admin client is not configured.");
        }

        await applyCheckoutEntitlement({
          admin,
          organizationId,
          plan: parsedPlan.data,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to process Stripe webhook.", detail }, { status: 400 });
  }
}
