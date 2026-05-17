import { buildFallbackDemoBrief } from "./demo-data";
import { generateDemoBriefWithOpenAI } from "./openai";
import { extractWithPioneer } from "./pioneer";
import { initialProviderReports } from "./providers";
import {
  DemoBriefSchema,
  type CreateDemoVideoRequest,
  type DemoBrief,
  type SourceDocumentType,
} from "./schemas";
import { researchWithTavily } from "./tavily";

export type ProviderRunLog = {
  provider: keyof ReturnType<typeof initialProviderReports>;
  status: string;
  detail: string;
  latencyMs: number;
  requestId: string;
};

export type SourceDocumentInput = {
  type: SourceDocumentType;
  title: string;
  url?: string | null;
  extractedText?: string | null;
  metadata: Record<string, unknown>;
};

async function measureProvider<T extends { report: { state: string; detail: string } }>(
  provider: ProviderRunLog["provider"],
  requestId: string,
  run: () => Promise<T>,
): Promise<{ result: T; log: ProviderRunLog }> {
  const startedAt = performance.now();
  const result = await run();

  return {
    result,
    log: {
      provider,
      status: result.report.state,
      detail: result.report.detail,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      requestId,
    },
  };
}

function sourceTypeFromUrl(url: string): SourceDocumentType {
  try {
    const hostname = new URL(url).hostname;

    if (hostname === "github.com" || hostname.endsWith(".github.com")) {
      return "repo";
    }
  } catch {
    return "web";
  }

  return "web";
}

function titleFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildRawDemoInput(input: CreateDemoVideoRequest) {
  return [
    `${input.productName} needs a proof-aware product demo video with voiceover-ready narration.`,
    `Audience: ${input.targetAudience}.`,
    `Demo goal: ${input.demoGoal.replace(/\s+/g, " ").trim()}.`,
    input.demoInstructions
      ? `Demo path: ${input.demoInstructions}.`
      : "Demo path: infer the strongest public product walkthrough from the product URL.",
    "Create conservative narration and keep unsupported claims reviewable.",
  ].join("\n");
}

function buildSourceDocuments(
  input: CreateDemoVideoRequest,
  rawInput: string,
  research: Awaited<ReturnType<typeof researchWithTavily>>,
): SourceDocumentInput[] {
  const documents: SourceDocumentInput[] = [
    {
      type: "user_input",
      title: "Demo request",
      extractedText: rawInput,
      metadata: {
        source: "user_input",
      },
    },
    {
      type: sourceTypeFromUrl(input.sourceUrl),
      title: titleFromUrl(input.sourceUrl),
      url: input.sourceUrl,
      extractedText: research.answer ?? null,
      metadata: {
        source: "product_url",
      },
    },
  ];

  for (const source of research.sources) {
    documents.push({
      type: sourceTypeFromUrl(source.url),
      title: source.title || titleFromUrl(source.url),
      url: source.url,
      extractedText: source.content || null,
      metadata: {
        provider: "tavily",
        score: source.score ?? null,
      },
    });
  }

  return documents;
}

export async function generateDemoBriefWithRunLogs(input: CreateDemoVideoRequest): Promise<{
  demoBrief: DemoBrief;
  providers: ReturnType<typeof initialProviderReports>;
  providerRunLogs: ProviderRunLog[];
  sourceDocuments: SourceDocumentInput[];
  requestId: string;
}> {
  const requestId = crypto.randomUUID();
  const providerRunLogs: ProviderRunLog[] = [];
  const providers = initialProviderReports();
  const rawInput = buildRawDemoInput(input);

  const { result: research, log: tavilyLog } = await measureProvider("tavily", requestId, () =>
    researchWithTavily(rawInput, input.sourceUrl),
  );
  providerRunLogs.push(tavilyLog);
  providers.tavily = research.report;
  const sourceDocuments = buildSourceDocuments(input, rawInput, research);

  const { result: pioneer, log: pioneerLog } = await measureProvider("pioneer", requestId, () =>
    extractWithPioneer(rawInput),
  );
  providerRunLogs.push(pioneerLog);
  providers.pioneer = pioneer.report;

  const { result: openai, log: openaiLog } = await measureProvider("openai", requestId, () =>
    generateDemoBriefWithOpenAI({
      rawInput,
      projectUrl: input.sourceUrl,
      research,
      pioneer,
    }),
  );
  providerRunLogs.push(openaiLog);
  providers.openai = openai.report;

  const demoBrief = DemoBriefSchema.parse(
    openai.demoBrief ?? buildFallbackDemoBrief(rawInput, input.sourceUrl),
  );

  if (!openai.demoBrief) {
    providers.openai = {
      ...providers.openai,
      detail: `${providers.openai.detail} Using deterministic local fallback demo brief.`,
    };
    providerRunLogs.push({
      provider: "openai",
      status: "fallback",
      detail: "Deterministic local fallback demo brief used after OpenAI miss or failure.",
      latencyMs: 0,
      requestId,
    });
  }

  return {
    demoBrief,
    providers,
    providerRunLogs,
    sourceDocuments,
    requestId,
  };
}
