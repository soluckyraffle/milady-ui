import { describe, expect, it } from "vitest";
import { MultiUserService } from "./service.js";

function seedEnv() {
  process.env.MILAIDY_AUTH_JWT_SECRET = "x".repeat(64);
  process.env.MILAIDY_SECRET_KEYS =
    "1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.MILAIDY_SECRET_KEY_ACTIVE_VERSION = "1";
  process.env.MILAIDY_REQUIRE_USER_PROVIDER_SECRET = "0";
}

describe("MultiUserService RBAC security", () => {
  it("blocks member self-escalation via settings.policies patch", async () => {
    seedEnv();
    const svc = new MultiUserService();
    const signup = await svc.signup(
      { email: "member@example.com", password: "pass1234", displayName: "M" },
      { userAgent: null, ipAddress: "127.0.0.1" },
    );

    expect(() =>
      svc.patchSettings(
        signup.user.id,
        { policies: { canManagePermissions: true } },
        "member",
      ),
    ).toThrow(/Permission denied/);
  });

  it("blocks member permission patch operations", async () => {
    seedEnv();
    const svc = new MultiUserService();
    const signup = await svc.signup(
      { email: "member2@example.com", password: "pass1234", displayName: "M2" },
      { userAgent: null, ipAddress: "127.0.0.1" },
    );

    expect(() =>
      svc.patchPermissions(
        signup.user.id,
        {
          integrationId: "polymarket",
          enabled: true,
          executionEnabled: true,
        },
        "member",
      ),
    ).toThrow(/Permission denied/);
  });

  it("locks login after repeated failed attempts", async () => {
    seedEnv();
    process.env.MILAIDY_LOGIN_LOCKOUT_THRESHOLD = "3";
    process.env.MILAIDY_LOGIN_LOCKOUT_MS = "600000";
    const svc = new MultiUserService();
    await svc.signup(
      { email: "lockout@example.com", password: "pass1234", displayName: "L" },
      { userAgent: null, ipAddress: "127.0.0.1" },
    );

    for (let i = 0; i < 3; i += 1) {
      await expect(
        svc.login(
          { email: "lockout@example.com", password: "wrong-pass" },
          { userAgent: null, ipAddress: "127.0.0.1" },
        ),
      ).rejects.toThrow();
    }

    await expect(
      svc.login(
        { email: "lockout@example.com", password: "pass1234" },
        { userAgent: null, ipAddress: "127.0.0.1" },
      ),
    ).rejects.toThrow(/Too many failed login attempts/);
  });

  it("rejects invalid action format in execution requests", async () => {
    seedEnv();
    const svc = new MultiUserService();
    expect(() =>
      svc.parseActionExecute({
        integrationId: "solana-wallet",
        action: "wallet;rm -rf /",
      }),
    ).toThrow(/Invalid action format/);
  });

  it("blocks action execution when canUseTools is false", async () => {
    seedEnv();
    const svc = new MultiUserService();
    const signup = await svc.signup(
      { email: "tools-off@example.com", password: "pass1234", displayName: "T" },
      { userAgent: null, ipAddress: "127.0.0.1" },
    );
    const userId = signup.user.id;
    // Owner can set policies for this account; disable tool usage.
    svc.patchSettings(userId, { policies: { canUseTools: false } }, "owner");
    svc.patchPermissions(
      userId,
      {
        integrationId: "solana-wallet",
        enabled: true,
        executionEnabled: true,
      },
      "owner",
    );

    await expect(
      svc.executeAction(userId, {
        integrationId: "solana-wallet",
        action: "wallet.sign",
        params: {},
      }),
    ).rejects.toThrow(/Tool execution is disabled/);
  });
});
