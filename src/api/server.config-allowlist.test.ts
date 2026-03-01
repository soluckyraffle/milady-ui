import { describe, expect, it } from "vitest";
import {
  CONFIG_WRITE_ALLOWED_TOP_KEYS,
  cloneWithoutBlockedObjectKeys,
  isBlockedObjectKey,
} from "./server";

describe("CONFIG_WRITE_ALLOWED_TOP_KEYS", () => {
  it("includes connectors so /api/config can persist connector settings", () => {
    expect(CONFIG_WRITE_ALLOWED_TOP_KEYS.has("connectors")).toBe(true);
  });

  it("keeps legacy channels support for backward compatibility", () => {
    expect(CONFIG_WRITE_ALLOWED_TOP_KEYS.has("channels")).toBe(true);
  });

  it("does not allow unknown top-level keys", () => {
    expect(CONFIG_WRITE_ALLOWED_TOP_KEYS.has("__proto__")).toBe(false);
    expect(CONFIG_WRITE_ALLOWED_TOP_KEYS.has("notARealTopLevelKey")).toBe(
      false,
    );
  });

  it("recognizes blocked prototype-pollution keys", () => {
    expect(isBlockedObjectKey("__proto__")).toBe(true);
    expect(isBlockedObjectKey("constructor")).toBe(true);
    expect(isBlockedObjectKey("prototype")).toBe(true);
    expect(isBlockedObjectKey("safe")).toBe(false);
  });

  it("removes blocked keys recursively from payloads", () => {
    const sanitized = cloneWithoutBlockedObjectKeys({
      safe: true,
      nested: {
        constructor: { x: 1 },
        keep: "ok",
      },
      list: [{ prototype: "bad", keep: 1 }],
      __proto__: { polluted: true },
    }) as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(sanitized, "__proto__")).toBe(
      false,
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        sanitized.nested as Record<string, unknown>,
        "constructor",
      ),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        ((sanitized.list as Array<Record<string, unknown>>)[0] ?? {}),
        "prototype",
      ),
    );
    expect((sanitized.nested as Record<string, unknown>).keep).toBe("ok");
  });
});
