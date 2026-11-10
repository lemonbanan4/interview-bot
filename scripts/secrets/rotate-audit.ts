#!/usr/bin/env npx tsx
/**
 * Secret rotation audit — flags stale API keys and records modification events.
 *
 *   npm run secrets:rotate-audit
 *   npm run secrets:rotate-audit -- --fail-on-stale
 *   npm run secrets:rotate-audit -- --record-modify AUTH_SECRET,STRIPE_SECRET_KEY --env production
 *
 * Manifest: secrets/rotation-manifest.json (dates + max age only — no secret values).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDecryptedMap, vaultPathFor, type DeployEnvName } from "./manager";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "secrets",
  "rotation-manifest.json",
);

export type RotationKeyEntry = {
  rotatedAt: string;
  maxAgeDays?: number;
  owner?: string;
  notes?: string;
};

export type RotationManifest = {
  defaults: { maxAgeDays: number };
  keys: Record<string, RotationKeyEntry>;
};

export type StaleFinding = {
  key: string;
  rotatedAt: string;
  maxAgeDays: number;
  ageDays: number;
  overdueDays: number;
  severity: "warn" | "error";
};

export type RotationAuditReport = {
  generatedAt: string;
  findings: StaleFinding[];
  checkedKeys: string[];
  ok: boolean;
};

const MS_PER_DAY = 86_400_000;

export function loadManifest(
  filePath: string = MANIFEST_PATH,
): RotationManifest {
  if (!fs.existsSync(filePath)) {
    return { defaults: { maxAgeDays: 90 }, keys: {} };
  }
  const parsed = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as RotationManifest;
  return {
    defaults: {
      maxAgeDays: Number(parsed.defaults?.maxAgeDays || 90),
    },
    keys: parsed.keys || {},
  };
}

export function saveManifest(
  manifest: RotationManifest,
  filePath: string = MANIFEST_PATH,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function ageDaysSince(iso: string, now = new Date()): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

export function auditRotation(
  manifest: RotationManifest,
  options?: { now?: Date; errorAfterDaysOverdue?: number },
): RotationAuditReport {
  const now = options?.now ?? new Date();
  const errorAfter = options?.errorAfterDaysOverdue ?? 14;
  const findings: StaleFinding[] = [];
  const checkedKeys = Object.keys(manifest.keys).sort();

  for (const key of checkedKeys) {
    const entry = manifest.keys[key]!;
    const maxAgeDays = entry.maxAgeDays ?? manifest.defaults.maxAgeDays;
    const ageDays = ageDaysSince(entry.rotatedAt, now);
    const overdueDays = ageDays - maxAgeDays;
    if (overdueDays > 0) {
      findings.push({
        key,
        rotatedAt: entry.rotatedAt,
        maxAgeDays,
        ageDays,
        overdueDays,
        severity: overdueDays >= errorAfter ? "error" : "warn",
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    findings,
    checkedKeys,
    ok: !findings.some((f) => f.severity === "error"),
  };
}

function emitTelemetry(event: string, fields: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "interview-bot",
      event,
      ...fields,
    }),
  );
}

async function writeAuditSafe(input: {
  action: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    emitTelemetry("secrets.audit_event", {
      action: input.action,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
      persisted: false,
    });
    return;
  }
  try {
    const { writeAuditLog } = await import("../../src/lib/audit/logger");
    await writeAuditLog({
      action: input.action,
      chainKey: "platform",
      resourceType: "secrets",
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
    });
    emitTelemetry("secrets.audit_event", {
      action: input.action,
      resourceId: input.resourceId ?? null,
      persisted: true,
    });
  } catch (error) {
    emitTelemetry("secrets.audit_write_failed", {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Mark keys as freshly rotated in the manifest (dates only). */
export function markRotated(
  keys: string[],
  options?: {
    at?: string;
    maxAgeDays?: number;
    manifestPath?: string;
  },
): RotationManifest {
  const filePath = options?.manifestPath ?? MANIFEST_PATH;
  const manifest = loadManifest(filePath);
  const at = options?.at ?? new Date().toISOString();
  for (const key of keys) {
    const prev = manifest.keys[key];
    manifest.keys[key] = {
      rotatedAt: at,
      maxAgeDays:
        options?.maxAgeDays ?? prev?.maxAgeDays ?? manifest.defaults.maxAgeDays,
      owner: prev?.owner,
      notes: prev?.notes,
    };
  }
  saveManifest(manifest, filePath);
  return manifest;
}

/**
 * Compare vault key set vs rotation manifest — warn on untracked production keys.
 */
export function findUntrackedKeys(
  vaultKeyNames: string[],
  manifest: RotationManifest,
  trackedPrefixes = [
    "AUTH_",
    "STRIPE_",
    "OPENAI_",
    "ANTHROPIC_",
    "DEEPGRAM_",
    "RESEND_",
    "SENTRY_DSN",
    "DATABASE_URL",
    "CRON_SECRET",
    "HEALTH_PING_SECRET",
    "UPSTASH_",
  ],
): string[] {
  return vaultKeyNames
    .filter((key) =>
      trackedPrefixes.some(
        (prefix) => key === prefix || key.startsWith(prefix),
      ),
    )
    .filter((key) => !manifest.keys[key])
    .sort();
}

function parseArgs(argv: string[]) {
  let failOnStale = false;
  let env: DeployEnvName | undefined;
  let recordModify: string[] = [];
  let mark: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--fail-on-stale") failOnStale = true;
    else if (a === "--env") {
      const v = argv[++i];
      if (v === "production" || v === "staging") env = v;
      else throw new Error("--env must be production or staging");
    } else if (a === "--record-modify") {
      recordModify = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--mark-rotated") {
      mark = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { failOnStale, env, recordModify, mark };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.mark.length > 0) {
    const manifest = markRotated(args.mark);
    emitTelemetry("secrets.rotation_marked", {
      keys: args.mark,
      rotatedAt: new Date().toISOString(),
    });
    await writeAuditSafe({
      action: "SECRET_MODIFIED",
      resourceId: args.env ?? "manifest",
      metadata: {
        keys: args.mark,
        operation: "mark-rotated",
        source: "secrets.rotate-audit",
      },
    });
    console.log(
      `✓ Marked ${args.mark.length} key(s) rotated in ${path.relative(REPO_ROOT, MANIFEST_PATH)}`,
    );
    // Continue into audit so CI sees fresh state.
    void manifest;
  }

  if (args.recordModify.length > 0) {
    await writeAuditSafe({
      action: "SECRET_MODIFIED",
      resourceId: args.env ?? "manual",
      metadata: {
        keys: args.recordModify,
        operation: "modify",
        source: "secrets.rotate-audit",
        env: args.env ?? null,
      },
    });
  }

  const manifest = loadManifest();
  const report = auditRotation(manifest);

  let untracked: string[] = [];
  if (args.env && process.env.SECRETS_MASTER_KEY?.trim()) {
    try {
      const { envelope } = loadDecryptedMap(args.env);
      untracked = findUntrackedKeys(envelope.keyNames, manifest);
      // Also confirm vault file exists for path logging.
      void vaultPathFor(args.env);
    } catch (error) {
      emitTelemetry("secrets.rotation_vault_skip", {
        env: args.env,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const finding of report.findings) {
    emitTelemetry("secrets.rotation_due", {
      key: finding.key,
      ageDays: finding.ageDays,
      maxAgeDays: finding.maxAgeDays,
      overdueDays: finding.overdueDays,
      severity: finding.severity,
      rotatedAt: finding.rotatedAt,
    });
  }

  if (report.findings.length > 0) {
    await writeAuditSafe({
      action: "SECRET_ROTATION_DUE",
      resourceId: "rotation-manifest",
      metadata: {
        findings: report.findings.map((f) => ({
          key: f.key,
          ageDays: f.ageDays,
          maxAgeDays: f.maxAgeDays,
          overdueDays: f.overdueDays,
          severity: f.severity,
        })),
        source: "secrets.rotate-audit",
      },
    });
  }

  if (untracked.length > 0) {
    emitTelemetry("secrets.rotation_untracked", {
      keys: untracked,
      count: untracked.length,
      severity: "warn",
    });
  }

  emitTelemetry("secrets.rotation_audit", {
    checked: report.checkedKeys.length,
    stale: report.findings.length,
    errors: report.findings.filter((f) => f.severity === "error").length,
    warns: report.findings.filter((f) => f.severity === "warn").length,
    untrackedCount: untracked.length,
    ok: report.ok,
  });

  console.log(
    `Rotation audit: ${report.findings.length} stale, ${untracked.length} untracked, ${report.checkedKeys.length} tracked`,
  );
  for (const f of report.findings) {
    console.log(
      `  [${f.severity.toUpperCase()}] ${f.key} age=${f.ageDays}d max=${f.maxAgeDays}d overdue=${f.overdueDays}d`,
    );
  }
  for (const key of untracked) {
    console.log(`  [WARN] ${key} missing from rotation-manifest.json`);
  }

  // Fail only on error-severity overdue (default: 14+ days past maxAge).
  if (args.failOnStale && !report.ok) {
    process.exit(1);
  }
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    entry.includes("secrets/rotate-audit") ||
    entry.endsWith("scripts/secrets/rotate-audit.ts")
  );
})();

if (isDirectRun) {
  void main();
}
