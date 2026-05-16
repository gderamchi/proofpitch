import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import {
  PitchPackSchema,
  pitchPackJsonSchema,
  type PitchPack,
  type ProviderReport,
} from "./schemas";
import type { PioneerExtraction } from "./pioneer";
import type { ResearchResult } from "./tavily";

export type OpenAIPitchPackResult = {
  pitchPack?: PitchPack;
  report: ProviderReport;
};

type ResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function extractOutputText(data: ResponsesApiOutput): string | undefined {
  if (data.output_text) {
    return data.output_text;
  }

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return undefined;
}

export async function generatePitchPackWithOpenAI({
  rawInput,
  projectUrl,
  research,
  pioneer,
}: {
  rawInput: string;
  projectUrl?: string;
  research: ResearchResult;
  pioneer: PioneerExtraction;
}): Promise<OpenAIPitchPackResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      report: providerMissing("openai", "OPENAI_API_KEY"),
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const sourceLines = research.sources
    .slice(0, 5)
    .map((source, index) => `${index + 1}. ${source.title} (${source.url}) - ${source.content}`)
    .join("\n");

  const extractionSummary = pioneer.entities.length
    ? JSON.stringify(pioneer.entities.slice(0, 25), null, 2)
    : "No Pioneer extraction available.";

  try {
    const response = await fetchWithRetry("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "You are ProofPitch, a product narrative and claim-verification engine. Produce concise, defensible output. Do not invent metrics. Mark claims as user_provided, weak, supported, or unsupported. Keep the claim ledger visible and useful for founder, sales, and investor-facing material.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Create a ProofPitch pitch pack from this input.",
                  "",
                  `Raw builder note:\n${rawInput}`,
                  projectUrl ? `Project URL: ${projectUrl}` : "Project URL: not provided",
                  "",
                  research.answer ? `Tavily answer:\n${research.answer}` : "Tavily answer: unavailable",
                  "",
                  sourceLines ? `Tavily sources:\n${sourceLines}` : "Tavily sources: unavailable",
                  "",
                  `Pioneer extraction:\n${extractionSummary}`,
                  "",
                  "Rules:",
                  "- The two-minute script must be practical for a founder, sales, or investor presentation.",
                  "- Claim explanations must say exactly why a claim is supported, weak, unsupported, or only user-provided.",
                  "- Provider usage must describe real intended use of OpenAI, Tavily, and Pioneer. Use an empty string only if a provider is not used.",
                  "- Do not describe removed audio, generated-media, or publishing workflows as MVP outputs.",
                ].join("\n"),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pitch_pack",
            strict: true,
            schema: pitchPackJsonSchema,
          },
        },
        reasoning: {
          effort: "low",
        },
        max_output_tokens: 5000,
        store: false,
      }),
    }, { timeoutMs: 60_000 });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    const data = JSON.parse(text) as ResponsesApiOutput;

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const outputText = extractOutputText(data);

    if (!outputText) {
      throw new Error("OpenAI returned no output_text.");
    }

    const pitchPack = PitchPackSchema.parse(JSON.parse(outputText));

    return {
      pitchPack,
      report: {
        state: "used",
        detail: `OpenAI generated structured PitchPack JSON with ${model}.`,
      },
    };
  } catch (error) {
    return {
      report: providerFailed("openai", error),
    };
  }
}
