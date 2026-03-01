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
});

