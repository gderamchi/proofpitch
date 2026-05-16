const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

type FetchRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {},
) {
  const retries = options.retries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = options.timeoutMs && !init?.signal ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller?.signal ?? init?.signal,
      });

      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) {
        return response;
      }

      lastResponse = response;
      await response.arrayBuffer().catch(() => undefined);
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    await wait(baseDelayMs * (attempt + 1));
  }

  if (lastError) {
    throw lastError;
  }

  return lastResponse as Response;
}
