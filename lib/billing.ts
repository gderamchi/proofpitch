import Stripe from "stripe";
import { z } from "zod";

import { normalizePlan, type PlanId } from "./plans";
import type { createSupabaseAdminClient } from "./supabase/server";

export const CheckoutPlanSchema = z.enum(["founder", "pro", "agency", "single"]);
export type CheckoutPlan = z.infer<typeof CheckoutPlanSchema>;

const STRIPE_API_VERSION = "2026-04-22.dahlia";

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type BillingContext = {
  organizationId: string;
  userId: string;
  email?: string;
};

const PRICE_ENV: Record<CheckoutPlan, string> = {
  founder: "STRIPE_FOUNDER_PRICE_ID",
  pro: "STRIPE_PRO_PRICE_ID",
  agency: "STRIPE_AGENCY_PRICE_ID",
  single: "STRIPE_SINGLE_PRICE_ID",
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getStripeClient() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function getCheckoutPriceId(plan: CheckoutPlan) {
  return requireEnv(PRICE_ENV[plan]);
}

export function getCheckoutMode(plan: CheckoutPlan) {
  return plan === "single" ? "payment" : "subscription";
}

export async function createBillingCheckoutSession({
  plan,
  origin,
  ctx,
}: {
  plan: CheckoutPlan;
  origin: string;
  ctx: BillingContext;
}) {
  const stripe = getStripeClient();
  const mode = getCheckoutMode(plan);
  const metadata = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    plan,
  };
  const session = await stripe.checkout.sessions.create({
    mode,
    customer_email: ctx.email,
    line_items: [
      {
        price: getCheckoutPriceId(plan),
        quantity: 1,
      },
    ],
    success_url: `${origin}/?checkout=success&plan=${plan}`,
    cancel_url: `${origin}/?checkout=cancelled&plan=${plan}`,
    client_reference_id: ctx.organizationId,
    metadata,
    subscription_data:
      mode === "subscription"
        ? {
            metadata,
          }
        : undefined,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    id: session.id,
    url: session.url,
    mode,
  };
}

export function constructStripeWebhookEvent(payload: string, signature: string | null) {
  if (!signature) {
    throw new Error("Missing Stripe signature.");
  }

  return getStripeClient().webhooks.constructEvent(
    payload,
    signature,
    requireEnv("STRIPE_WEBHOOK_SECRET"),
  );
}

export async function applyCheckoutEntitlement({
  admin,
  organizationId,
  plan,
}: {
  admin: SupabaseAdminClient;
  organizationId: string;
  plan: CheckoutPlan;
}) {
  if (plan === "single") {
    const { data, error } = await admin
      .from("organizations")
      .select("single_pack_credits")
      .eq("id", organizationId)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Organization not found.");
    }

    const currentCredits = Number((data as { single_pack_credits?: number }).single_pack_credits ?? 0);
    const { error: updateError } = await admin
      .from("organizations")
      .update({
        billing_mode: "stripe",
        single_pack_credits: currentCredits + 1,
      })
      .eq("id", organizationId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const normalizedPlan = normalizePlan(plan) as Exclude<PlanId, "free" | "enterprise">;
  const { error } = await admin
    .from("organizations")
    .update({
      plan: normalizedPlan,
      billing_mode: "stripe",
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

export function getBillingHealth() {
  const configuredPlans = Object.fromEntries(
    Object.entries(PRICE_ENV).map(([plan, envName]) => [plan, Boolean(process.env[envName])]),
  ) as Record<CheckoutPlan, boolean>;

  return {
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    configuredPlans,
    allPricesConfigured: Object.values(configuredPlans).every(Boolean),
  };
}
