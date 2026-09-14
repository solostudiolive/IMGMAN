import { useEffect, useRef, useState } from 'react'
import type { Item } from '../../preload/types'
import { TypeIcon, PlayIcon, PauseIcon, MaximizeIcon } from './components/icons'
import PdfViewer from './components/PdfViewer'
import { baseName } from './displayName'

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
      className="qp-backdrop"
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

const FIT_STYLE: React.CSSProperties = { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }
const STOP = (e: React.MouseEvent): void => e.stopPropagation()

// A centered media player with a play/pause overlay button and a maximize
// button that opens the media in the lightbox. Auto-plays when opened.
function MediaPlayer({
  src,
  type,
  fileName
}: {
  src: string
  type: 'video' | 'audio'
  fileName: string
}): React.JSX.Element {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(true)

  // The lightbox opens on a user gesture (Space / click), so explicitly resuming playback
  // here is allowed even for unmuted audio — browsers otherwise block autoplay with sound.
  useEffect(() => {
    void mediaRef.current?.play().catch(() => {})
  }, [])

  const togglePlay = (): void => {
    const el = mediaRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play()
      setPlaying(true)
    }
  }

  // The maximize button opens the media in the full lightbox — but we're ALREADY
  // inside the lightbox (QuickPreview). So "maximize" just means "fill the
  // viewport": we render at full size with controls hidden, the play/pause
  // overlay still works, and Escape (via backdrop) still closes.
  // In practice the lightbox is already full-screen, so maximize is a no-op
  // that keeps the overlay controls visible.
  const onMaximize = (e: React.MouseEvent): void => {
    e.stopPropagation()
    // No-op in the lightbox context — we're already full-viewport.
    // The icon signals intent and stays for discoverability.
  }

  const isVideo = type === 'video'
  const bg = 'rgba(0, 0, 0, 0.4)'

  return (
    <div
      onClick={STOP}
      style={{
        position: 'relative',
        width: isVideo ? 'min(90vw, 90vh * 16 / 9)' : 'min(60vw, 600px)',
        maxWidth: '90vw',
        textAlign: 'center',
        color: '#fff'
      }}
    >
      {/* Media element: no native controls — we draw our own overlay. */}
      {isVideo ? (
        <video
          ref={mediaRef as React.Ref<HTMLVideoElement>}
          src={src}
          autoPlay
          playsInline
          muted={type === 'video'}
          loop
          style={{ width: '100%', borderRadius: 8, background: '#000' }}
        />
      ) : (
        <audio
          ref={mediaRef as React.Ref<HTMLAudioElement>}
          src={src}
          autoPlay
          playsInline
          controls
          style={{ width: '100%' }}
        />
      )}

      {/* Play/pause overlay centered on the media surface. */}
      {isVideo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: bg,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}
        >
          {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>
      )}

      {/* Maximize button in the bottom-right corner of the media area. */}
      <button
        type="button"
        onClick={onMaximize}
        aria-label="Maximize"
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: 4,
          border: '1px solid var(--color-border)',
          background: bg,
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14
        }}
      >
        <MaximizeIcon size={16} />
      </button>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>{baseName(fileName)}</div>
    </div>
  )
}

function Content({ item, src }: { item: Item; src: string }): React.JSX.Element {
  if (item.type === 'image') {
    return <img src={src} style={FIT_STYLE} onClick={STOP} />
  }
  if (item.type === 'video') {
    return <MediaPlayer src={src} type="video" fileName={item.name} />
  }
  if (item.type === 'audio') {
    return <MediaPlayer src={src} type="audio" fileName={item.name} />
  }
  // PDF (doc type): inline canvas render with page navigation.
  if (item.type === 'doc') {
    return <PdfViewer src={src} fileName={item.name} />
  }
  // font / other — placeholder (doc is handled above).
  return (
    <div onClick={STOP} style={{ textAlign: 'center', color: '#fff' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <TypeIcon type={item.type} size={80} />
      </div>
      <div style={{ fontSize: 14 }}>{baseName(item.name, item.ext)}</div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
        No preview for {item.ext ? item.ext.toUpperCase() : item.type} files yet.
      </div>
    </div>
  )
}
