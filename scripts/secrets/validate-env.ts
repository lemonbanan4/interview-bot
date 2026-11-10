#!/usr/bin/env npx tsx
/**
 * Validate process.env (or a dotenv file) with the shared Zod schema.
 *
 *   npm run env:validate
 *   npm run env:validate -- --file .env.production
 */

import fs from "node:fs";
import path from "node:path";
import { parseDotenv } from "./manager";
import { validateEnv, validateEnvRecord } from "../../src/lib/env";

function main(): void {
  const argv = process.argv.slice(2);
  let file: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") file = argv[++i];
  }

  const mode =
    process.env.ENV_VALIDATION === "warn"
      ? "warn"
      : process.env.ENV_VALIDATION === "off"
        ? "off"
        : "strict";

  const result = file
    ? validateEnvRecord(
        parseDotenv(fs.readFileSync(path.resolve(file), "utf8")),
        { mode },
      )
    : validateEnv({ mode, throwOnError: false });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        mode: result.mode,
        issueCount: result.issues.length,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

main();
