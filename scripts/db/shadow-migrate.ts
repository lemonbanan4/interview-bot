#!/usr/bin/env npx tsx
/**
 * Staging shadow-database simulation for Prisma migrations.
 *
 * 1. Pre-migration health check
 * 2. `prisma migrate deploy` against DATABASE_URL (ephemeral / shadow)
 * 3. Drift check: migrations ↔ schema.prisma
 * 4. Backward-compat smoke: core tables readable after migrate
 * 5. Post-migration health check (+ optional regression compare)
 *
 *   DATABASE_URL=… npm run db:shadow-migrate
 *
 * CI: .github/workflows/db-migration.yml
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { compareHealth, runDbHealthCheck } from "./health-check";

const REPO_ROOT = path.resolve(__dirname, "../..");
const RESULTS_DIR = path.join(REPO_ROOT, "test-results", "db");

function run(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  return execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    env: { ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function ensureDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required for shadow migrate simulation.");
    process.exit(1);
  }
  return url;
}

function migrateDeploy(databaseUrl: string): string {
  try {
    return run("npx", ["prisma", "migrate", "deploy"], {
      ...process.env,
      DATABASE_URL: databaseUrl,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const detail = [err.stdout, err.stderr, err.message]
      .filter(Boolean)
      .join("\n");
    throw new Error(`prisma migrate deploy failed:\n${detail}`);
  }
}

function assertNoDrift(databaseUrl: string): void {
  // Live DB should match schema.prisma after deploy.
  const diff = run(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-url",
      databaseUrl,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    { ...process.env, DATABASE_URL: databaseUrl },
  );
  // exit-code mode: 0 = no diff. Non-zero throws from execFileSync.
  if (diff.trim()) {
    console.log(diff);
  }
}

async function backwardCompatSmoke(databaseUrl: string): Promise<string[]> {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ["error"],
  });
  const notes: string[] = [];
  try {
    await prisma.$connect();

    // Tables that have existed since early migrations — old app code still reads them.
    const probes: Array<{ name: string; fn: () => Promise<unknown> }> = [
      {
        name: "User.count",
        fn: () => prisma.user.count(),
      },
      {
        name: "Account.count",
        fn: () => prisma.account.count(),
      },
      {
        name: "_prisma_migrations",
        fn: () =>
          prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" LIMIT 5`,
      },
    ];

    for (const probe of probes) {
      try {
        await probe.fn();
        notes.push(`${probe.name}: ok`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Backward-compat smoke failed on ${probe.name}: ${message}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  return notes;
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const databaseUrl = ensureDatabaseUrl();

  console.log("==> Pre-migration health check");
  const pre = await runDbHealthCheck("pre");
  const prePath = path.join(RESULTS_DIR, "pre-health.json");
  fs.writeFileSync(prePath, JSON.stringify(pre, null, 2));
  if (!pre.ok) {
    console.error("Pre-migration health check failed:", pre.errors);
    process.exit(1);
  }
  console.log(
    `  connect=${pre.connectMs.toFixed(1)}ms select1=${pre.selectOneMs.toFixed(1)}ms pool=${pre.poolProbeMs.toFixed(1)}ms`,
  );

  console.log("==> prisma migrate deploy (shadow / staging DB)");
  const deployLog = migrateDeploy(databaseUrl);
  console.log(deployLog.trim() || "(no output)");

  console.log("==> Verify schema drift is empty");
  try {
    assertNoDrift(databaseUrl);
    console.log("  No drift between database and schema.prisma");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // prisma migrate diff --exit-code returns exit 1 when there IS a diff
    if (message.includes("exit code") || message.includes("Command failed")) {
      console.error("Schema drift detected after migrate deploy.");
      console.error(message);
      process.exit(1);
    }
    throw error;
  }

  console.log("==> Backward-compat smoke queries");
  const smokeNotes = await backwardCompatSmoke(databaseUrl);
  for (const note of smokeNotes) console.log(`  ${note}`);

  console.log("==> Post-migration health check");
  const post = await runDbHealthCheck("post");
  const postPath = path.join(RESULTS_DIR, "post-health.json");
  fs.writeFileSync(postPath, JSON.stringify(post, null, 2));

  const comparison = compareHealth(pre, post);
  const summary = {
    generatedAt: new Date().toISOString(),
    pre,
    post,
    comparison,
    smokeNotes,
  };
  fs.writeFileSync(
    path.join(RESULTS_DIR, "shadow-migrate-summary.json"),
    JSON.stringify(summary, null, 2),
  );

  if (!comparison.ok) {
    console.error("Post-migration health regression:");
    for (const msg of comparison.messages) console.error(`  - ${msg}`);
    process.exit(1);
  }

  console.log("✓ Shadow migrate simulation passed.");
  console.log(`  Artifacts: ${RESULTS_DIR}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
