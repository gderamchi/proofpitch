import { buildFallbackPitchPack } from "./demo-data";
import { generateFalMedia } from "./fal";
import { generatePitchPackWithOpenAI } from "./openai";
import { extractWithPioneer } from "./pioneer";
import { initialProviderReports } from "./providers";
import {
  GeneratePitchPackResponseSchema,
  type GeneratePitchPackRequest,
  type GeneratePitchPackResponse,
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

function buildSourceDocuments(
  input: GeneratePitchPackRequest,
  research: Awaited<ReturnType<typeof researchWithTavily>>,
): SourceDocumentInput[] {
  const documents: SourceDocumentInput[] = [
    {
      type: "user_input",
      title: "Founder note",
      extractedText: input.rawInput,
      metadata: {
        source: "user_input",
      },
    },
  ];

  if (input.projectUrl) {
    documents.push({
      type: sourceTypeFromUrl(input.projectUrl),
      title: titleFromUrl(input.projectUrl),
      url: input.projectUrl,
      extractedText: research.answer ?? null,
      metadata: {
        source: "project_url",
      },
    });
  }

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

export async function generatePitchPackWithRunLogs(
  input: GeneratePitchPackRequest,
): Promise<GeneratePitchPackResponse & { providerRunLogs: ProviderRunLog[]; sourceDocuments: SourceDocumentInput[]; requestId: string }> {
  const requestId = crypto.randomUUID();
  const providerRunLogs: ProviderRunLog[] = [];
  const providers = initialProviderReports();
  const { result: research, log: tavilyLog } = await measureProvider("tavily", requestId, () =>
    researchWithTavily(input.rawInput, input.projectUrl),
  );
  providerRunLogs.push(tavilyLog);
  providers.tavily = research.report;
  const sourceDocuments = buildSourceDocuments(input, research);

  const { result: pioneer, log: pioneerLog } = await measureProvider("pioneer", requestId, () =>
    extractWithPioneer(input.rawInput),
  );
  providerRunLogs.push(pioneerLog);
  providers.pioneer = pioneer.report;

  const { result: openai, log: openaiLog } = await measureProvider("openai", requestId, () =>
    generatePitchPackWithOpenAI({
      rawInput: input.rawInput,
      projectUrl: input.projectUrl,
      research,
      pioneer,
    }),
  );
  providerRunLogs.push(openaiLog);
  providers.openai = openai.report;

  let pitchPack = openai.pitchPack ?? buildFallbackPitchPack(input.rawInput, input.projectUrl);

  if (!openai.pitchPack) {
    providers.openai = {
      ...providers.openai,
      detail: `${providers.openai.detail} Using deterministic local fallback pack.`,
    };
    providerRunLogs.push({
      provider: "openai",
      status: "fallback",
      detail: "Deterministic local fallback pack used after OpenAI miss or failure.",
      latencyMs: 0,
      requestId,
    });
  }

  const { result: fal, log: falLog } = await measureProvider("fal", requestId, () =>
    generateFalMedia(pitchPack.generatedMediaPrompt),
  );
  providerRunLogs.push(falLog);
  providers.fal = fal.report;

  if (fal.url) {
    pitchPack = {
      ...pitchPack,
      generatedMediaUrl: fal.url,
    };
  }

  providerRunLogs.push({
    provider: "gradium",
    status: providers.gradium.state,
    detail: providers.gradium.detail,
    latencyMs: 0,
    requestId,
  });

  const usedPartner = Object.entries(providers).some(
    ([name, report]) => name !== "openai" && report.state === "used",
  );
  const mode = providers.openai.state === "used" ? (usedPartner ? "live" : "partial") : "demo";

  const parsed = GeneratePitchPackResponseSchema.parse({
    mode,
    pitchPack,
    providers,
  });

  return {
    ...parsed,
    providerRunLogs,
    sourceDocuments,
    requestId,
  };
}

export async function generatePitchPack(
  input: GeneratePitchPackRequest,
): Promise<GeneratePitchPackResponse> {
  const { providerRunLogs, ...response } = await generatePitchPackWithRunLogs(input);
  void providerRunLogs;

  return response;
}
