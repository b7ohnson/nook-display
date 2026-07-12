import { useState, useEffect, useRef } from 'react'
import { useSpotifyContext } from '../hooks/SpotifyContext'

function formatMs(ms) {
  if (!ms) return ''
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function IcoPlay() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> }
function IcoBack() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg> }

function TrackRow({ track, onPlay, onQueue, isPlaying }) {
  return (
    <div className={`sp-track-row${isPlaying ? ' sp-track-row--active' : ''}`}>
      <button className="sp-track-play" onClick={() => onPlay(track.uri)} aria-label={`Play ${track.name}`}>
        <IcoPlay />
      </button>
      {track.albumArt && <img src={track.albumArt} alt="" className="sp-track-art" />}
      <div className="sp-track-meta">
        <span className="sp-track-title">{track.name}</span>
        <span className="sp-track-sub">{track.artist}</span>
      </div>
      <span className="sp-track-dur">{formatMs(track.durationMs)}</span>
      {onQueue && (
        <button className="sp-track-queue" onClick={() => onQueue(track.uri)} aria-label={`Add ${track.name} to queue`} title="Add to queue">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm13 0v3l4-4-4-4v3h-3v2h3z"/></svg>
        </button>
      )}
    </div>
  )
}

function PlaylistCard({ pl, onClick }) {
  return (
    <button className="sp-pl-card" onClick={() => onClick(pl)} aria-label={`Open playlist ${pl.name}`}>
      {pl.art
        ? <img src={pl.art} alt="" className="sp-pl-art" />
        : <div className="sp-pl-art sp-pl-art--fallback">&#9835;</div>
      }
      <span className="sp-pl-name">{pl.name}</span>
      <span className="sp-pl-count">{pl.trackCount} tracks</span>
    </button>
  )
}

export default function SpotifyPage() {
  const sp = useSpotifyContext()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [playlists, setPlaylists]   = useState([])
  const [recent, setRecent]         = useState([])
  const [openPl, setOpenPl]         = useState(null)     // { id, name, art }
  const [plTracks, setPlTracks]     = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [searching, setSearching]   = useState(false)
  const debounceRef                 = useRef(null)

  // Load playlists + recently played on mount
  useEffect(() => {
    if (!sp.isConnected) return
    sp.fetchPlaylists().then(setPlaylists)
    sp.fetchRecentlyPlayed().then(setRecent)
  }, [sp.isConnected])

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const r = await sp.search(query)
      setResults(r)
      setSearching(false)
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Open playlist
  async function openPlaylist(pl) {
    setOpenPl(pl)
    setPlTracks([])
    setLoadingTracks(true)
    const tracks = await sp.fetchPlaylistTracks(pl.id).catch(() => [])
    setPlTracks(tracks)
    setLoadingTracks(false)
  }

  if (!sp.isConnected) {
    return (
      <div className="sp-page sp-page--empty">
        <p>Connect Spotify from the bar below to browse your music.</p>
      </div>
    )
  }

  const nowUri = sp.nowPlaying ? (sp.nowPlaying.uri || null) : null
  const isSearching = !!query.trim()

  return (
    <div className="sp-page">
      {/* Search bar */}
      <div className="sp-search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sp-search-icon" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="sp-search-input"
          placeholder="Search songs, artists…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && <button className="sp-search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
      </div>

      {sp.webPlayerReady && (
        <div className="sp-browser-active">
          <span className="sp-browser-dot" />
          NooK Display is ready — click any track to play
        </div>
      )}

      <div className="sp-page-body">
        {/* Left: search results OR playlist tracks */}
        <div className="sp-left-col">
          {openPl && !isSearching ? (
            <>
              <div className="sp-col-header">
                <button className="sp-back-btn" onClick={() => { setOpenPl(null); setPlTracks([]) }}>
                  <IcoBack /> Back
                </button>
                <div className="sp-col-title-wrap">
                  {openPl.art && <img src={openPl.art} alt="" className="sp-col-art" />}
                  <span className="sp-col-title">{openPl.name}</span>
                </div>
                <button className="sp-play-all-btn" onClick={() => sp.playUri(openPl.uri)}>&#9654; Play all</button>
              </div>
              <div className="sp-track-list">
                {loadingTracks && <p className="sp-loading">Loading tracks…</p>}
                {!loadingTracks && plTracks.length === 0 && <p className="sp-empty">No playable tracks</p>}
                {!loadingTracks && plTracks.map(t => (
                  <TrackRow key={t.id} track={t} onPlay={sp.playUri} onQueue={sp.addToQueue} isPlaying={nowUri === t.uri} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="sp-col-header">
                <span className="sp-col-title">
                  {isSearching ? (searching ? 'Searching…' : `Results for "${query}"`) : 'Recently Played'}
                </span>
              </div>
              <div className="sp-track-list">
                {isSearching
                  ? results.map(t => <TrackRow key={t.id} track={t} onPlay={sp.playUri} onQueue={sp.addToQueue} isPlaying={nowUri === t.uri} />)
                  : recent.map(t => <TrackRow key={t.id} track={t} onPlay={sp.playUri} onQueue={sp.addToQueue} isPlaying={nowUri === t.uri} />)
                }
                {isSearching && !searching && results.length === 0 && (
                  <p className="sp-empty">No results found</p>
                )}
                {!isSearching && recent.length === 0 && (
                  <p className="sp-empty">Nothing recently played</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="sp-page-divider" />

        {/* Right: playlists grid */}
        <div className="sp-right-col">
          <div className="sp-col-header">
            <span className="sp-col-title">Your Playlists</span>
          </div>
          <div className="sp-pl-grid">
            {playlists.length === 0 && <p className="sp-loading">Loading playlists…</p>}
            {playlists.map(pl => <PlaylistCard key={pl.id} pl={pl} onClick={openPlaylist} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
