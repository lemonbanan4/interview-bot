import { NextResponse } from "next/server";
import {
  compareSemver,
  getDesktopRelease,
  platformKey,
  toTauriUpdateManifest,
} from "@/lib/desktopRelease";

/**
 * Tauri updater endpoint.
 * Client requests:
 *   /api/releases/latest?target={{target}}&arch={{arch}}&current_version={{current_version}}
 *
 * Returns 200 + single-platform manifest, or 204 when up-to-date / unsupported.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const currentVersion = searchParams.get("current_version");
    const target = searchParams.get("target");
    const arch = searchParams.get("arch");

    if (!target || !arch) {
      return NextResponse.json(
        { error: "Missing target or arch query params" },
        { status: 400 },
      );
    }

    const release = await getDesktopRelease();

    if (
      currentVersion &&
      compareSemver(currentVersion, release.version) >= 0
    ) {
      return new NextResponse(null, { status: 204 });
    }

    const key = platformKey(target, arch);
    const updateManifest = toTauriUpdateManifest(release, key);

    if (!updateManifest) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(updateManifest, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (error) {
    console.error("Error serving updater manifest:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
