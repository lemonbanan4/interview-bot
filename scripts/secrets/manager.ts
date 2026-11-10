#!/usr/bin/env npx tsx
/**
 * AES-256-GCM encrypted secret store for .env.production / .env.staging.
 *
 *   npm run secrets:keygen
 *   npm run secrets:encrypt -- --env production --input .env.production
 *   npm run secrets:decrypt -- --env production --stdout-keys
 *   npm run secrets:validate -- --env staging
 *
 * Master key: SECRETS_MASTER_KEY = 32-byte hex (64 chars) or standard base64.
 * Encrypted vault blobs live under secrets/vault/<env>.enc (safe to commit).
 * Never print decrypted values unless --write is used to a local ignored file.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnvRecord, type EnvValidationResult } from "../../src/lib/env";

export const ALGO = "aes-256-gcm" as const;
export const IV_BYTES = 12;
export const KEY_BYTES = 32;
export const VAULT_VERSION = 1 as const;

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const VAULT_DIR = path.join(REPO_ROOT, "secrets", "vault");

export type DeployEnvName = "production" | "staging";

export type VaultEnvelope = {
  v: typeof VAULT_VERSION;
  alg: typeof ALGO;
  env: DeployEnvName;
  iv: string;
  tag: string;
  ciphertext: string;
  /** SHA-256 of plaintext dotenv — integrity / change detection (not secret). */
  plaintextSha256: string;
  /** Variable names only — never values. */
  keyNames: string[];
  createdAt: string;
  updatedAt: string;
};

export type DotenvMap = Record<string, string>;

export function vaultPathFor(env: DeployEnvName): string {
  return path.join(VAULT_DIR, `${env}.enc`);
}

/** Load SECRETS_MASTER_KEY from repo `.env` into process.env when unset. */
export function hydrateMasterKeyFromDotenv(
  envFile = path.join(REPO_ROOT, ".env"),
): void {
  if (process.env.SECRETS_MASTER_KEY?.trim()) return;
  if (!fs.existsSync(envFile)) return;
  const map = parseDotenv(fs.readFileSync(envFile, "utf8"));
  const key = map.SECRETS_MASTER_KEY?.trim();
  if (key) process.env.SECRETS_MASTER_KEY = key;
}

export function parseMasterKey(raw: string | undefined): Buffer {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      "SECRETS_MASTER_KEY is required (64 hex chars or 32-byte base64). " +
        "Export it or add it to .env, then retry.",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }
  const b64 = Buffer.from(value, "base64");
  if (b64.length === KEY_BYTES) return b64;
  throw new Error(
    "SECRETS_MASTER_KEY must be 32 bytes (64 hex characters or base64)",
  );
}

export function resolveMasterKey(): Buffer {
  hydrateMasterKeyFromDotenv();
  return parseMasterKey(process.env.SECRETS_MASTER_KEY);
}

export function generateMasterKey(): { hex: string; base64: string } {
  const key = randomBytes(KEY_BYTES);
  return { hex: key.toString("hex"), base64: key.toString("base64") };
}

/** Minimal dotenv parser — KEY=VALUE, # comments, optional quotes. */
export function parseDotenv(contents: string): DotenvMap {
  const out: DotenvMap = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function serializeDotenv(map: DotenvMap): string {
  const keys = Object.keys(map).sort();
  const lines = [
    `# Signal encrypted vault plaintext — do not commit`,
    `# Generated ${new Date().toISOString()}`,
    "",
  ];
  for (const key of keys) {
    const value = map[key] ?? "";
    const needsQuote = /[\s#"']/.test(value) || value === "";
    lines.push(
      needsQuote
        ? `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        : `${key}=${value}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function encryptDotenv(
  plaintext: string,
  masterKey: Buffer,
  env: DeployEnvName,
  previous?: VaultEnvelope | null,
): VaultEnvelope {
  if (masterKey.length !== KEY_BYTES) {
    throw new Error(`master key must be ${KEY_BYTES} bytes`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const keyNames = Object.keys(parseDotenv(plaintext)).sort();
  const now = new Date().toISOString();
  return {
    v: VAULT_VERSION,
    alg: ALGO,
    env,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    plaintextSha256: createHash("sha256")
      .update(plaintext, "utf8")
      .digest("hex"),
    keyNames,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export function decryptEnvelope(
  envelope: VaultEnvelope,
  masterKey: Buffer,
): string {
  if (envelope.v !== VAULT_VERSION) {
    throw new Error(`unsupported vault version: ${envelope.v}`);
  }
  if (envelope.alg !== ALGO) {
    throw new Error(`unsupported algorithm: ${envelope.alg}`);
  }
  if (masterKey.length !== KEY_BYTES) {
    throw new Error(`master key must be ${KEY_BYTES} bytes`);
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const decipher = createDecipheriv(ALGO, masterKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  const digest = createHash("sha256").update(plaintext, "utf8").digest("hex");
  const expected = Buffer.from(envelope.plaintextSha256, "utf8");
  const actual = Buffer.from(digest, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("vault plaintext SHA-256 mismatch after decrypt");
  }
  return plaintext;
}

export function readEnvelope(filePath: string): VaultEnvelope {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as VaultEnvelope;
  if (!parsed || typeof parsed !== "object" || parsed.v !== VAULT_VERSION) {
    throw new Error(`invalid vault envelope: ${filePath}`);
  }
  return parsed;
}

export function writeEnvelope(filePath: string, envelope: VaultEnvelope): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(envelope, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function loadDecryptedMap(
  env: DeployEnvName,
  masterKey = resolveMasterKey(),
): { map: DotenvMap; envelope: VaultEnvelope; plaintext: string } {
  const filePath = vaultPathFor(env);
  if (!fs.existsSync(filePath)) {
    throw new Error(`vault not found: ${filePath}`);
  }
  const envelope = readEnvelope(filePath);
  const plaintext = decryptEnvelope(envelope, masterKey);
  return { map: parseDotenv(plaintext), envelope, plaintext };
}

export function validateVaultEnv(
  env: DeployEnvName,
  masterKey = resolveMasterKey(),
): EnvValidationResult {
  const { map } = loadDecryptedMap(env, masterKey);
  return validateEnvRecord(map, { profile: env, mode: "strict" });
}

function usage(): never {
  console.log(`Usage:
  secrets:keygen
  secrets:encrypt --env <production|staging> --input <file> [--output <file>]
  secrets:decrypt --env <production|staging> [--write <file>] [--stdout-keys]
  secrets:validate --env <production|staging>
  secrets:list --env <production|staging>
`);
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = { _: "" };
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { cmd: positionals[0] || "", flags: out };
}

function requireEnvName(value: unknown): DeployEnvName {
  if (value === "production" || value === "staging") return value;
  throw new Error("--env must be production or staging");
}

function cmdKeygen(): void {
  const key = generateMasterKey();
  console.log(
    "Generated SECRETS_MASTER_KEY (store in GitHub Actions secrets / vault):",
  );
  console.log(`hex:    ${key.hex}`);
  console.log(`base64: ${key.base64}`);
  console.log("");
  console.log("Export for local use:");
  console.log(`  export SECRETS_MASTER_KEY=${key.hex}`);
}

function cmdEncrypt(flags: Record<string, string | boolean>): void {
  const env = requireEnvName(flags.env);
  const input = String(flags.input || "");
  if (!input) throw new Error("--input <dotenv file> is required");
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(String(flags.output || vaultPathFor(env)));
  const masterKey = resolveMasterKey();
  const plaintext = fs.readFileSync(inputPath, "utf8");
  const map = parseDotenv(plaintext);
  // Never seal the master key (or local-only signing material) into the vault.
  for (const drop of [
    "SECRETS_MASTER_KEY",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    "APPLE_PASSWORD",
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "WINDOWS_CERTIFICATE",
    "WINDOWS_CERTIFICATE_PASSWORD",
  ]) {
    delete map[drop];
  }
  if (Object.keys(map).length === 0) {
    throw new Error(`no KEY=VALUE pairs found in ${inputPath}`);
  }
  const sealedPlaintext = serializeDotenv(map);
  let previous: VaultEnvelope | null = null;
  if (fs.existsSync(outputPath)) {
    try {
      previous = readEnvelope(outputPath);
    } catch {
      previous = null;
    }
  }
  const envelope = encryptDotenv(sealedPlaintext, masterKey, env, previous);
  writeEnvelope(outputPath, envelope);
  console.log(
    JSON.stringify(
      {
        event: "secrets.encrypted",
        env,
        output: path.relative(REPO_ROOT, outputPath),
        keyCount: envelope.keyNames.length,
        plaintextSha256: envelope.plaintextSha256,
        updatedAt: envelope.updatedAt,
      },
      null,
      2,
    ),
  );
}

function cmdDecrypt(flags: Record<string, string | boolean>): void {
  const env = requireEnvName(flags.env);
  const { map, envelope, plaintext } = loadDecryptedMap(env);
  if (flags["stdout-keys"] || flags.list) {
    console.log(
      JSON.stringify(
        {
          env,
          keyNames: envelope.keyNames,
          keyCount: envelope.keyNames.length,
          plaintextSha256: envelope.plaintextSha256,
          updatedAt: envelope.updatedAt,
        },
        null,
        2,
      ),
    );
    return;
  }
  const writeTo = flags.write ? String(flags.write) : "";
  if (!writeTo) {
    throw new Error(
      "Refusing to print secret values. Pass --write <path> or --stdout-keys",
    );
  }
  const outPath = path.resolve(writeTo);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, plaintext, { mode: 0o600 });
  try {
    fs.chmodSync(outPath, 0o600);
  } catch {
    /* ignore on platforms without chmod */
  }
  console.log(
    JSON.stringify(
      {
        event: "secrets.decrypted",
        env,
        write: path.relative(REPO_ROOT, outPath),
        keyCount: Object.keys(map).length,
        plaintextSha256: envelope.plaintextSha256,
      },
      null,
      2,
    ),
  );
}

function cmdValidate(flags: Record<string, string | boolean>): void {
  const env = requireEnvName(flags.env);
  const result = validateVaultEnv(env);
  console.log(
    JSON.stringify(
      {
        event: "secrets.validated",
        env,
        ok: result.ok,
        issueCount: result.issues.length,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

function cmdList(flags: Record<string, string | boolean>): void {
  const env = requireEnvName(flags.env);
  const filePath = vaultPathFor(env);
  const envelope = readEnvelope(filePath);
  console.log(
    JSON.stringify(
      {
        env,
        path: path.relative(REPO_ROOT, filePath),
        keyNames: envelope.keyNames,
        keyCount: envelope.keyNames.length,
        plaintextSha256: envelope.plaintextSha256,
        createdAt: envelope.createdAt,
        updatedAt: envelope.updatedAt,
      },
      null,
      2,
    ),
  );
}

/** Write decrypted dotenv to a secure temp file; caller must unlink. */
export function decryptToTempFile(
  env: DeployEnvName,
  masterKey = resolveMasterKey(),
): { tempPath: string; keyNames: string[]; envelope: VaultEnvelope } {
  const { plaintext, envelope } = loadDecryptedMap(env, masterKey);
  const tempPath = path.join(
    os.tmpdir(),
    `signal-vault-${env}-${process.pid}-${randomBytes(6).toString("hex")}.env`,
  );
  fs.writeFileSync(tempPath, plaintext, { mode: 0o600 });
  try {
    fs.chmodSync(tempPath, 0o600);
  } catch {
    /* ignore */
  }
  return { tempPath, keyNames: envelope.keyNames, envelope };
}

function main(): void {
  hydrateMasterKeyFromDotenv();
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  try {
    switch (cmd) {
      case "keygen":
        cmdKeygen();
        break;
      case "encrypt":
        cmdEncrypt(flags);
        break;
      case "decrypt":
        cmdDecrypt(flags);
        break;
      case "validate":
        cmdValidate(flags);
        break;
      case "list":
        cmdList(flags);
        break;
      default:
        usage();
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "secrets.error",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  }
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    entry.includes("secrets/manager") ||
    entry.endsWith("scripts/secrets/manager.ts")
  );
})();

if (isDirectRun) {
  main();
}
