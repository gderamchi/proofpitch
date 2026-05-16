import { setTimeout as delay } from "node:timers/promises";

import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import type { ProviderReport } from "./schemas";

export type FalMediaResult = {
  url?: string;
  raw?: unknown;
  report: ProviderReport;
};

const FAL_MODEL_ID = "fal-ai/flux/schnell";
const FAL_QUEUE_URL = `https://queue.fal.run/${FAL_MODEL_ID}`;
const FAL_MAX_STATUS_POLLS = 45;
const FAL_STATUS_POLL_INTERVAL_MS = 1000;

type FalSubmitResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
};

type FalStatusResponse = {
  status?: string;
  error?: unknown;
};

type FalResponse = {
  images?: Array<{ url?: string }>;
};

async function readResponseBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}

async function assertFalOk(response: Response, phase: string) {
  if (response.ok) {
    return;
  }

  const detail = await readResponseBody(response);
  throw new Error(`fal ${phase} failed: HTTP ${response.status}${detail ? ` ${detail}` : ""}`);
}

function falRequestHeaders(apiKey: string) {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function buildFallbackRequestUrl(requestId: string) {
  return `${FAL_QUEUE_URL}/requests/${requestId}`;
}

export async function generateFalMedia(prompt: string): Promise<FalMediaResult> {
  const apiKey = process.env.FAL_KEY;

  if (!apiKey) {
    return {
      report: providerMissing("fal", "FAL_KEY"),
    };
  }

  try {
    const submitResponse = await fetchWithRetry(FAL_QUEUE_URL, {
      method: "POST",
      headers: falRequestHeaders(apiKey),
      body: JSON.stringify({
        prompt,
        image_size: "landscape_16_9",
        num_images: 1,
        output_format: "jpeg",
      }),
    }, { retries: 0, timeoutMs: 20_000 });

    await assertFalOk(submitResponse, "submit");

    const submitted = (await submitResponse.json()) as FalSubmitResponse;
    const requestId = submitted.request_id;
    const resultUrl = submitted.response_url ?? (requestId ? buildFallbackRequestUrl(requestId) : undefined);
    const statusUrl = submitted.status_url ?? (resultUrl ? `${resultUrl}/status` : undefined);

    if (!requestId || !resultUrl || !statusUrl) {
      throw new Error("fal submit response did not include queue request URLs.");
    }

    for (let attempt = 0; attempt < FAL_MAX_STATUS_POLLS; attempt += 1) {
      const statusResponse = await fetchWithRetry(statusUrl, {
        headers: falRequestHeaders(apiKey),
      }, { retries: 0, timeoutMs: 15_000 });
      await assertFalOk(statusResponse, "status");

      const statusBody = (await statusResponse.json()) as FalStatusResponse;
      const status = statusBody.status?.toUpperCase();

      if (status === "COMPLETED") {
        break;
      }

      if (status === "FAILED" || status === "ERROR") {
        throw new Error(`fal generation failed with status ${status}.`);
      }

      if (attempt === FAL_MAX_STATUS_POLLS - 1) {
        throw new Error("fal generation timed out before returning a result.");
      }

      await delay(FAL_STATUS_POLL_INTERVAL_MS);
    }

    const resultResponse = await fetchWithRetry(resultUrl, {
      headers: falRequestHeaders(apiKey),
    }, { retries: 0, timeoutMs: 20_000 });
    await assertFalOk(resultResponse, "result");

    const raw = (await resultResponse.json()) as FalResponse;
    const url = raw.images?.find((image) => image.url)?.url;

    return {
      url,
      raw,
      report: {
        state: url ? "used" : "failed",
        detail: url ? "fal generated a hero media asset." : "fal returned no image URL.",
      },
    };
  } catch (error) {
    return {
      report: providerFailed("fal", error),
    };
  }
}
