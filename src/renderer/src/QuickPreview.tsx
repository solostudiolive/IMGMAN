import { useCallback, useEffect, useRef, useState } from 'react'
import type { Item } from '../../preload/types'
import {
  TypeIcon,
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  VolumeMuteIcon,
  SkipBackIcon,
  SkipForwardIcon,
  FullscreenIcon,
  ExitFullscreenIcon
} from './components/icons'
import PdfViewer from './components/PdfViewer'
import { baseName } from './displayName'
import './QuickPreview.css'

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
        background: 'rgba(0, 0, 0, 0.88)',
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
const SPEEDS = [1, 1.25, 1.5, 2, 0.5]

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const sStr = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sStr}` : `${m}:${sStr}`
}

function Scrubber({
  currentTime,
  duration,
  onSeek
}: {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  // Always-current refs so global listeners never hold stale closures
  const onSeekRef = useRef(onSeek)
  const durationRef = useRef(duration)
  useEffect(() => { onSeekRef.current = onSeek }, [onSeek])
  useEffect(() => { durationRef.current = duration }, [duration])

  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [dragTime, setDragTime] = useState<number | null>(null)
  const isDragging = useRef(false)

  const effectiveTime = dragTime !== null ? dragTime : currentTime
  const pct = durationRef.current > 0 ? Math.min(100, Math.max(0, (effectiveTime / durationRef.current) * 100)) : 0

  // Compute time for a given clientX using the track element's live rect
  const calcTime = useCallback((clientX: number): number => {
    const el = trackRef.current
    const dur = durationRef.current
    if (!el || dur <= 0) return 0
    const rect = el.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * dur
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true

    const seek = (clientX: number): void => {
      const t = calcTime(clientX)
      setDragTime(t)
      onSeekRef.current(t)
    }

    // Seek immediately on press
    seek(e.clientX)

    const onMove = (ev: MouseEvent): void => {
      if (isDragging.current) seek(ev.clientX)
    }

    const onUp = (ev: MouseEvent): void => {
      if (isDragging.current) {
        seek(ev.clientX)
        isDragging.current = false
        setDragTime(null)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [calcTime])

  // Fallback onClick — ensures a simple tap/click always seeks even if the
  // mousedown drag flow was interrupted (common in Electron environments).
  const onClickSeek = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation()
    if (isDragging.current) return // already handled by drag flow
    const t = calcTime(e.clientX)
    onSeekRef.current(t)
  }, [calcTime])

  const onMouseMove = useCallback((e: React.MouseEvent): void => {
    const el = trackRef.current
    const dur = durationRef.current
    if (!el || dur <= 0) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
    setHoverX(x)
    setHoverTime((x / rect.width) * dur)
  }, [])

  return (
    <div
      className="qp-scrubber-wrap"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onClick={onClickSeek}
      onMouseLeave={() => {
        if (!isDragging.current) {
          setHoverTime(null)
          setHoverX(null)
        }
      }}
    >
      <div ref={trackRef} className="qp-scrubber-track">
        <div className="qp-scrubber-progress" style={{ width: `${pct}%` }}>
          <div className="qp-scrubber-thumb" />
        </div>
      </div>
      {hoverTime !== null && hoverX !== null && (
        <div className="qp-scrubber-tooltip" style={{ left: hoverX }}>
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  )
}

function EqBars({ active }: { active: boolean }): React.JSX.Element {
  return (
    <div className="qp-eq-bars" style={{ opacity: active ? 1 : 0 }}>
      <div className="qp-eq-bar" />
      <div className="qp-eq-bar" />
      <div className="qp-eq-bar" />
      <div className="qp-eq-bar" />
      <div className="qp-eq-bar" />
    </div>
  )
}

function AudioPlayer({ item, src }: { item: Item; src: string }): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(item.duration_ms ? item.duration_ms / 1000 : 0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    void el.play().catch(() => {})
  }, [])

  const togglePlay = useCallback((): void => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [])

  const seekBy = useCallback((delta: number): void => {
    const el = audioRef.current
    if (!el) return
    const next = Math.max(0, Math.min(el.duration || duration, el.currentTime + delta))
    el.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const onSeek = useCallback((time: number): void => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = time
    setCurrentTime(time)
  }, [])

  const toggleMute = useCallback((): void => {
    const el = audioRef.current
    if (!el) return
    el.muted = !muted
    setMuted(!muted)
  }, [muted])

  const onVolumeChange = (newVol: number): void => {
    const el = audioRef.current
    if (!el) return
    el.volume = newVol
    setVolume(newVol)
    if (newVol > 0 && muted) {
      el.muted = false
      setMuted(false)
    }
  }

  const cycleSpeed = (): void => {
    const nextIdx = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(nextIdx)
    const spd = SPEEDS[nextIdx]
    if (audioRef.current) audioRef.current.playbackRate = spd
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        seekBy(-5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        seekBy(5)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        onVolumeChange(Math.min(1, volume + 0.1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        onVolumeChange(Math.max(0, volume - 0.1))
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        e.stopPropagation()
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [togglePlay, seekBy, volume, toggleMute])

  const fileName = baseName(item.name, item.ext)

  return (
    <div className="qp-audio-card" onClick={STOP}>
      <audio
        ref={audioRef}
        src={src}
        autoPlay
        playsInline
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setPlaying(false)}
      />

      {/* Header: artwork + meta */}
      <div className="qp-audio-header">
        <div className={`qp-audio-artwork${playing ? ' qp-audio-artwork--playing' : ''}`}>
          <TypeIcon type="audio" size={28} />
        </div>
        <div className="qp-audio-meta">
          <div className="qp-audio-title" title={fileName}>{fileName}</div>
          <div className="qp-audio-sub">
            <span className="qp-badge">{item.ext || 'audio'}</span>
            <span>{formatTime(duration)}</span>
            <EqBars active={playing} />
          </div>
        </div>
      </div>

      {/* Scrubber + time */}
      <div>
        <Scrubber currentTime={currentTime} duration={duration} onSeek={onSeek} />
        <div className="qp-time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="qp-controls-row">
        {/* Speed */}
        <button
          type="button"
          className="qp-btn qp-btn--text"
          onClick={cycleSpeed}
          title="Playback speed"
        >
          {SPEEDS[speedIdx]}x
        </button>

        {/* Transport */}
        <div className="qp-audio-transport">
          <button
            type="button"
            className="qp-btn qp-btn--secondary"
            onClick={() => seekBy(-10)}
            title="Rewind 10s (←)"
          >
            <SkipBackIcon size={18} />
          </button>
          <button
            type="button"
            className="qp-btn qp-btn--primary"
            onClick={togglePlay}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button
            type="button"
            className="qp-btn qp-btn--secondary"
            onClick={() => seekBy(10)}
            title="Forward 10s (→)"
          >
            <SkipForwardIcon size={18} />
          </button>
        </div>

        {/* Volume */}
        <div className="qp-volume-box">
          <button
            type="button"
            className="qp-btn"
            onClick={toggleMute}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {muted || volume === 0 ? <VolumeMuteIcon size={16} /> : <VolumeIcon size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="qp-volume-slider"
            title="Volume (↑/↓)"
          />
        </div>
      </div>

      {/* Hint bar */}
      <div className="qp-hint-bar">
        <span className="qp-hint-item"><kbd className="qp-hint-kbd">Space</kbd> Play/Pause</span>
        <span className="qp-hint-item"><kbd className="qp-hint-kbd">← →</kbd> ±10s</span>
        <span className="qp-hint-item"><kbd className="qp-hint-kbd">↑ ↓</kbd> Volume</span>
        <span className="qp-hint-item"><kbd className="qp-hint-kbd">M</kbd> Mute</span>
        <span className="qp-hint-item"><kbd className="qp-hint-kbd">Esc</kbd> Close</span>
      </div>
    </div>
  )
}

function VideoPlayer({ item, src }: { item: Item; src: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(item.duration_ms ? item.duration_ms / 1000 : 0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const p = el.play()
    if (p !== undefined) {
      p.catch(() => {
        // Fallback if browser autoplay policy blocks sound
        el.muted = true
        setMuted(true)
        void el.play().catch(() => {})
      })
    }
  }, [])

  const togglePlay = useCallback((): void => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [])

  const seekBy = useCallback((delta: number): void => {
    const el = videoRef.current
    if (!el) return
    const next = Math.max(0, Math.min(el.duration || duration, el.currentTime + delta))
    el.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const onSeek = (time: number): void => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = time
    setCurrentTime(time)
  }

  const toggleMute = useCallback((): void => {
    const el = videoRef.current
    if (!el) return
    el.muted = !muted
    setMuted(!muted)
  }, [muted])

  const onVolumeChange = (newVol: number): void => {
    const el = videoRef.current
    if (!el) return
    el.volume = newVol
    setVolume(newVol)
    if (newVol > 0 && muted) {
      el.muted = false
      setMuted(false)
    }
  }

  const cycleSpeed = (): void => {
    const nextIdx = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(nextIdx)
    const spd = SPEEDS[nextIdx]
    if (videoRef.current) videoRef.current.playbackRate = spd
  }

  const toggleFullscreen = useCallback((): void => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {})
    } else {
      void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFsChange = (): void => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Auto-hide controls after inactivity
  const showControls = (): void => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (playing) {
      hideTimer.current = setTimeout(() => {
        setControlsVisible(false)
      }, 2500)
    }
  }

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    } else {
      showControls()
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        togglePlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        seekBy(-5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        seekBy(5)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        onVolumeChange(Math.min(1, volume + 0.1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        onVolumeChange(Math.max(0, volume - 0.1))
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        e.stopPropagation()
        toggleMute()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        e.stopPropagation()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [togglePlay, seekBy, volume, toggleMute, toggleFullscreen])

  const aspectRatio = item.width && item.height ? `${item.width} / ${item.height}` : '16 / 9'
  const isTall = !!(item.width && item.height && item.height > item.width)

  return (
    <div
      ref={containerRef}
      className="qp-video-container"
      style={{
        aspectRatio,
        width: isTall ? 'min(70vw, calc(76vh * 9 / 16))' : 'min(88vw, calc(76vh * 16 / 9))',
        minWidth: 'min(90vw, 560px)',
        maxWidth: '90vw',
        maxHeight: '78vh'
      }}
      onClick={STOP}
      onMouseMove={showControls}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        className="qp-video-el"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration)
            setCurrentTime(videoRef.current.currentTime)
          }
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* Center play button only when paused */}
      {!playing && (
        <button
          type="button"
          className="qp-video-center-btn"
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          title="Play"
        >
          <PlayIcon size={32} />
        </button>
      )}

      {/* Bottom overlay controls */}
      <div
        className={`qp-video-overlay${!controlsVisible && playing ? ' qp-video-overlay--hidden' : ''}`}
        onClick={STOP}
      >
        <Scrubber currentTime={currentTime} duration={duration} onSeek={onSeek} />

        <div className="qp-controls-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="qp-btn"
              onClick={togglePlay}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
            >
              {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>
            <button
              type="button"
              className="qp-btn"
              onClick={() => seekBy(-5)}
              title="Rewind 5s (←)"
            >
              <SkipBackIcon size={18} />
            </button>
            <button
              type="button"
              className="qp-btn"
              onClick={() => seekBy(5)}
              title="Forward 5s (→)"
            >
              <SkipForwardIcon size={18} />
            </button>
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.85)', marginLeft: 6, whiteSpace: 'nowrap' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="qp-btn qp-btn--text"
              onClick={cycleSpeed}
              title="Playback speed"
            >
              {SPEEDS[speedIdx]}x
            </button>

            <div className="qp-volume-box">
              <button
                type="button"
                className="qp-btn"
                onClick={toggleMute}
                title={muted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {muted || volume === 0 ? <VolumeMuteIcon size={18} /> : <VolumeIcon size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="qp-volume-slider"
                title="Volume (↑/↓)"
              />
            </div>

            <button
              type="button"
              className="qp-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <ExitFullscreenIcon size={18} /> : <FullscreenIcon size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Content({ item, src }: { item: Item; src: string }): React.JSX.Element {
  if (item.type === 'image') {
    return (
      <div onClick={STOP} style={{ textAlign: 'center' }}>
        <img src={src} style={FIT_STYLE} />
        <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          {baseName(item.name, item.ext)}
        </div>
      </div>
    )
  }
  if (item.type === 'video') {
    return (
      <div onClick={STOP} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <VideoPlayer item={item} src={src} />
        <div className="qp-video-title">{baseName(item.name, item.ext)}</div>
        <div className="qp-video-hint">
          <span className="qp-hint-item"><kbd className="qp-hint-kbd">Space</kbd> Play/Pause</span>
          <span className="qp-hint-item"><kbd className="qp-hint-kbd">← →</kbd> ±5s</span>
          <span className="qp-hint-item"><kbd className="qp-hint-kbd">M</kbd> Mute</span>
          <span className="qp-hint-item"><kbd className="qp-hint-kbd">F</kbd> Fullscreen</span>
          <span className="qp-hint-item"><kbd className="qp-hint-kbd">Esc</kbd> Close</span>
        </div>
      </div>
    )
  }
  if (item.type === 'audio') {
    return <AudioPlayer item={item} src={src} />
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
