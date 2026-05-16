import { providerFailed, providerMissing, type ProviderName } from "./providers";
import { fetchWithRetry } from "./retry";
import type { ProviderReport } from "./schemas";

export type GradiumTranscriptionResult = {
  transcript?: string;
  report: ProviderReport;
};

const GRADIUM_PROVIDER: ProviderName = "gradium";

export async function transcribeWithGradium(audio: File): Promise<GradiumTranscriptionResult> {
  const apiKey = process.env.GRADIUM_API_KEY;

  if (!apiKey) {
    return {
      report: providerMissing(GRADIUM_PROVIDER, "GRADIUM_API_KEY"),
    };
  }

  try {
    const contentType = audio.type || "audio/wav";
    const format = contentType.includes("opus")
      ? "opus"
      : contentType.includes("ogg")
        ? "opus"
        : contentType.includes("pcm")
          ? "pcm"
          : "wav";
    const params = new URLSearchParams({
      model: "default",
      input_format: format,
    });

    const response = await fetchWithRetry(`https://api.gradium.ai/api/post/speech/asr?${params.toString()}`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": contentType,
      },
      body: await audio.arrayBuffer(),
    }, { timeoutMs: 60_000 });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    const transcript = text
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) {
          return "";
        }

        try {
          const parsed = JSON.parse(line) as { type?: string; text?: string };
          return parsed.type === "text" && parsed.text ? parsed.text : "";
        } catch {
          return line;
        }
      })
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      transcript,
      report: {
        state: transcript ? "used" : "failed",
        detail: transcript
          ? "Gradium transcribed the uploaded audio through the STT POST endpoint."
          : "Gradium returned no transcript text.",
      },
    };
  } catch (error) {
    return {
      report: providerFailed(GRADIUM_PROVIDER, error),
    };
  }
}
