import { useRef, useState } from 'react'
import { useSpotify } from '../hooks/useSpotify'

function formatMs(ms) {
  if (!ms) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function SpotifyBar() {
  const sp = useSpotify()
  const [volume, setVol] = useState(80)
  const progressRef = useRef(null)

  if (!sp.hasClientId) return null

  // Not connected
  if (!sp.isConnected) {
    return (
      <div className="sp-bar sp-bar--disconnected">
        <button className="sp-connect-btn" onClick={sp.signIn}>
          <SpotifyLogo />
          Connect Spotify
        </button>
      </div>
    )
  }

  // Connected but nothing playing
  if (!sp.nowPlaying) {
    return (
      <div className="sp-bar sp-bar--idle">
        <span className="sp-idle-text">
          <SpotifyLogo />
          Nothing playing
        </span>
        <button className="sp-disconnect" onClick={sp.disconnect} title="Disconnect Spotify">✕</button>
      </div>
    )
  }

  const { track, artist, albumArt, durationMs, progressMs, isPlaying, deviceName } = sp.nowPlaying
  const pct = durationMs ? Math.min(100, (progressMs / durationMs) * 100) : 0

  function handleProgressClick(e) {
    if (!progressRef.current || !durationMs) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    sp.seek(Math.floor(ratio * durationMs))
  }

  function handleVolumeChange(e) {
    const v = Number(e.target.value)
    setVol(v)
    sp.setVolume(v)
  }

  return (
    <div className="sp-bar">
      {/* Album art + track info */}
      <div className="sp-track">
        {albumArt
          ? <img src={albumArt} alt="" className="sp-art" />
          : <div className="sp-art sp-art--placeholder"><SpotifyLogo size={18} /></div>
        }
        <div className="sp-info">
          <span className="sp-track-name">{track}</span>
          <span className="sp-artist">{artist}</span>
        </div>
      </div>

      {/* Controls + progress */}
      <div className="sp-center">
        <div className="sp-controls">
          <button className="sp-ctrl" onClick={sp.previous} aria-label="Previous track">⏮</button>
          <button className="sp-ctrl sp-ctrl--play" onClick={isPlaying ? sp.pause : sp.play} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="sp-ctrl" onClick={sp.next} aria-label="Next track">⏭</button>
        </div>
        <div className="sp-progress-row">
          <span className="sp-time">{formatMs(progressMs)}</span>
          <div className="sp-progress" ref={progressRef} onClick={handleProgressClick} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="sp-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="sp-time">{formatMs(durationMs)}</span>
        </div>
      </div>

      {/* Volume + device + disconnect */}
      <div className="sp-right">
        {deviceName && <span className="sp-device" title={`Playing on ${deviceName}`}>🔊 {deviceName}</span>}
        <input
          type="range"
          className="sp-volume"
          min={0} max={100} step={1}
          value={volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
        />
        <button className="sp-disconnect" onClick={sp.disconnect} title="Disconnect Spotify">✕</button>
      </div>
    </div>
  )
}

function SpotifyLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1DB954"/>
      <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.75.5-1.1.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.25 1zm-1.2 2.75c-.2.3-.6.4-.9.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.55.3.85z" fill="white"/>
    </svg>
  )
}
