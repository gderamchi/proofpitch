import { providerFailed, providerMissing } from "./providers";
import { fetchWithRetry } from "./retry";
import type { ProviderReport } from "./schemas";

export type ResearchSource = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type ResearchResult = {
  answer?: string;
  sources: ResearchSource[];
  usageCredits?: number;
  report: ProviderReport;
};

type TavilySearchResponse = {
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
  usage?: { credits?: number };
};

const TAVILY_QUERY_MAX_LENGTH = 380;

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSearchQuery(value: string) {
  const normalized = normalizeSearchText(value);

  if (normalized.length <= TAVILY_QUERY_MAX_LENGTH) {
    return normalized;
  }

  const sliced = normalized.slice(0, TAVILY_QUERY_MAX_LENGTH - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const boundary = lastSpace > 280 ? lastSpace : sliced.length;

  return `${sliced.slice(0, boundary).trimEnd()}...`;
}

function buildTavilyQuery(rawInput: string, projectUrl?: string) {
  const context = truncateSearchQuery(rawInput);
  const base = projectUrl
    ? `Market validation, competitors, and proof points for product at ${projectUrl}: ${context}`
    : `Market validation, competitors, and proof points for this product: ${context}`;

  return truncateSearchQuery(base);
}

async function readErrorDetail(response: Response) {
  const detail = await response.text();
  return detail ? ` ${detail.slice(0, 500)}` : "";
}

export async function researchWithTavily(rawInput: string, projectUrl?: string): Promise<ResearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      sources: [],
      report: providerMissing("tavily", "TAVILY_API_KEY"),
    };
  }

  try {
    const query = buildTavilyQuery(rawInput, projectUrl);

    const response = await fetchWithRetry("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 4,
        include_answer: "basic",
        include_raw_content: false,
        include_usage: true,
      }),
    }, { timeoutMs: 20_000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${await readErrorDetail(response)}`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    const sources =
      data.results
        ?.filter((result) => result.url)
        .map((result) => ({
          title: result.title ?? result.url ?? "Untitled source",
          url: result.url as string,
          content: result.content ?? "",
          score: result.score,
        })) ?? [];

    return {
      answer: data.answer,
      sources,
      usageCredits: data.usage?.credits,
      report: {
        state: "used",
        detail: `Tavily returned ${sources.length} sources${
          data.usage?.credits ? ` using ${data.usage.credits} credit(s)` : ""
        }.`,
      },
    };
  } catch (error) {
    return {
      sources: [],
      report: providerFailed("tavily", error),
    };
  }
}
