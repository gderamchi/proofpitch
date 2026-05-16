import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeLocalQuota, getLocalQuotaSnapshot } from "../lib/local-store";

const LOCAL_STORE_KEY = "__proofpitchLocalStore";

describe("local free access quota", () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)[LOCAL_STORE_KEY];
    vi.unstubAllEnvs();
  });

  it("keeps the unauthenticated product usable without a practical cap", () => {
    expect(getLocalQuotaSnapshot().monthlyLimit).toBe(Number.MAX_SAFE_INTEGER);

    expect(consumeLocalQuota().ok).toBe(true);
    const second = consumeLocalQuota();

    expect(second.ok).toBe(true);
    expect(second.quota.billingMode).toBe("free-access");
    expect(second.quota.remaining).toBeGreaterThan(1_000_000);
  });

  it("ignores legacy local demo limit env caps", () => {
    vi.stubEnv("PROOFPITCH_LOCAL_DEMO_PACK_LIMIT", "2");

    expect(consumeLocalQuota().ok).toBe(true);
    expect(consumeLocalQuota().ok).toBe(true);

    const third = consumeLocalQuota();

    expect(third.ok).toBe(true);
    expect(third.quota.monthlyLimit).toBe(Number.MAX_SAFE_INTEGER);
    expect(third.quota.remaining).toBeGreaterThan(1_000_000);
  });
});
