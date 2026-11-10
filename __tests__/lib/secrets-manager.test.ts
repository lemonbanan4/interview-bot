import { describe, expect, it } from "vitest";
import {
  decryptEnvelope,
  encryptDotenv,
  generateMasterKey,
  parseDotenv,
  parseMasterKey,
  serializeDotenv,
} from "../../scripts/secrets/manager";
import {
  ageDaysSince,
  auditRotation,
  findUntrackedKeys,
  type RotationManifest,
} from "../../scripts/secrets/rotate-audit";
import { validateEnv, validateEnvRecord } from "../../src/lib/env";

describe("secrets manager AES-256-GCM", () => {
  it("round-trips dotenv plaintext", () => {
    const { hex } = generateMasterKey();
    const key = parseMasterKey(hex);
    const plaintext = serializeDotenv({
      AUTH_SECRET: "super-secret-value",
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      STRIPE_SECRET_KEY: "sk_test_abc",
    });
    const envelope = encryptDotenv(plaintext, key, "staging");
    expect(envelope.keyNames).toEqual([
      "AUTH_SECRET",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
    ]);
    const decrypted = decryptEnvelope(envelope, key);
    expect(parseDotenv(decrypted)).toEqual(parseDotenv(plaintext));
  });

  it("rejects tampered ciphertext", () => {
    const { hex } = generateMasterKey();
    const key = parseMasterKey(hex);
    const envelope = encryptDotenv("FOO=bar\n", key, "production");
    const tampered = {
      ...envelope,
      ciphertext: Buffer.from("tampered").toString("base64"),
    };
    expect(() => decryptEnvelope(tampered, key)).toThrow();
  });

  it("parses quoted dotenv values", () => {
    const map = parseDotenv(`
# comment
AUTH_SECRET="a b"
EMAIL_FROM='Signal <a@b.com>'
EMPTY=
`);
    expect(map.AUTH_SECRET).toBe("a b");
    expect(map.EMAIL_FROM).toBe("Signal <a@b.com>");
  });
});

describe("env Zod validation", () => {
  it("passes a complete production record", () => {
    const result = validateEnvRecord(
      {
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
        AUTH_SECRET: "x".repeat(32),
        AUTH_URL: "https://app.example.com",
        STRIPE_SECRET_KEY: "sk_live_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        RESEND_API_KEY: "re_test",
        OPENAI_API_KEY: "sk-test",
      },
      { profile: "production", mode: "strict" },
    );
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("flags missing Stripe + LLM keys in production", () => {
    const result = validateEnvRecord(
      {
        DATABASE_URL: "postgresql://u:p@localhost:5432/db",
        AUTH_SECRET: "x".repeat(32),
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
        RESEND_API_KEY: "re_test",
      },
      { profile: "production", mode: "strict" },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("STRIPE"))).toBe(true);
    expect(result.issues.some((i) => i.path.includes("OPENAI"))).toBe(true);
  });

  it("honors SKIP_ENV_VALIDATION", () => {
    const result = validateEnv({
      source: { SKIP_ENV_VALIDATION: "1" },
      mode: undefined,
    });
    expect(result.mode).toBe("off");
    expect(result.ok).toBe(true);
  });
});

describe("rotation audit", () => {
  it("flags overdue keys by severity", () => {
    const manifest: RotationManifest = {
      defaults: { maxAgeDays: 90 },
      keys: {
        AUTH_SECRET: {
          rotatedAt: "2026-01-01T00:00:00.000Z",
          maxAgeDays: 90,
        },
        OPENAI_API_KEY: {
          rotatedAt: "2026-10-01T00:00:00.000Z",
          maxAgeDays: 90,
        },
      },
    };
    const report = auditRotation(manifest, {
      now: new Date("2026-11-10T00:00:00.000Z"),
      errorAfterDaysOverdue: 14,
    });
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.key).toBe("AUTH_SECRET");
    expect(report.findings[0]?.severity).toBe("error");
    expect(report.ok).toBe(false);
  });

  it("computes age in whole days", () => {
    expect(
      ageDaysSince(
        "2026-11-01T00:00:00.000Z",
        new Date("2026-11-10T12:00:00Z"),
      ),
    ).toBe(9);
  });

  it("finds untracked sensitive vault keys", () => {
    const untracked = findUntrackedKeys(
      ["AUTH_SECRET", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_APP_URL"],
      {
        defaults: { maxAgeDays: 90 },
        keys: { AUTH_SECRET: { rotatedAt: "2026-11-01T00:00:00Z" } },
      },
    );
    expect(untracked).toEqual(["STRIPE_SECRET_KEY"]);
  });
});
