import { useRef, useState, useEffect } from 'react'
import { useSpotifyContext } from '../hooks/SpotifyContext'

function formatMs(ms) {
  if (!ms) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Clean SVG icons — no emoji
function IcoPrev()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg> }
function IcoNext()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6z"/></svg> }
function IcoPlay()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> }
function IcoPause() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> }
function IcoVol()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> }

function SpotifyLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1DB954"/>
      <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.75.5-1.1.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.25 1zm-1.2 2.75c-.2.3-.6.4-.9.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.55.3.85z" fill="white"/>
    </svg>
  )
}

export default function SpotifyBar() {
  const sp = useSpotifyContext()
  const [volume, setVol] = useState(80)
  const progressRef = useRef(null)
  const [localElapsed, setLocalElapsed] = useState(0)
  const animRef = useRef(null)

  // Smooth progress animation — resets on each new progressMs or isPlaying change
  useEffect(() => {
    clearInterval(animRef.current)
    setLocalElapsed(0)
    if (sp.nowPlaying?.isPlaying) {
      animRef.current = setInterval(() => setLocalElapsed(e => e + 1000), 1000)
    }
    return () => clearInterval(animRef.current)
  }, [sp.nowPlaying?.progressMs, sp.nowPlaying?.isPlaying])

  // Sync volume from Spotify device state
  useEffect(() => {
    if (sp.nowPlaying?.volume != null) setVol(sp.nowPlaying.volume)
  }, [sp.nowPlaying?.volume])

  if (!sp.hasClientId) return null

  if (!sp.isConnected) {
    return (
      <div className="sp-bar sp-bar--connect">
        <SpotifyLogo size={20} />
        <button className="sp-connect-btn" onClick={sp.signIn}>Connect Spotify</button>
      </div>
    )
  }

  if (!sp.nowPlaying) {
    return (
      <div className="sp-bar sp-bar--idle">
        <SpotifyLogo size={18} />
        <span className="sp-idle-text">Nothing playing</span>
        <button className="sp-icon-btn sp-disconnect" onClick={sp.disconnect} aria-label="Disconnect Spotify" title="Disconnect">✕</button>
      </div>
    )
  }

  const { track, artist, albumArt, durationMs, progressMs, isPlaying, deviceName } = sp.nowPlaying

  const displayProgress = sp.nowPlaying
    ? Math.min((progressMs || 0) + localElapsed, durationMs || 0)
    : 0
  const pct = durationMs ? Math.min(100, (displayProgress / durationMs) * 100) : 0

  function handleProgressClick(e) {
    if (!progressRef.current || !durationMs) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    sp.seek(Math.floor(ratio * durationMs))
  }

  function handleVolumeChange(e) {
    const v = Number(e.target.value)
    setVol(v)
    sp.setVolume(v)
  }

  return (
    <div className="sp-bar sp-bar--playing">
      {/* Blurred art background */}
      {albumArt && (
        <img src={albumArt} aria-hidden="true" className="sp-bar__blur-bg" alt="" />
      )}
      <div className="sp-bar__overlay" />

      {/* Album art */}
      <div className="sp-art-wrap">
        {albumArt
          ? <img src={albumArt} alt="" className="sp-art" />
          : <div className="sp-art sp-art--fallback"><SpotifyLogo size={22} /></div>
        }
      </div>

      {/* Track info */}
      <div className="sp-info">
        <span className="sp-track-name">{track}</span>
        <span className="sp-artist">{artist}</span>
      </div>

      {/* Center: controls + progress */}
      <div className="sp-center">
        <div className="sp-controls">
          <button
            className={`sp-icon-btn sp-icon-btn--sm${sp.nowPlaying?.shuffleOn ? ' sp-icon-btn--active' : ''}`}
            onClick={sp.toggleShuffle}
            aria-label={sp.nowPlaying?.shuffleOn ? 'Shuffle on' : 'Shuffle off'}
            title="Shuffle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>
          <button className="sp-icon-btn" onClick={sp.previous} aria-label="Previous"><IcoPrev /></button>
          <button className="sp-icon-btn sp-icon-btn--play" onClick={isPlaying ? sp.pause : sp.play} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <IcoPause /> : <IcoPlay />}
          </button>
          <button className="sp-icon-btn" onClick={sp.next} aria-label="Next"><IcoNext /></button>
        </div>
        <div className="sp-progress-row">
          <span className="sp-time">{formatMs(displayProgress)}</span>
          <div
            className="sp-progress"
            ref={progressRef}
            onClick={handleProgressClick}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${formatMs(displayProgress)} of ${formatMs(durationMs)}`}
          >
            <div className="sp-progress__fill" style={{ width: `${pct}%` }}>
              <div className="sp-progress__thumb" />
            </div>
          </div>
          <span className="sp-time sp-time--right">{formatMs(durationMs)}</span>
        </div>
      </div>

      {/* Right: volume + device + disconnect */}
      <div className="sp-right">
        {/* Web playback device indicator */}
        {sp.needsReauth ? (
          <button
            className="sp-here-badge sp-here-badge--btn sp-here-badge--warn"
            onClick={sp.disconnect}
            title="Reconnect to enable browser playback"
          >
            Reconnect for browser play
          </button>
        ) : sp.webPlayerReady ? (
          sp.nowPlaying?.isThisDevice
            ? <span className="sp-here-badge sp-here-badge--active" title="Playing on this device">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6h18v2H4zm2 5h14v2H6zm4 5h6v2h-6z"/></svg>
                This device
              </span>
            : <button className="sp-here-badge sp-here-badge--btn" onClick={sp.transferHere} title="Transfer playback to this device">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 6h18v2H4zm2 5h14v2H6zm4 5h6v2h-6z"/></svg>
                Play here
              </button>
        ) : null}
        <IcoVol />
        <input type="range" className="sp-volume" min={0} max={100} step={1} value={volume} onChange={handleVolumeChange} aria-label="Volume" />
        {deviceName && <span className="sp-device">{deviceName}</span>}
        <button className="sp-icon-btn sp-disconnect" onClick={sp.disconnect} aria-label="Disconnect Spotify" title="Disconnect">✕</button>
      </div>
    </div>
  )
}
