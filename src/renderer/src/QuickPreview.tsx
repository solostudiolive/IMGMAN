import type { Item } from '../../preload/types'
import { TypeIcon } from './components/icons'

// Full-viewport overlay showing the selected item's original. Keyboard
// (Space/Escape) is owned by LibraryGate; this only renders + closes on backdrop.
export default function QuickPreview({
  item,
  onClose
}: {
  item: Item
  onClose: () => void
}): React.JSX.Element {
  const src = `imgman://original/${item.id}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box'
      }}
    >
      <Content item={item} src={src} />
    </div>
  )
}

function Content({ item, src }: { item: Item; src: string }): React.JSX.Element {
  const fit: React.CSSProperties = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
  // Stop clicks on the media itself from bubbling to the backdrop (which closes).
  const stop = (e: React.MouseEvent): void => e.stopPropagation()

  if (item.type === 'image') {
    return <img src={src} style={fit} onClick={stop} />
  }
  if (item.type === 'video') {
    return <video src={src} controls autoPlay style={fit} onClick={stop} />
  }
  if (item.type === 'audio') {
    return (
      <div onClick={stop} style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <TypeIcon type="audio" size={64} />
        </div>
        <audio src={src} controls autoPlay />
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>{item.name}</div>
      </div>
    )
  }
  // font / doc / other — no inline renderer yet; show a large placeholder.
  return (
    <div onClick={stop} style={{ textAlign: 'center', color: '#fff' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <TypeIcon type={item.type} size={80} />
      </div>
      <div style={{ fontSize: 14 }}>{item.name}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
        No preview for {item.ext ? item.ext.toUpperCase() : item.type} files yet.
      </div>
    </div>
  )
}
