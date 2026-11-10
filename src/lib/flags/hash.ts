/**
 * MurmurHash3 (32-bit) → stable 0–99 bucket for percentage / A/B assignment.
 * Same (subjectId, flagKey) always lands in the same bucket — deterministic canaries.
 */

function murmur32(key: string, seed = 0): number {
  let h = seed >>> 0;
  const len = key.length;
  let i = 0;

  while (i + 4 <= len) {
    let k =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    i += 4;
  }

  let k = 0;
  const rem = len & 3;
  if (rem >= 3) k ^= (key.charCodeAt(i + 2) & 0xff) << 16;
  if (rem >= 2) k ^= (key.charCodeAt(i + 1) & 0xff) << 8;
  if (rem >= 1) {
    k ^= key.charCodeAt(i) & 0xff;
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
  }

  h ^= len;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Public MurmurHash3-32 hex helper (debugging / tests). */
export function murmurHash3(input: string, seed = 0): number {
  return murmur32(input, seed);
}

/**
 * Stable 0–99 rollout bucket.
 * Seeded with flag key so cohorts differ across flags for the same user.
 */
export function flagBucket(subjectId: string, flagKey: string): number {
  const seed = murmur32(flagKey, 0x5349474e); // "SIGN"
  return murmur32(subjectId, seed) % 100;
}
