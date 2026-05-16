import type { ProviderReport } from "./schemas";

export type ProviderName = "openai" | "tavily" | "fal" | "gradium" | "pioneer";

export type ProviderReports = Record<ProviderName, ProviderReport>;

export function initialProviderReports(): ProviderReports {
  return {
    openai: { state: "pending", detail: "Structured pitch generation not run yet." },
    tavily: { state: "pending", detail: "Research not run yet." },
    fal: { state: "pending", detail: "Media generation not run yet." },
    gradium: process.env.GRADIUM_API_KEY
      ? {
          state: "pending",
          detail: "Gradium is configured for /api/gradium-transcribe; no audio was uploaded in this text generation run.",
        }
      : { state: "missing", detail: "Voice skipped because GRADIUM_API_KEY is not configured." },
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
    process.env.FAL_KEY,
    process.env.GRADIUM_API_KEY,
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
