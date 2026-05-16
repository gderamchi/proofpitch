import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  CheckoutPlanSchema,
  createBillingCheckoutSession,
} from "@/lib/billing";
import {
  getRequiredSupabaseContext,
  UnauthorizedError,
} from "@/lib/pitch-pack-service";

export const runtime = "nodejs";

const CheckoutRequestSchema = z.object({
  plan: CheckoutPlanSchema,
});

function getRequestOrigin(request: Request) {
  return request.headers.get("origin") ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CheckoutRequestSchema.parse(body);
    const ctx = await getRequiredSupabaseContext();
    const session = await createBillingCheckoutSession({
      plan: input.plan,
      origin: getRequestOrigin(request),
      ctx: {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        email: ctx.user.email,
      },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      mode: session.mode,
      plan: input.plan,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: z.treeifyError(error) }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json({ error: "Unable to create checkout session.", detail }, { status: 500 });
  }
}
