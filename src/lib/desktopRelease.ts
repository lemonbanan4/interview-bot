/**
 * Desktop (Tauri) release metadata for the updater API.
 * Prefer `src-tauri/updater/latest.json` (committed on each release).
 * Override via DESKTOP_RELEASE_JSON (full JSON) for hosted deploys.
 */

export type DesktopPlatformArtifact = {
  url: string;
  signature: string;
};

export type DesktopReleaseManifest = {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, DesktopPlatformArtifact>;
};

export type TauriUpdateManifest = {
  version: string;
  notes: string;
  pub_date: string;
  url: string;
  signature: string;
};

const DEFAULT_RELEASE: DesktopReleaseManifest = {
  version: "0.1.0",
  notes: "Initial desktop companion release.",
  pub_date: "2026-11-07T00:00:00.000Z",
  platforms: {},
};

function parseManifest(raw: unknown): DesktopReleaseManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<DesktopReleaseManifest>;
  if (typeof data.version !== "string" || !data.platforms) return null;
  return {
    version: data.version,
    notes: typeof data.notes === "string" ? data.notes : "",
    pub_date:
      typeof data.pub_date === "string"
        ? data.pub_date
        : new Date().toISOString(),
    platforms: data.platforms,
  };
}

/** Load release catalog from env override or updater/latest.json. */
export async function getDesktopRelease(): Promise<DesktopReleaseManifest> {
  const fromEnv = process.env.DESKTOP_RELEASE_JSON;
  if (fromEnv) {
    try {
      const parsed = parseManifest(JSON.parse(fromEnv));
      if (parsed) return parsed;
    } catch {
      console.error("Invalid DESKTOP_RELEASE_JSON");
    }
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const filePath = join(process.cwd(), "src-tauri/updater/latest.json");
    const text = await readFile(filePath, "utf8");
    const parsed = parseManifest(JSON.parse(text));
    if (parsed) return parsed;
  } catch {
    // File missing in some deploys — fall through
  }

  return DEFAULT_RELEASE;
}

/** platform key used by Tauri updater, e.g. darwin-aarch64 */
export function platformKey(target: string, arch: string): string {
  return `${target}-${arch}`;
}

/**
 * Compare semver-ish strings. Returns:
 *  - negative if a < b
 *  - 0 if equal
 *  - positive if a > b
 */
export function compareSemver(a: string, b: string): number {
  const normalize = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[.+-]/)
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const pa = normalize(a);
  const pb = normalize(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function toTauriUpdateManifest(
  release: DesktopReleaseManifest,
  key: string,
): TauriUpdateManifest | null {
  const artifact = release.platforms[key];
  if (!artifact?.url || !artifact?.signature) return null;
  if (
    artifact.signature.includes("PASTE_") ||
    artifact.url.includes("yourdomain")
  ) {
    return null;
  }

  return {
    version: release.version,
    notes: release.notes,
    pub_date: release.pub_date,
    url: artifact.url,
    signature: artifact.signature.trim(),
  };
}
