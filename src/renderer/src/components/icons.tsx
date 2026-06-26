import type { ItemType } from '../../../preload/types'

// Shared FILLED icon set (Phase 8.1 restyle). Solid glyphs, single-path where possible, drawn with
// `fill: currentColor` so they inherit the surrounding text color (muted normally, accent when active).
// Inline SVG — no icon-font / dependency, CSP-safe.

type IconProps = { size?: number; style?: React.CSSProperties }

function svgProps(size: number): React.SVGProps<SVGSVGElement> {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }
}

const base: React.CSSProperties = { flex: '0 0 auto', display: 'block' }

// ---- Sidebar ----
export function FolderIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M2.5 6.5A2 2 0 0 1 4.5 4.5h4.2a2 2 0 0 1 1.4.6l1.2 1.2H19.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-10.5Z" />
    </svg>
  )
}

export function AllItemsIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  )
}

export function SmartFolderIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M2.5 6.5A2 2 0 0 1 4.5 4.5h4.2a2 2 0 0 1 1.4.6l1.2 1.2H19.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-10.5Z" opacity="0.5" />
      <path d="M11.2 10.4a3.4 3.4 0 1 0 1.9 6.2l2 2a1 1 0 0 0 1.4-1.4l-2-2a3.4 3.4 0 0 0-3.3-4.8Zm0 2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z" />
    </svg>
  )
}

// Disclosure chevron (points right; rotate 90° via `style` when the row is expanded).
export function ChevronRightIcon({ size = 12, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M9 5.4 15.6 12 9 18.6 7.4 17l5-5-5-5L9 5.4Z" />
    </svg>
  )
}

// Vertical "kebab" (3-dot) overflow-menu glyph.
export function MoreIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

// ---- Row actions ----
export function PlusIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z" />
    </svg>
  )
}

export function PencilIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M14.06 4.94 19.06 9.94 8.5 20.5l-4.6.6.6-4.6L14.06 4.94Zm1.4-1.4 2.1-2.1a1.5 1.5 0 0 1 2.12 0l2.88 2.88a1.5 1.5 0 0 1 0 2.12l-2.1 2.1-5-5Z" />
    </svg>
  )
}

export function TrashIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 8h12l-1 12.2a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 8Z" />
    </svg>
  )
}

export function EyeIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M12 5c-5 0-9 4.2-10 7 1 2.8 5 7 10 7s9-4.2 10-7c-1-2.8-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

export function StarIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.9 6.6 20l1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  )
}

export function TagIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M3 3h8.2a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.2V3Zm4.5 3A1.5 1.5 0 1 0 7.5 9 1.5 1.5 0 0 0 7.5 6Z" />
    </svg>
  )
}

// ---- Import / upload ----
export function UploadIcon({ size = 22, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <path d="M11 14V7.8L8.4 10.4 7 9l5-5 5 5-1.4 1.4L13 7.8V14h-2Z" />
      <path d="M5 16h2v3h10v-3h2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3Z" />
    </svg>
  )
}

// ---- Item-type placeholders (non-image tiles + inspector/preview fallback) ----
export function TypeIcon({ type, size = 22, style }: { type: ItemType } & IconProps): React.JSX.Element {
  const p = { ...svgProps(size), style: { ...base, ...style } }
  switch (type) {
    case 'image':
      return (
        <svg {...p}>
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 4.5A1.5 1.5 0 1 0 8 11.5 1.5 1.5 0 0 0 8 8.5ZM4 18h16v-3l-4.5-4.5L10 16l-2.5-2.5L4 17v1Z" />
        </svg>
      )
    case 'video':
      return (
        <svg {...p}>
          <path d="M4 5h12a2 2 0 0 1 2 2v2.2l4-2.4v10.4l-4-2.4V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      )
    case 'audio':
      return (
        <svg {...p}>
          <path d="M19 3v11.1a3.5 3.5 0 1 1-2-3.16V6.8l-8 1.6v7.7a3.5 3.5 0 1 1-2-3.16V5.2L19 3Z" />
        </svg>
      )
    case 'font':
      return (
        <svg {...p}>
          <path d="M5 4h14v4h-2V6h-4v12h2v2H9v-2h2V6H7v2H5V4Z" />
        </svg>
      )
    case 'doc':
      return (
        <svg {...p}>
          <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM7.5 12h9v1.6h-9V12Zm0 3.2h9v1.6h-9v-1.6Z" />
        </svg>
      )
    default:
      return (
        <svg {...p}>
          <path d="M12 2.2 21 7v10l-9 4.8L3 17V7l9-4.8Zm0 2.3L5.6 8 12 11.5 18.4 8 12 4.5ZM5 9.6V16l6 3.2v-6.4L5 9.6Zm14 0-6 3.2v6.4l6-3.2V9.6Z" />
        </svg>
      )
  }
}
