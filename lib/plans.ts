export const PLAN_IDS = ["free", "founder", "pro", "agency", "enterprise"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export type PricingPlan = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  monthlyPackLimit: number;
  seats: string;
  cta: string;
  featured?: boolean;
  description: string;
  features: string[];
};

export const SINGLE_RELEASE_PACK_PRICE_EUR = 49;
export const FREE_ACCESS_PACK_LIMIT = Number.MAX_SAFE_INTEGER;

const DEFAULT_LIMITS: Record<PlanId, number> = {
  free: 1,
  founder: 10,
  pro: 40,
  agency: 150,
  enterprise: 1000,
};

const LIMIT_ENV: Record<PlanId, string> = {
  free: "PROOFPITCH_FREE_PACK_LIMIT",
  founder: "PROOFPITCH_FOUNDER_PACK_LIMIT",
  pro: "PROOFPITCH_PRO_PACK_LIMIT",
  agency: "PROOFPITCH_AGENCY_PACK_LIMIT",
  enterprise: "PROOFPITCH_ENTERPRISE_PACK_LIMIT",
};

export function getBillingMode() {
  return process.env.BILLING_MODE || "manual";
}

export function getRuntimeBillingMode() {
  return "free-access";
}

export function getRuntimePackLimit() {
  return FREE_ACCESS_PACK_LIMIT;
}

export function getPlanLimit(plan: PlanId) {
  const value = process.env[LIMIT_ENV[plan]];
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;

  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_LIMITS[plan];
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function normalizePlan(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

export function getPricingPlans(): PricingPlan[] {
  return [
    {
      id: "free",
      name: "Free",
      price: "0€",
      cadence: "forever",
      monthlyPackLimit: getPlanLimit("free"),
      seats: "1 seat",
      cta: "Start free",
      description: "Validate the workflow once before committing.",
      features: ["1 Release Pack / month", "Claim ledger", "Slidev export"],
    },
    {
      id: "founder",
      name: "Founder",
      price: "39€",
      cadence: "/ month",
      monthlyPackLimit: getPlanLimit("founder"),
      seats: "1 seat",
      cta: "Start Founder",
      description: "For a founder turning notes into reusable GTM material.",
      features: ["10 Release Packs / month", "Saved history", "Markdown export"],
    },
    {
      id: "pro",
      name: "Pro",
      price: "99€",
      cadence: "/ month",
      monthlyPackLimit: getPlanLimit("pro"),
      seats: "3 seats",
      cta: "Start Pro",
      featured: true,
      description: "For small teams using ProofPitch every week.",
      features: ["40 Release Packs / month", "Brand voice ready", "Version history"],
    },
    {
      id: "agency",
      name: "Agency",
      price: "299€",
      cadence: "/ month",
      monthlyPackLimit: getPlanLimit("agency"),
      seats: "5 seats",
      cta: "Talk to us",
      description: "For client workspaces and repeated positioning work.",
      features: ["150 Release Packs / month", "Client workspaces", "White-label exports"],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      cadence: "",
      monthlyPackLimit: getPlanLimit("enterprise"),
      seats: "Custom seats",
      cta: "Contact",
      description: "For larger teams, security review, and bespoke limits.",
      features: ["Custom quota", "Admin controls", "Security review"],
    },
  ];
}

export function getPlanSnapshot(plan: PlanId) {
  return {
    plan,
    billingMode: getBillingMode(),
    monthlyLimit: getPlanLimit(plan),
    singleReleasePackPriceEur: SINGLE_RELEASE_PACK_PRICE_EUR,
  };
}
