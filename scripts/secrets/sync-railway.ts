#!/usr/bin/env npx tsx
/**
 * Decrypt vault → validate → upsert into Railway without printing values.
 *
 *   SECRETS_MASTER_KEY=… RAILWAY_TOKEN=… \
 *     npm run secrets:sync -- --env staging
 *
 * Requires Railway CLI (`railway`) linked via token, plus optional:
 *   RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT (defaults to --env value)
 *
 * Values never go to stdout/stderr — only key names + counts.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  decryptToTempFile,
  loadDecryptedMap,
  resolveMasterKey,
  type DeployEnvName,
} from "./manager";
import { validateEnvRecord } from "../../src/lib/env";

const RAILWAY_API =
  process.env.RAILWAY_API?.trim() || "https://backboard.railway.com/graphql/v2";

type SyncResult = {
  env: DeployEnvName;
  keyCount: number;
  keyNames: string[];
  skipped: string[];
  updated: string[];
  dryRun: boolean;
  ok: boolean;
};

/** Keys that stay GitHub/CI-only and must not overwrite Railway app runtime. */
const SKIP_KEYS = new Set([
  "SECRETS_MASTER_KEY",
  "RAILWAY_TOKEN",
  "RAILWAY_API_TOKEN",
  "GITHUB_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  "APPLE_PASSWORD",
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "WINDOWS_CERTIFICATE",
  "WINDOWS_CERTIFICATE_PASSWORD",
]);

function requireEnvName(value: string | undefined): DeployEnvName {
  if (value === "production" || value === "staging") return value;
  throw new Error("--env must be production or staging");
}

function parseArgs(argv: string[]) {
  let env: string | undefined;
  let dryRun = false;
  let skipValidate = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--env") env = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-validate") skipValidate = true;
  }
  return { env: requireEnvName(env), dryRun, skipValidate };
}

function redactSpawnOutput(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join("***");
  }
  return out;
}

function railwayVariablesSet(
  pairs: Array<{ key: string; value: string }>,
  opts: { environment: string; serviceId?: string; dryRun: boolean },
): { updated: string[]; ok: boolean } {
  if (pairs.length === 0) return { updated: [], ok: true };

  if (opts.dryRun) {
    return { updated: pairs.map((p) => p.key), ok: true };
  }

  const token =
    process.env.RAILWAY_TOKEN?.trim() || process.env.RAILWAY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("RAILWAY_TOKEN (or RAILWAY_API_TOKEN) is required");
  }

  // Prefer GraphQL when project/environment IDs are available — more reliable
  // with project-scoped RAILWAY_TOKEN than CLI flags that re-select env.
  if (
    process.env.RAILWAY_PROJECT_ID?.trim() &&
    process.env.RAILWAY_ENVIRONMENT_ID?.trim()
  ) {
    return upsertViaGraphql(pairs, {
      token,
      environment: opts.environment,
      serviceId: opts.serviceId,
    });
  }

  const hasCli =
    spawnSync("railway", ["--version"], {
      encoding: "utf8",
    }).status === 0;

  if (!hasCli) {
    throw new Error(
      "Railway CLI not found and RAILWAY_PROJECT_ID/RAILWAY_ENVIRONMENT_ID unset",
    );
  }

  // Project tokens are already bound to one environment — do not pass
  // --environment (Railway returns "Invalid RAILWAY_TOKEN" when you do).
  const usingProjectToken = Boolean(process.env.RAILWAY_TOKEN?.trim());
  const updated: string[] = [];
  const secretValues = pairs.map((p) => p.value);
  for (const { key, value } of pairs) {
    const args = ["variables", "--set", `${key}=${value}`, "--skip-deploys"];
    if (!usingProjectToken) {
      args.push("--environment", opts.environment);
    }
    if (opts.serviceId) {
      args.push("--service", opts.serviceId);
    }
    // Project token auth must not also set RAILWAY_API_TOKEN.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      RAILWAY_TOKEN: token,
    };
    delete childEnv.RAILWAY_API_TOKEN;
    const result = spawnSync("railway", args, {
      encoding: "utf8",
      env: childEnv,
    });
    if (result.status !== 0) {
      const err = redactSpawnOutput(
        `${result.stderr || ""}\n${result.stdout || ""}`,
        secretValues,
      );
      throw new Error(`railway variables --set ${key} failed: ${err.trim()}`);
    }
    updated.push(key);
  }
  return { updated, ok: true };
}

function upsertViaGraphql(
  pairs: Array<{ key: string; value: string }>,
  opts: { token: string; environment: string; serviceId?: string },
): { updated: string[]; ok: boolean } {
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim() || undefined;
  if (!projectId || !environmentId) {
    throw new Error(
      "Railway CLI not found; set RAILWAY_PROJECT_ID + RAILWAY_ENVIRONMENT_ID for GraphQL sync",
    );
  }

  const mutation = `
    mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `;
  const variables = {
    input: {
      projectId,
      environmentId,
      serviceId: opts.serviceId || null,
      variables: Object.fromEntries(pairs.map((p) => [p.key, p.value])),
    },
  };

  const res = spawnSync(
    "curl",
    [
      "-fsS",
      RAILWAY_API,
      "-H",
      `Authorization: Bearer ${opts.token}`,
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify({ query: mutation, variables }),
    ],
    { encoding: "utf8" },
  );

  if (res.status !== 0) {
    throw new Error(
      `Railway GraphQL curl failed: ${redactSpawnOutput(
        res.stderr || res.stdout || "",
        pairs.map((p) => p.value),
      )}`,
    );
  }

  const body = JSON.parse(res.stdout || "{}") as {
    errors?: Array<{ message: string }>;
    data?: { variableCollectionUpsert?: boolean };
  };
  if (body.errors?.length) {
    throw new Error(
      `Railway GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return { updated: pairs.map((p) => p.key), ok: true };
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

async function maybeWriteAudit(payload: {
  action: string;
  env: DeployEnvName;
  keyNames: string[];
  dryRun: boolean;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  if (payload.dryRun) return;
  try {
    const { writeAuditLog } = await import("../../src/lib/audit/logger");
    await writeAuditLog({
      action: payload.action,
      chainKey: "platform",
      resourceType: "secrets",
      resourceId: payload.env,
      metadata: {
        env: payload.env,
        keyNames: payload.keyNames,
        keyCount: payload.keyNames.length,
        source: "secrets.sync-railway",
      },
    });
  } catch (error) {
    emitTelemetry("secrets.audit_write_failed", {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function syncSecretsToRailway(options: {
  env: DeployEnvName;
  dryRun?: boolean;
  skipValidate?: boolean;
}): Promise<SyncResult> {
  const masterKey = resolveMasterKey();
  const { map, envelope } = loadDecryptedMap(options.env, masterKey);

  if (!options.skipValidate) {
    const validation = validateEnvRecord(map, {
      profile: options.env,
      mode: "strict",
    });
    if (!validation.ok) {
      emitTelemetry("secrets.sync_validation_failed", {
        env: options.env,
        issues: validation.issues,
      });
      throw new Error(
        `Vault env validation failed for ${options.env} (${validation.issues.length} issue(s))`,
      );
    }
  }

  const skipped: string[] = [];
  const pairs: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(map)) {
    if (SKIP_KEYS.has(key)) {
      skipped.push(key);
      continue;
    }
    pairs.push({ key, value });
  }

  const railwayEnv = process.env.RAILWAY_ENVIRONMENT?.trim() || options.env;
  const serviceId = process.env.RAILWAY_SERVICE_ID?.trim() || undefined;

  let tempPath: string | undefined;
  try {
    const temp = decryptToTempFile(options.env, masterKey);
    tempPath = temp.tempPath;

    const { updated, ok } = railwayVariablesSet(pairs, {
      environment: railwayEnv,
      serviceId,
      dryRun: Boolean(options.dryRun),
    });

    const result: SyncResult = {
      env: options.env,
      keyCount: pairs.length,
      keyNames: pairs.map((p) => p.key).sort(),
      skipped: skipped.sort(),
      updated: updated.sort(),
      dryRun: Boolean(options.dryRun),
      ok,
    };

    emitTelemetry("secrets.synced", {
      env: result.env,
      keyCount: result.keyCount,
      updatedCount: result.updated.length,
      skippedCount: result.skipped.length,
      keyNames: result.keyNames,
      skipped: result.skipped,
      dryRun: result.dryRun,
      plaintextSha256: envelope.plaintextSha256,
      ok: true,
    });

    await maybeWriteAudit({
      action: "SECRET_SYNCED",
      env: options.env,
      keyNames: result.keyNames,
      dryRun: Boolean(options.dryRun),
    });

    return result;
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.rmSync(tempPath, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = await syncSecretsToRailway(args);
    // Human-friendly summary without values.
    console.log(
      `✓ Synced ${result.updated.length} variable(s) to Railway (${result.env})${
        result.dryRun ? " [dry-run]" : ""
      }`,
    );
    if (result.skipped.length) {
      console.log(`  skipped: ${result.skipped.join(", ")}`);
    }
  } catch (error) {
    emitTelemetry("secrets.sync_failed", {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    entry.includes("secrets/sync-railway") ||
    entry.endsWith("scripts/secrets/sync-railway.ts")
  );
})();

if (isDirectRun) {
  void main();
}
