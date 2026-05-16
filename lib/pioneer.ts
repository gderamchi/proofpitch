import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import type { ProviderReport } from "./schemas";

export type PioneerExtraction = {
  entities: Array<{ type: string; value: string }>;
  claimRisk?: string;
  raw?: unknown;
  report: ProviderReport;
};

type PioneerResponse = {
  result?:
    | unknown[]
    | {
        data?: {
          entities?: Record<string, string[]>;
          claim_risk?: string;
        };
      };
};

function extractEntities(raw: PioneerResponse) {
  if (Array.isArray(raw.result)) {
    return raw.result
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as Record<string, unknown>;
        const type = typeof record.type === "string" ? record.type : typeof record.label === "string" ? record.label : null;
        const value = typeof record.value === "string" ? record.value : typeof record.text === "string" ? record.text : null;

        return type && value ? { type, value } : null;
      })
      .filter((item): item is { type: string; value: string } => Boolean(item));
  }

  const nested = raw.result?.data?.entities;

  if (!nested) {
    return [];
  }

  return Object.entries(nested).flatMap(([type, values]) => values.map((value) => ({ type, value })));
}

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

    const raw = (await response.json()) as PioneerResponse;
    const entities = extractEntities(raw);
    const claimRisk = Array.isArray(raw.result) ? undefined : raw.result?.data?.claim_risk;

    return {
      entities,
      claimRisk,
      raw,
      report: {
        state: "used",
        detail: `Pioneer returned ${entities.length} extraction item(s)${
          claimRisk ? ` with ${claimRisk} claim risk` : ""
        }.`,
      },
    };
  } catch (error) {
    return {
      entities: [],
      report: providerFailed("pioneer", error),
    };
  }
}
