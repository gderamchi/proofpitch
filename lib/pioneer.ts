import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import type { ProviderReport } from "./schemas";

export type PioneerExtraction = {
  entities: unknown[];
  raw?: unknown;
  report: ProviderReport;
};

export async function extractWithPioneer(rawInput: string): Promise<PioneerExtraction> {
  const apiKey = process.env.PIONEER_API_KEY;

  if (!apiKey) {
    return {
      entities: [],
      report: providerMissing("pioneer", "PIONEER_API_KEY"),
    };
  }

  try {
    const response = await fetchWithRetry("https://api.pioneer.ai/inference", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: process.env.PIONEER_MODEL_ID || "fastino/gliner2-base-v1",
        text: rawInput,
        schema: {
          entities: ["project", "product", "technology", "metric", "user", "problem", "claim"],
          classifications: [
            {
              task: "claim_risk",
              labels: ["supported", "weak", "unsupported", "user_provided"],
            },
          ],
        },
        threshold: 0.35,
      }),
    }, { timeoutMs: 20_000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();
    const entities = Array.isArray((raw as { result?: unknown[] }).result)
      ? ((raw as { result: unknown[] }).result)
      : [];

    return {
      entities,
      raw,
      report: {
        state: "used",
        detail: `Pioneer returned ${entities.length} extraction item(s).`,
      },
    };
  } catch (error) {
    return {
      entities: [],
      report: providerFailed("pioneer", error),
    };
  }
}
