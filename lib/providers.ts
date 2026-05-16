import type { ProviderReport, ProviderReports } from "./schemas";

export type ProviderName = "openai" | "tavily" | "pioneer";

export function initialProviderReports(): ProviderReports {
  return {
    openai: { state: "pending", detail: "Structured pitch generation not run yet." },
    tavily: { state: "pending", detail: "Research not run yet." },
    pioneer: { state: "pending", detail: "Claim extraction not run yet." },
  };
}

export function providerMissing(name: ProviderName, envName: string): ProviderReport {
  return {
    state: "missing",
    detail: `${name} skipped because ${envName} is not configured.`,
  };
}

function redactKnownSecrets(detail: string) {
  const secretValues = [
    process.env.OPENAI_API_KEY,
    process.env.TAVILY_API_KEY,
    process.env.PIONEER_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((value): value is string => Boolean(value && value.length >= 8));

  return secretValues.reduce(
    (current, secret) => current.replaceAll(secret, "[redacted]"),
    detail
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [redacted]")
      .replace(/Key\s+[A-Za-z0-9._:-]{8,}/gi, "Key [redacted]"),
  );
}

export function sanitizeProviderDetail(detail: string) {
  return redactKnownSecrets(detail).replace(/\s+/g, " ").trim().slice(0, 800);
}

export function providerFailed(name: ProviderName, error: unknown): ProviderReport {
  const detail = error instanceof Error ? error.message : "Unknown provider error.";

  return {
    state: "failed",
    detail: sanitizeProviderDetail(`${name} failed: ${detail}`),
  };
}
