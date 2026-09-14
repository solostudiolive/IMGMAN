import type { ItemType } from '../../../preload/types'

// Shared OUTLINE icon set (Lucide-style). Stroked glyphs (`fill: none`, `stroke: currentColor`) so
// they inherit the surrounding text color and read consistently at UI sizes. Inline SVG — no
// icon-font / dependency, CSP-safe. TypeIcon (item-type placeholders) stays filled below.

type IconProps = { size?: number; style?: React.CSSProperties }

// Filled preset — used only by the large TypeIcon placeholders.
function svgProps(size: number): React.SVGProps<SVGSVGElement> {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }
}

// Outline preset — the shared stroked look for every sidebar / menu / action icon.
function strokeProps(size: number): React.SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }
}

const base: React.CSSProperties = { flex: '0 0 auto', display: 'block' }

// ---- Sidebar ----
export function FolderIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  )
}

export function AllItemsIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function SmartFolderIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
    </svg>
  )
}

// Disclosure chevron (points right; rotate 90° via `style` when the row is expanded).
export function ChevronRightIcon({ size = 12, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// Vertical "kebab" (3-dot) overflow-menu glyph (dots are filled so they read at small sizes).
export function MoreIcon({ size = 15, style }: IconProps): React.JSX.Element {
  return (
    <svg {...svgProps(size)} style={{ ...base, ...style }}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

// ---- Row actions ----
export function PlusIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function PencilIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

export function TrashIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function EyeIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function StarIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  )
}

export function TagIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V20l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

// ---- Import / upload ----
export function UploadIcon({ size = 22, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}

export function ClipboardIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

// Two-way swap arrows — the "convert format" action.
export function ConvertIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  )
}

export function DownloadIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

// Link / URL import icon
export function LinkIcon({ size = 14, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

// ---- Media player action icons ----
export function PlayIcon({ size = 24, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M5 3v18l15-9L5 3Z" />
    </svg>
  )
}

export function PauseIcon({ size = 24, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <rect x="3" y="5" width="7" height="14" rx="1" />
      <rect x="14" y="5" width="7" height="14" rx="1" />
    </svg>
  )
}

export function MaximizeIcon({ size = 24, style }: IconProps): React.JSX.Element {
  return (
    <svg {...strokeProps(size)} style={{ ...base, ...style }}>
      <path d="M8 3H4a1 1 0 0 0-1 1v4" />
      <path d="M4 8V4l4 4" />
      <path d="M16 21h4a1 1 0 0 0 1-1v-4" />
      <path d="M20 16h-4l4 4Z" />
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
