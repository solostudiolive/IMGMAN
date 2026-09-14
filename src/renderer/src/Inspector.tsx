import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FullItem } from '../../preload/types'
import TagEditor from './TagEditor'
import FolderAssigner from './FolderAssigner'
import QuickPreview from './QuickPreview'
import { TypeIcon, DownloadIcon, PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, VolumeIcon, VolumeMuteIcon, FullscreenIcon } from './components/icons'
import Select from './components/Select'
import { baseName, withExt } from './displayName'

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}

function formatDate(ms: number | null): string | null {
  if (!ms) return null
  return new Date(ms).toLocaleString()
}

export default function Inspector({
  selectedId,
  onChanged
}: {
  selectedId: string | null
  // Fired after a rename so the grid caption / list refreshes to match.
  onChanged?: () => void
}): React.JSX.Element {
  const [item, setItem] = useState<FullItem | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)
  // Full-size lightbox toggled by clicking the preview thumbnail.
  const [zoomed, setZoomed] = useState(false)
  // Editable name draft (Eagle-style inline rename). Synced to the loaded item.
  const [nameDraft, setNameDraft] = useState('')
  // Editable Notes + Source URL drafts (Eagle inspector fields).
  const [noteDraft, setNoteDraft] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  // Load the full record whenever the selection changes (clear when none).
  useEffect(() => {
    let cancelled = false
    setThumbFailed(false)
    setZoomed(false)
    setExportMsg(null)
    if (!selectedId) {
      setItem(null)
      return
    }
    window.api.items.get(selectedId).then((row) => {
      if (!cancelled) {
        setItem(row)
        setNameDraft(row ? baseName(row.name, row.ext) : '')
        setNoteDraft(row?.note ?? '')
        setUrlDraft(row?.source_url ?? '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // Parse the stored palette JSON defensively → array of #rrggbb (empty when none / non-image).
  const colors = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(item?.palette ?? '[]')
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }, [item?.palette])

  // While the lightbox is open, Escape closes it. Capture + stopPropagation so LibraryGate's
  // window-level handler (which owns Space/Escape for its own quick preview) doesn't also fire.
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setZoomed(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [zoomed])

  if (!selectedId || !item) {
    return (
      <aside style={ASIDE_STYLE}>
        <div
          style={{
            color: 'var(--color-text-faint)',
            fontSize: 13,
            padding: 12,
            textAlign: 'center'
          }}
        >
          Select an item to see details.
        </div>
      </aside>
    )
  }

  const showThumb = item.type !== 'other' && !thumbFailed
  const isVideo = item.type === 'video'
  const isAudio = item.type === 'audio'
  const isPlayer = isVideo || isAudio
  const dims = item.width && item.height ? `${item.width} × ${item.height}` : null
  const duration = item.duration_ms ? formatDuration(item.duration_ms) : null
  const created = formatDate(item.created_at)
  const imported = formatDate(item.imported_at)

  // Optimistically update, persist, then reconcile to the canonical DB row.
  // On failure, revert and surface — never leave a phantom rating that vanishes
  // on the next selection.
  const setRating = async (n: number): Promise<void> => {
    const prev = item.rating
    setItem({ ...item, rating: n })
    try {
      const row = await window.api.items.update(item.id, { rating: n })
      if (row) setItem(row)
      else setItem((cur) => (cur ? { ...cur, rating: prev } : cur))
    } catch (err) {
      console.error('Failed to save rating:', err)
      setItem((cur) => (cur ? { ...cur, rating: prev } : cur))
    }
  }

  // Commit the inline rename. The field edits the base name (no extension); the stored `name`
  // keeps its `.<ext>`. No-op on empty / unchanged; refresh the grid on success.
  const currentBase = baseName(item.name, item.ext)
  const commitName = async (): Promise<void> => {
    const nextBase = nameDraft.trim()
    if (!nextBase || nextBase === currentBase) {
      setNameDraft(currentBase)
      return
    }
    const fullName = withExt(nextBase, item.ext)
    setItem({ ...item, name: fullName })
    try {
      await window.api.items.renameMany([{ id: item.id, name: fullName }])
      onChanged?.()
    } catch (err) {
      console.error('Failed to rename:', err)
      setItem((cur) => (cur ? { ...cur, name: item.name } : cur))
      setNameDraft(currentBase)
    }
  }

  // Persist Notes / Source URL on blur (skip when unchanged). Reconcile to the returned row.
  const commitNote = async (): Promise<void> => {
    if ((item.note ?? '') === noteDraft) return
    const row = await window.api.items.update(item.id, { note: noteDraft })
    if (row) setItem(row)
  }
  const commitUrl = async (): Promise<void> => {
    if ((item.source_url ?? '') === urlDraft) return
    const row = await window.api.items.update(item.id, { source_url: urlDraft })
    if (row) setItem(row)
  }

  const doExport = async (): Promise<void> => {
    setExporting(true)
    setExportMsg(null)
    try {
      const res = await window.api.items.export([item.id])
      if (res.ok) setExportMsg(`Exported ${res.exported} file${res.exported === 1 ? '' : 's'}.`)
      else if (!('cancelled' in res)) setExportMsg(res.error)
    } finally {
      setExporting(false)
    }
  }

  const doConvert = async (format: 'jpg' | 'png' | 'webp' | 'avif'): Promise<void> => {
    setExportMsg(null)
    const res = await window.api.items.convert([item.id], format)
    if (res.ok) setExportMsg(`Converted to ${format.toUpperCase()}.`)
    else if (!('cancelled' in res)) setExportMsg(res.error)
  }

  return (
    <aside style={ASIDE_STYLE}>
      {isAudio ? (
        <SidebarAudioPlayer
          key={item.id}
          src={`imgman://original/${item.id}`}
          durationMs={item.duration_ms ?? null}
        />
      ) : (
        <div
          className={showThumb && !isVideo ? 'inspector-thumb' : undefined}
          onClick={() => showThumb && !isVideo && setZoomed(true)}
          title={showThumb && !isVideo ? 'Click to enlarge' : undefined}
          style={{
            width: '100%',
            aspectRatio: isVideo ? '16 / 9' : '1 / 1',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--color-bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            cursor: showThumb && !isVideo ? 'zoom-in' : 'default'
          }}
        >
          {isVideo ? (
            <SidebarVideoPlayer
              key={item.id}
              src={`imgman://original/${item.id}`}
              durationMs={item.duration_ms ?? null}
              onExpand={() => setZoomed(true)}
            />
          ) : showThumb ? (
            <>
              <img
                className="inspector-thumb__img"
                src={`imgman://thumb/${item.id}`}
                onError={() => setThumbFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <span className="inspector-thumb__hint" aria-hidden>
                ⤢
              </span>
            </>
          ) : (
            <TypeIcon type={item.type} size={48} style={{ color: 'var(--color-text-faint)' }} />
          )}
          {item.ext && !isVideo && (
            // Eagle-style format badge in the corner of the preview.
            <span className="inspector-badge">{item.ext.toUpperCase()}</span>
          )}
        </div>
      )}

      {/* Inline-editable filename (rename). Enter/blur commits, Escape reverts. */}
      <input
        className="inspector-name"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') {
            setNameDraft(currentBase)
            e.currentTarget.blur()
          }
        }}
        aria-label="File name"
        spellCheck={false}
      />

      <textarea
        className="inspector-note"
        value={noteDraft}
        placeholder="Notes…"
        rows={2}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => void commitNote()}
        aria-label="Notes"
      />
      <div className="inspector-url">
        <input
          value={urlDraft}
          placeholder="Source URL…"
          spellCheck={false}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={() => void commitUrl()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Source URL"
        />
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            title="Open source"
            className="inspector-url__link"
          >
            ↗
          </a>
        )}
      </div>

      <dl style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <Row label="Type" value={item.type} />
        <Row label="Format" value={item.ext ? item.ext.toUpperCase() : null} />
        <Row label="Dimensions" value={dims} />
        <Row label="Duration" value={duration} />
        <Row label="Size" value={formatBytes(item.size_bytes)} />
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '4px 0',
            borderTop: '1px solid var(--color-border)',
            alignItems: 'center'
          }}
        >
          <dt style={{ flex: '0 0 84px', color: 'var(--color-text-faint)' }}>Rating</dt>
          <dd style={{ margin: 0, flex: 1 }}>
            <StarRating value={item.rating} onChange={setRating} />
          </dd>
        </div>
        <Row label="Created" value={created} />
        <Row label="Imported" value={imported} />
      </dl>

      {colors.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0', fontSize: 12 }}>
          <div style={{ color: 'var(--color-text-faint)', marginBottom: 6 }}>Colors</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {colors.map((color, i) => (
              <span
                key={`${color}-${i}`}
                title={color}
                style={{
                  width: 18,
                  height: 18,
                  // Eagle uses circular color dots.
                  borderRadius: 'var(--radius-pill)',
                  // The swatch background is the literal extracted color (intentional, not a token).
                  background: color,
                  border: '1px solid var(--color-border)'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <FolderAssigner itemId={item.id} />
      <TagEditor itemId={item.id} />

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="inspector-export"
          onClick={() => void doExport()}
          disabled={exporting}
        >
          <DownloadIcon size={15} />
          {exporting ? 'Exporting…' : 'Export'}
        </button>
        {item.type === 'image' && (
          <div style={{ marginTop: 8 }}>
            <Select
              value=""
              placeholder="Convert to…"
              ariaLabel="Convert to format"
              options={[
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WEBP' },
                { value: 'avif', label: 'AVIF' }
              ]}
              onChange={(f) => void doConvert(f as 'jpg' | 'png' | 'webp' | 'avif')}
            />
          </div>
        )}
        {exportMsg && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              textAlign: 'center'
            }}
          >
            {exportMsg}
          </p>
        )}
      </div>

      {zoomed && <QuickPreview item={item} onClose={() => setZoomed(false)} />}
    </aside>
  )
}

// Five clickable stars. Click a star to set the rating; click the current
// top star again to clear back to 0.
function StarRating({
  value,
  onChange
}: {
  value: number
  onChange: (n: number) => void
}): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star-btn"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            // Star-yellow is an intentional fixed affordance color; empty uses a visible muted token
            // (border-strong was near-invisible in dark mode).
            color: n <= value ? '#f5b301' : 'var(--color-text-faint)'
          }}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

// Omit rows with no value rather than rendering blanks.
function Row({ label, value }: { label: string; value: string | null }): React.JSX.Element | null {
  if (!value) return null
  return (
    <div
      style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: '1px solid var(--color-border)' }}
    >
      <dt style={{ flex: '0 0 84px', color: 'var(--color-text-faint)' }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-word', flex: 1, color: 'var(--color-text)' }}>
        {value}
      </dd>
    </div>
  )
}

// ── Sidebar Audio Mini-Player ────────────────────────────────────────────
function SidebarAudioPlayer({
  src,
  durationMs
}: {
  src: string
  durationMs: number | null
}): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0)
  const [muted, setMuted] = useState(false)

  const togglePlay = useCallback((): void => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) { void el.play(); setPlaying(true) }
    else { el.pause(); setPlaying(false) }
  }, [])

  const seekBy = useCallback((delta: number): void => {
    const el = audioRef.current
    if (!el) return
    const next = Math.max(0, Math.min(el.duration || duration, el.currentTime + delta))
    el.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const doSeek = useCallback((clientX: number): void => {
    const el = trackRef.current
    const audio = audioRef.current
    if (!el || !audio) return
    const dur = audio.duration || duration
    if (dur <= 0) return
    const rect = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * dur
    audio.currentTime = t
    setCurrentTime(t)
  }, [duration])

  const handleScrubMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    doSeek(e.clientX)
    const onMove = (ev: MouseEvent): void => { if (isDragging.current) doSeek(ev.clientX) }
    const onUp = (ev: MouseEvent): void => {
      if (isDragging.current) { doSeek(ev.clientX); isDragging.current = false }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [doSeek])

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    if (isDragging.current) return
    doSeek(e.clientX)
  }, [doSeek])

  const toggleMute = useCallback((): void => {
    const el = audioRef.current
    if (!el) return
    el.muted = !muted
    setMuted((m) => !m)
  }, [muted])

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="sp-player">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime) }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration) }}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Transport: artwork + play controls + mute */}
      <div className="sp-row">
        <div className={`sp-artwork${playing ? ' sp-artwork--playing' : ''}`}>
          <TypeIcon type="audio" size={20} />
        </div>
        <div className="sp-transport">
          <button type="button" className="sp-btn" onClick={() => seekBy(-10)} title="Rewind 10s">
            <SkipBackIcon size={14} />
          </button>
          <button type="button" className="sp-btn sp-btn--play" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
          </button>
          <button type="button" className="sp-btn" onClick={() => seekBy(10)} title="Forward 10s">
            <SkipForwardIcon size={14} />
          </button>
        </div>
        <button type="button" className="sp-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeMuteIcon size={14} /> : <VolumeIcon size={14} />}
        </button>
      </div>

      {/* Scrubber */}
      <div
        ref={trackRef}
        className="sp-track-wrap"
        onMouseDown={handleScrubMouseDown}
        onClick={handleScrubClick}
      >
        <div className="sp-track">
          <div className="sp-track-fill" style={{ width: `${pct}%` }}>
            <div className="sp-track-thumb" />
          </div>
        </div>
      </div>

      {/* Time row */}
      <div className="sp-time-row">
        <span>{formatDuration(currentTime * 1000)}</span>
        <span>{formatDuration(duration * 1000)}</span>
      </div>
    </div>
  )
}

// ── Sidebar Video Mini-Player ────────────────────────────────────────────
function SidebarVideoPlayer({
  src,
  durationMs,
  onExpand
}: {
  src: string
  durationMs: number | null
  onExpand: () => void
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0)
  const [muted, setMuted] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(true)

  // Autoplay muted on mount; clean up any lingering timer on unmount.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = true
    void el.play().catch(() => {})
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])

  // Always show controls while paused; auto-hide 2 s after mouse activity when playing.
  const nudgeControls = useCallback((): void => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2000)
  }, [])

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true)
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [playing])

  const togglePlay = useCallback((): void => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }, [])

  const doSeek = useCallback((clientX: number): void => {
    const el = trackRef.current
    const video = videoRef.current
    if (!el || !video) return
    const dur = video.duration || duration
    if (dur <= 0) return
    const rect = el.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * dur
    video.currentTime = t
    setCurrentTime(t)
  }, [duration])

  const handleScrubMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    doSeek(e.clientX)
    const onMove = (ev: MouseEvent): void => { if (isDragging.current) doSeek(ev.clientX) }
    const onUp = (ev: MouseEvent): void => {
      if (isDragging.current) { doSeek(ev.clientX); isDragging.current = false }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [doSeek])

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    if (isDragging.current) return
    doSeek(e.clientX)
  }, [doSeek])

  const toggleMute = useCallback((): void => {
    const el = videoRef.current
    if (!el) return
    el.muted = !muted
    setMuted((m) => !m)
  }, [muted])

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        cursor: playing && !controlsVisible ? 'none' : 'default'
      }}
      onMouseMove={() => { if (playing) nudgeControls() }}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        loop
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime) }}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration) }}
        onEnded={() => setPlaying(false)}
      />

      {/* Center play indicator when paused */}
      {!playing && (
        <div className="sv-center-play">
          <div className="sv-center-btn">
            <PlayIcon size={20} />
          </div>
        </div>
      )}

      {/* Bottom controls overlay */}
      <div
        className={`sv-overlay${!controlsVisible && playing ? ' sv-overlay--hidden' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber — reuses sp-track styles with sv-track dark override */}
        <div
          ref={trackRef}
          className="sp-track-wrap"
          onMouseDown={handleScrubMouseDown}
          onClick={handleScrubClick}
        >
          <div className="sp-track sv-track">
            <div className="sp-track-fill" style={{ width: `${pct}%` }}>
              <div className="sp-track-thumb" />
            </div>
          </div>
        </div>
        <div className="sv-controls-row">
          <button type="button" className="sv-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </button>
          <span className="sv-time">
            {formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}
          </span>
          <button type="button" className="sv-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeMuteIcon size={13} /> : <VolumeIcon size={13} />}
          </button>
          <button
            type="button"
            className="sv-btn"
            onClick={(e) => { e.stopPropagation(); onExpand() }}
            title="Open full preview"
          >
            <FullscreenIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

const ASIDE_STYLE: React.CSSProperties = {
  // Width/scroll/background/border are owned by the shell inspector pane (AppShell).
  width: '100%',
  padding: 12,
  boxSizing: 'border-box'
}
