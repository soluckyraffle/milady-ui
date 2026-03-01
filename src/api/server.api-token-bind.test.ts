import { logger } from "@elizaos/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureApiTokenForBindHost, getConfiguredLegacyApiToken } from "./server";

describe("ensureApiTokenForBindHost", () => {
  const previousToken = process.env.MILADY_API_TOKEN;
  const previousCompatToken = process.env.MILAIDY_API_TOKEN;

  afterEach(() => {
    if (previousToken === undefined) delete process.env.MILADY_API_TOKEN;
    else process.env.MILADY_API_TOKEN = previousToken;
    if (previousCompatToken === undefined) delete process.env.MILAIDY_API_TOKEN;
    else process.env.MILAIDY_API_TOKEN = previousCompatToken;
    vi.restoreAllMocks();
  });

  it("does not generate a token on loopback bind hosts", () => {
    delete process.env.MILADY_API_TOKEN;
    ensureApiTokenForBindHost("127.0.0.1");
    expect(process.env.MILADY_API_TOKEN).toBeUndefined();
  });

  it("preserves an explicitly configured token", () => {
    process.env.MILADY_API_TOKEN = "existing-token";
    ensureApiTokenForBindHost("0.0.0.0");
    expect(process.env.MILADY_API_TOKEN).toBe("existing-token");
  });

  it("generates a token for non-loopback binds without logging raw token", () => {
    delete process.env.MILADY_API_TOKEN;
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    ensureApiTokenForBindHost("0.0.0.0");

    const generated = process.env.MILADY_API_TOKEN ?? "";
    expect(generated).toMatch(/^[a-f0-9]{64}$/);

    const loggedMessages = warnSpy.mock.calls
      .map((call) => call[0])
      .map((value) => String(value));
    expect(loggedMessages.some((message) => message.includes(generated))).toBe(
      false,
    );
  });

  it("accepts compat token name for legacy auth", () => {
    delete process.env.MILADY_API_TOKEN;
    process.env.MILAIDY_API_TOKEN = "compat-token";
    expect(getConfiguredLegacyApiToken()).toBe("compat-token");
  });

  it("prefers canonical token over compat token when both are set", () => {
    process.env.MILADY_API_TOKEN = "canonical-token";
    process.env.MILAIDY_API_TOKEN = "compat-token";
    expect(getConfiguredLegacyApiToken()).toBe("canonical-token");
  });
});
