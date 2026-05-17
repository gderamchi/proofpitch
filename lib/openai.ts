import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import {
  DemoBriefSchema,
  demoBriefJsonSchema,
  type DemoBrief,
  type ProviderReport,
} from "./schemas";
import type { PioneerExtraction } from "./pioneer";
import type { ResearchResult } from "./tavily";

export type OpenAIDemoBriefResult = {
  demoBrief?: DemoBrief;
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

export async function generateDemoBriefWithOpenAI({
  rawInput,
  projectUrl,
  research,
  pioneer,
}: {
  rawInput: string;
  projectUrl?: string;
  research: ResearchResult;
  pioneer: PioneerExtraction;
}): Promise<OpenAIDemoBriefResult> {
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
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions:
            "You are ProofPitch, a proof-aware product demo planner. Produce concise, defensible demo output. Do not invent metrics. Mark claims as user_provided, weak, supported, or unsupported. The accepted claims will feed video captions and voiceover narration, so every claim must be safe to review.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: [
                    "Create a ProofPitch demo-video brief from this input.",
                    "",
                    `Demo request:\n${rawInput}`,
                    projectUrl ? `Product URL: ${projectUrl}` : "Product URL: not provided",
                    "",
                    research.answer ? `Tavily answer:\n${research.answer}` : "Tavily answer: unavailable",
                    "",
                    sourceLines ? `Tavily sources:\n${sourceLines}` : "Tavily sources: unavailable",
                    "",
                    `Pioneer extraction:\n${extractionSummary}`,
                    "",
                    "Rules:",
                    "- The two-minute script must narrate a real product walkthrough, not a slide deck.",
                    "- Claim explanations must say exactly why a claim is supported, weak, unsupported, or only user-provided.",
                    "- Unsupported claims must remain in the ledger for review but must not be necessary for the demo narrative.",
                    "- Provider usage must describe real intended use of OpenAI, Tavily, and Pioneer. Use an empty string only if a provider is not used.",
                    "- Do not describe pitch decks, PDF exports, Slidev, pricing, checkout, or publishing workflows as product outputs.",
                  ].join("\n"),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "demo_brief",
              strict: true,
              schema: demoBriefJsonSchema,
            },
          },
          reasoning: {
            effort: "low",
          },
          max_output_tokens: 5000,
          store: false,
        }),
      },
      { timeoutMs: 60_000 },
    );
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

    const demoBrief = DemoBriefSchema.parse(JSON.parse(outputText));

    return {
      demoBrief,
      report: {
        state: "used",
        detail: `OpenAI generated structured DemoBrief JSON with ${model}.`,
      },
    };
  } catch (error) {
    return {
      report: providerFailed("openai", error),
    };
  }
}
