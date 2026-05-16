import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeLocalQuota, getLocalQuotaSnapshot } from "../lib/local-store";

const LOCAL_STORE_KEY = "__proofpitchLocalStore";

describe("local demo quota", () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)[LOCAL_STORE_KEY];
    vi.unstubAllEnvs();
  });

  it("keeps the unauthenticated demo usable by default", () => {
    expect(getLocalQuotaSnapshot().monthlyLimit).toBe(1000);

    expect(consumeLocalQuota().ok).toBe(true);
    const second = consumeLocalQuota();

    expect(second.ok).toBe(true);
    expect(second.quota.remaining).toBe(998);
  });

  it("allows the local demo limit to be capped by env", () => {
    vi.stubEnv("PROOFPITCH_LOCAL_DEMO_PACK_LIMIT", "2");

    expect(consumeLocalQuota().ok).toBe(true);
    expect(consumeLocalQuota().ok).toBe(true);

    const third = consumeLocalQuota();

    expect(third.ok).toBe(false);
    expect(third.quota.remaining).toBe(0);
  });
});
