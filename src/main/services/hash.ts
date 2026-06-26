import { createHash } from 'crypto'
import { createReadStream } from 'fs'

// Content hashing for duplicate detection. SHA-256 of the ORIGINAL file bytes — exact-match only
// (catches re-imported / copied files regardless of name), no perceptual / near-duplicate matching.

/**
 * Stream a file through SHA-256 and resolve its lowercase hex digest. Streamed (not readFile) so a
 * large original never loads fully into memory. Rejects on any read error — callers treat that as a
 * NULL hash (skip), never fatal.
 */
export function hashFile(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(absPath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** SHA-256 hex of an in-memory buffer (clipboard-paste import path). */
export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}
