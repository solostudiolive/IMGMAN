declare module 'opentype.js' {
  export interface Path {
    getBBox(): { x1: number; y1: number; x2: number; y2: number }
    toPathData(precision?: number): string
    toSVG(): string
  }

  export interface Font {
    unitsPerEm: number
    getPath(text: string, x: number, y: number, fontSize: number): Path
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const loadSync: (path: string) => Font
  export const load: (path: string, callback: (err: any, font: Font) => void) => void
  export const parse: (data: ArrayBuffer | string, callback?: (err: any, font: Font) => void) => void
  export const BoundingBox: any
  export const Glyph: any
}
