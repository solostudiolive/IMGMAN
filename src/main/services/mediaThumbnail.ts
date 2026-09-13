import fs from 'fs'
import { readFileSync } from 'fs'
import sharp from 'sharp'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import * as pdfjsLib from 'pdfjs-dist'
import * as opentype from 'opentype.js'
import type { ItemType } from './import'

// Metadata captured from a media file during thumbnail extraction.
export interface ItemMediaMeta {
  width: number | null
  height: number | null
  durationMs: number | null
}

// How long (ms) to read from each audio/video for waveform/cover-art fallback.
const AUDIO_COVER_PROBE_SECONDS = 5

// Lazy-initialized ffmpeg singleton — loading the WASM core is expensive, so we
// load it once and reuse across all imports. The instance lives until process exit.
let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

/** Lazy-load ffmpeg so it's only initialized once, on first use. */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (ffmpegLoading) return ffmpegLoading
  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg()
    // @ffmpeg/core is bundled alongside @ffmpeg/ffmpeg; point the WASM loader at the local files
    // so we don't hit the network (offline-first). coreURL and wasmURL resolve to the package.
    const coreURL = require.resolve('@ffmpeg/core/dist/esm/ffmpeg-core.js')
    const wasmURL = require.resolve('@ffmpeg/core/dist/esm/ffmpeg-core.wasm')
    await ffmpeg.load({ coreURL, wasmURL })
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()
  try {
    return await ffmpegLoading
  } finally {
    ffmpegLoading = null
  }
}

/** Read file bytes as Uint8Array (fetchFile equivalent for the Node main process). */
function readAsBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path))
}

/** Convert ffmpeg FileData (string | Uint8Array) to a Buffer for sharp. */
function toBuffer(fileData: string | Uint8Array): Buffer {
  if (typeof fileData === 'string') {
    // ffmpeg can return a string (text output) or Uint8Array (binary data).
    return Buffer.from(fileData, 'utf-8')
  }
  return Buffer.from(fileData)
}

/** Format milliseconds as mm:ss or hh:mm:ss. */
function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// Export for reuse in the inspector duration display.
export { formatDuration }

/**
 * Extract a video thumbnail: probe duration, grab a frame at ~25% via ffmpeg, convert to webp.
 * Returns metadata or null on any failure (never throws).
 */
export async function extractVideoThumbnail(inputPath: string, outputPath: string): Promise<ItemMediaMeta | null> {
  try {
    const ffmpeg = await getFFmpeg()
    const data = readAsBytes(inputPath)

    // Probe duration (seconds) via ffprobe.
    let durationMs: number | null = null
    try {
      await ffmpeg.writeFile('__meta__', data)
      await ffmpeg.ffprobe([
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        '__meta__', '-o', '__dur__'
      ])
      const dur = await ffmpeg.readFile('__dur__')
      const durStr = typeof dur === 'string' ? dur : Buffer.from(dur).toString('utf-8').trim()
      const secs = parseFloat(durStr)
      if (!isNaN(secs) && secs > 0) durationMs = Math.round(secs * 1000)
    } catch {
      durationMs = null
    }

    // Seek to 25% of duration (or 1s fallback), extract a single frame as PNG.
    const seek = durationMs && durationMs > 0 ? Math.round(durationMs / 4 / 1000) : 1
    const code = await ffmpeg.exec([
      '-ss', String(seek),
      '-i', '__meta__',
      '-frames:v', '1',
      '-q:v', '2',
      'frame.png'
    ])
    if (code !== 0) {
      // Fallback: grab the first frame without seeking.
      const code2 = await ffmpeg.exec(['-i', '__meta__', '-frames:v', '1', '-q:v', '2', 'frame.png'])
      if (code2 !== 0) return null
    }

    const png = await ffmpeg.readFile('frame.png')
    const buf = toBuffer(png)
    await sharp(buf).png().webp({ quality: 80 }).toFile(outputPath)

    // Clean up MEMFS.
    try { ffmpeg.deleteFile('__meta__'); ffmpeg.deleteFile('frame.png'); ffmpeg.deleteFile('__dur__') } catch {}

    return { width: null, height: null, durationMs }
  } catch {
    return null
  }
}

/**
 * Extract an audio thumbnail: try embedded cover art first, fall back to a waveform render.
 * Returns metadata (including duration) or null on any failure.
 */
export async function extractAudioThumbnail(inputPath: string, outputPath: string): Promise<ItemMediaMeta | null> {
  try {
    const ffmpeg = await getFFmpeg()
    const data = readAsBytes(inputPath)

    // Probe duration + try to extract embedded cover art.
    let durationMs: number | null = null
    try {
      await ffmpeg.writeFile('__meta__', data)

      // Duration
      await ffmpeg.ffprobe([
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        '__meta__', '-o', '__dur__'
      ])
      const dur = await ffmpeg.readFile('__dur__')
      const durStr = typeof dur === 'string' ? dur : Buffer.from(dur).toString('utf-8').trim()
      const secs = parseFloat(durStr)
      if (!isNaN(secs) && secs > 0) durationMs = Math.round(secs * 1000)

      // Try cover art first.
      let gotCover = false
      const coverCode = await ffmpeg.exec([
        '-i', '__meta__',
        '-an',
        '-vcodec', 'copy',
        '-frames:v', '1',
        'cover.png'
      ])
      if (coverCode === 0) {
        const cover = await ffmpeg.readFile('cover.png')
        const buf = toBuffer(cover)
        if (buf.length > 0) {
          await sharp(buf).png().webp({ quality: 80 }).toFile(outputPath)
          gotCover = true
          try { ffmpeg.deleteFile('cover.png') } catch {}
        }
      }

      if (!gotCover) {
        // Fallback: render a waveform PNG via ffmpeg's showwaves filter.
        await ffmpeg.exec([
          '-i', '__meta__',
          '-ss', '0',
          '-t', '0.001',
          '-filter_complex', 'showwaves=s=256x64:colors=blue',
          '-frames:v', '1',
          'waveform.png'
        ])
        const wave = await ffmpeg.readFile('waveform.png')
        const buf = toBuffer(wave)
        if (buf.length > 0) {
          await sharp(buf).png().webp({ quality: 80 }).toFile(outputPath)
          try { ffmpeg.deleteFile('waveform.png') } catch {}
        }
      }

      try { ffmpeg.deleteFile('__meta__'); ffmpeg.deleteFile('__dur__') } catch {}
      return { width: null, height: null, durationMs }
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Extract a PDF thumbnail: render the first page at 200px width using pdfjs-dist,
 * convert the raw RGBA buffer to webp via sharp. Returns the rendered page dimensions.
 */
export async function extractPdfThumbnail(inputPath: string, outputPath: string): Promise<ItemMediaMeta | null> {
  try {
    // Disable worker for Node main-process usage — we render inline.
    pdfjsLib.GlobalWorkerOptions.workerSrc = null as unknown as string

    const data = new Uint8Array(readFileSync(inputPath))
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)

    const viewport = page.getViewport({ scale: 1 })
    // Render at 200px wide, preserving aspect ratio.
    const targetWidth = 200
    const scale = targetWidth / viewport.width
    const vp = page.getViewport({ scale })
    const width = Math.round(vp.width)
    const height = Math.round(vp.height)

    // Minimal canvas-like stub: captures pixel data for sharp to consume.
    // pdfjs calls getImageData on the canvas context during render.
    let pixelData: Uint8ClampedArray | null = null
    const canvasContext = {
      width,
      height,
      // pdfjs calls getImageData with a dirty rectangle during render.
      // We return a fresh buffer; sharp will consume via putImageData.
      getImageData: () => {
        const data2 = new Uint8ClampedArray(width * height * 4)
        return { data: data2, width, height }
      },
      putImageData: (d: { data: Uint8ClampedArray }) => {
        pixelData = d.data
      }
    }

    const renderTask = page.render({
      // pdfjs-dist expects a canvas-like object. canvas is required by the type,
      // but when canvasContext is provided, canvas can be null.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas: null as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: canvasContext as any,
      viewport: vp
    })
    await renderTask.promise

    if (!pixelData) {
      // putImageData wasn't called; create a blank RGBA buffer.
      const buf = Buffer.alloc(width * height * 4)
      await sharp(buf, { raw: { width, height, channels: 4 } }).webp({ quality: 80 }).toFile(outputPath)
    } else {
      // pixelData is Uint8ClampedArray — wrap in a Buffer for sharp.
      // Use subarray to get the actual byte length (Uint8ClampedArray may share a larger buffer).
      const arr = pixelData as Uint8ClampedArray
      const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
      await sharp(buf, { raw: { width, height, channels: 4 } })
        .webp({ quality: 80 })
        .toFile(outputPath)
    }

    // Clean up pdfjs resources.
    void page
    void pdf

    return { width, height, durationMs: null }
  } catch {
    return null
  }
}

/**
 * Extract a font thumbnail: render "Aa" sample text using opentype.js, output
 * the glyph paths as SVG, then rasterize to webp via sharp.
 */
export async function extractFontThumbnail(inputPath: string, outputPath: string): Promise<ItemMediaMeta | null> {
  try {
    const font = opentype.loadSync(inputPath)

    // Determine a reasonable font size from the font's unitsPerEm.
    const fontSize = 120
    // Measure the sample text to size the SVG canvas.
    const path = font.getPath('Aa', 0, fontSize, fontSize)
    const box = path.getBBox()
    const pad = 20
    const svgWidth = Math.ceil(box.x2 - box.x1 + pad * 2)
    const svgHeight = Math.ceil(box.y2 - box.y1 + pad * 2)

    // Shift the path so it's not clipped by the SVG origin.
    const offsetX = -box.x1 + pad
    const offsetY = -box.y1 + pad

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
        <path d="${path.toPathData(2)}" transform="translate(${offsetX}, ${offsetY})" fill="black"/>
      </svg>
    `

    await sharp(Buffer.from(svg), {
      // sharp can rasterize SVG strings directly.
    }).ensureAlpha().webp({ quality: 80 }).toFile(outputPath)

    return { width: svgWidth, height: svgHeight, durationMs: null }
  } catch {
    return null
  }
}

/**
 * Dispatcher: extract a media thumbnail based on item type.
 * Returns metadata or null on any failure (never throws).
 */
export async function extractMediaThumbnail(
  type: ItemType,
  inputPath: string,
  outputPath: string
): Promise<ItemMediaMeta | null> {
  if (!fs.existsSync(inputPath)) return null

  switch (type) {
    case 'video':
      return extractVideoThumbnail(inputPath, outputPath)
    case 'audio':
      return extractAudioThumbnail(inputPath, outputPath)
    case 'doc':
      return extractPdfThumbnail(inputPath, outputPath)
    case 'font':
      return extractFontThumbnail(inputPath, outputPath)
    default:
      return null
  }
}
