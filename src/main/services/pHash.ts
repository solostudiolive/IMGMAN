import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import sharp from 'sharp'

// Perceptual hashing for near-duplicate image detection. Uses a DCT-based pHash:
// resize to 32x38 grayscale, DCT, take the top-left 8x8 AC coefficients, mean-threshold
// into a 64-bit hash. Hamming distance ≤ 8 indicates near-duplicates.

/** Number of bits in a perceptual hash (8x8 DCT coefficients). */
export const PHASH_BITS = 64

/** Hamming-distance threshold below which two images are considered near-duplicates. */
export const PHASH_DUPLICATE_THRESHOLD = 8

/**
 * Compute the perceptual hash of an image file as a 64-bit integer string.
 * Loads via sharp (decode only), resizes to 32x32 grayscale, applies DCT, and
 * returns the 64-bit hex string of the mean-thresholded AC coefficients.
 * Returns null on any failure (non-image, unreadable, decode error) — never throws.
 */
export async function pHashImage(path: string): Promise<string | null> {
  try {
    // Resize to 32x32 and convert to grayscale float32 (values 0..1).
    const { data, info } = await sharp(path)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (info.width !== 32 || info.height !== 32 || data.length < 32 * 32) return null

    // Build a 32x32 float matrix.
    const size = 32
    const matrix: number[][] = []
    for (let y = 0; y < size; y++) {
      const row: number[] = []
      for (let x = 0; x < size; x++) {
        row.push(data[y * size + x] / 255)
      }
      matrix.push(row)
    }

    // 2D DCT (type-II). Only compute the top-left 8x8 coefficients.
    const dctSize = 8
    const N = size
    const cosCache: number[] = []
    for (let k = 0; k < N; k++) {
      cosCache[k] = (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N))
    }

    const dct: number[][] = []
    for (let u = 0; u < dctSize; u++) {
      const dctRow: number[] = []
      for (let v = 0; v < dctSize; v++) {
        let sum = 0
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const cosU = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))
            const cosV = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N))
            sum += matrix[y][x] * cosU * cosV
          }
        }
        sum *= cosCache[u] * cosCache[v]
        dctRow.push(sum)
      }
      dct.push(dctRow)
    }

    // Exclude the DC component (dct[0][0]); use the remaining 64 AC coefficients
    // (dctSize*dctSize - 1 = 63). We take the top-left 8x8 = 64 total, skip DC.
    const ac: number[] = []
    for (let u = 0; u < dctSize; u++) {
      for (let v = 0; v < dctSize; v++) {
        if (u === 0 && v === 0) continue // skip DC
        ac.push(dct[u][v])
      }
    }

    if (ac.length < PHASH_BITS) return null

    // Mean of the 63 AC coefficients; threshold each to 0/1.
    const mean = ac.reduce((a, b) => a + b, 0) / ac.length
    let hash = 0n
    for (let i = 0; i < PHASH_BITS; i++) {
      if (ac[i] > mean) hash |= 1n << BigInt(PHASH_BITS - 1 - i)
    }

    // Return as a 16-char uppercase hex string (64 bits / 4 = 16 hex digits).
    let hex = hash.toString(16).toUpperCase()
    while (hex.length < 16) hex = '0' + hex
    return hex
  } catch {
    return null
  }
}

/**
 * Hamming distance between two 64-bit hex pHash strings.
 * Returns null if either string is empty or malformed.
 */
export function pHashDistance(a: string | null, b: string | null): number | null {
  if (!a || !b || a.length !== 16 || b.length !== 16) return null
  const aInt = BigInt('0x' + a)
  const bInt = BigInt('0x' + b)
  const diff = aInt ^ bInt
  let dist = 0
  for (let i = 0; i < PHASH_BITS; i++) {
    if (diff & (1n << BigInt(i))) dist++
  }
  return dist
}

/** SHA-256 hex of a buffer — kept here for potential hash-combination use. */
export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Stream a file through SHA-256 — reuses the hashFile pattern for consistency. */
export function hashFileSync(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
