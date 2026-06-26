// Allow importing raw SQL (and similar text assets) as strings via Vite's ?raw.
declare module '*.sql?raw' {
  const content: string
  export default content
}
