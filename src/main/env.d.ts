// Allow importing raw SQL (and similar text assets) as strings via Vite's ?raw.
declare module '*.sql?raw' {
  const content: string
  export default content
}

// electron-vite ?asset imports resolve to the emitted file path at runtime (used for the window icon).
declare module '*?asset' {
  const src: string
  export default src
}
