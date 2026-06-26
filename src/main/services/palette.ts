import sharp from 'sharp'

// How many dominant colors to extract per image.
export const PALETTE_SIZE = 5

// Two-hex-digit (lowercase, zero-padded) channel value.
function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/**
 * Extract up to PALETTE_SIZE dominant colors from an image, ordered most-dominant first, as
 * `#rrggbb` strings. A coarse no-dependency quantizer: downsample to 64px, read raw pixels, bucket
 * each into a 4-bits-per-channel (16 levels) RGB grid, then average the true colors within the
 * heaviest buckets. Fully transparent pixels are ignored. Never throws — returns [] on any failure
 * (the caller treats [] / null as "no palette").
 */
export async function extractPalette(input: string | Buffer): Promise<string[]> {
  try {
    const { data, info } = await sharp(input)
      .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels // 3 (RGB) or 4 (RGBA)
    // bucket key → accumulated count + summed channel values (for an averaged representative color).
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()

    for (let i = 0; i + channels <= data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (channels === 4 && data[i + 3] < 128) continue // skip (near-)transparent pixels

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const acc = buckets.get(key)
      if (acc) {
        acc.count++
        acc.r += r
        acc.g += g
        acc.b += b
      } else {
        buckets.set(key, { count: 1, r, g, b })
      }
    }

    return [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, PALETTE_SIZE)
      .map((acc) => `#${hex2(acc.r / acc.count)}${hex2(acc.g / acc.count)}${hex2(acc.b / acc.count)}`)
  } catch {
    return []
  }
}

/** JSON-encode a palette for storage; null when empty (keeps "no palette" as a NULL column). */
export function paletteToJson(colors: string[]): string | null {
  return colors.length ? JSON.stringify(colors) : null
}
