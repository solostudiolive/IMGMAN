import { protocol, net } from 'electron'
import { join, resolve, sep } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { getActiveLibrary, imagesDir } from './services/library'
import { getDb, isDatabaseOpen } from './db'

export const IMGMAN_SCHEME = 'imgman'

// UUIDs only — ids never contain slashes or dots, which blocks path traversal.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Must run BEFORE app `whenReady` — privileged schemes register at startup.
 * `standard` + `secure` makes imgman:// behave like https (proper origin,
 * fetchable, streamable) so <img src> and fetch() work from the sandboxed
 * renderer without relaxing its security.
 */
export function registerImgmanScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMGMAN_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

function notFound(): Response {
  return new Response(null, { status: 404 })
}

function badRequest(): Response {
  return new Response(null, { status: 400 })
}

/**
 * Resolve imgman://<kind>/<id> to a file strictly inside the ACTIVE library's
 * images/<id>/ folder. kind = 'thumb' | 'original'.
 */
function resolveFile(kind: string, id: string): string | null {
  const lib = getActiveLibrary()
  if (!lib) return null
  if (!UUID_RE.test(id)) return null

  const root = imagesDir(lib.path)
  const itemDir = join(root, id)

  let file: string
  if (kind === 'thumb') {
    file = join(itemDir, 'thumbnail.webp')
  } else if (kind === 'original') {
    let ext = ''
    if (isDatabaseOpen()) {
      const row = getDb().prepare('SELECT ext FROM items WHERE id = ?').get(id) as
        | { ext: string | null }
        | undefined
      if (!row) return null
      ext = row.ext ?? ''
    }
    file = join(itemDir, ext ? `original.${ext}` : 'original')
  } else {
    return null
  }

  // Defense-in-depth: the resolved path must stay within the images root.
  const abs = resolve(file)
  if (abs !== resolve(root) && !abs.startsWith(resolve(root) + sep)) return null
  if (!existsSync(abs)) return null
  return abs
}

/** Call AFTER app `whenReady`. */
export function registerImgmanProtocol(): void {
  protocol.handle(IMGMAN_SCHEME, async (request) => {
    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return badRequest()
    }
    const kind = url.hostname // imgman://thumb/<id> → host = 'thumb'
    const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!kind || !id) return badRequest()

    const abs = resolveFile(kind, id)
    if (!abs) return notFound()

    // net.fetch over a file URL handles streaming, range requests, and
    // Content-Type inference.
    return net.fetch(pathToFileURL(abs).toString())
  })
}
