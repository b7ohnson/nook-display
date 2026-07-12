import { useState, useEffect, useRef, useCallback } from 'react'

const CLIENT_ID   = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = window.location.origin + '/'
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-recently-played',
  'streaming',
].join(' ')
const TOKEN_KEY    = 'sp_token'
const REFRESH_KEY  = 'sp_refresh'
const EXPIRY_KEY   = 'sp_expiry'

// PKCE helpers
async function sha256(plain) {
  const data = new TextEncoder().encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}
function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function randomVerifier() {
  const arr = new Uint8Array(64)
  crypto.getRandomValues(arr)
  return base64url(arr.buffer)
}

export function useSpotify() {
  const [token, setToken]       = useState(() => localStorage.getItem(TOKEN_KEY) || null)
  const [nowPlaying, setNow]    = useState(null) // { track, artist, album, albumArt, durationMs, progressMs, isPlaying, volume, shuffleOn }
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const pollRef                 = useRef(null)
  const tokenRef                = useRef(token)
  const playerRef               = useRef(null)
  const webDeviceIdRef          = useRef(null)
  const nowPlayingRef           = useRef(null)
  const [webDeviceId, setWebDeviceId] = useState(null)
  const [webPlayerReady, setWebReady] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)
  const sdkInitializedRef = useRef(false)

  useEffect(() => { tokenRef.current = token }, [token])
  useEffect(() => { nowPlayingRef.current = nowPlaying }, [nowPlaying])

  // ── Handle OAuth redirect callback ─────────────────────────
  useEffect(() => {
    if (!CLIENT_ID) return
    const params  = new URLSearchParams(window.location.search)
    const code    = params.get('code')
    const state   = params.get('state')
    if (!code || state !== 'sp') return

    // Remove code from URL without reload
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)

    const verifier = sessionStorage.getItem('sp_verifier')
    if (!verifier) return

    setLoading(true)
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        code_verifier: verifier,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.access_token) throw new Error(data.error_description || 'Auth failed')
        saveTokens(data)
        setToken(data.access_token)
        setLoading(false)
        sessionStorage.removeItem('sp_verifier')
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // ── Poll now playing ─────────────────────────────────────────
  useEffect(() => {
    if (!token) { setNow(null); return }
    fetchNowPlaying(token)
    pollRef.current = setInterval(() => fetchNowPlaying(tokenRef.current), 5000)
    return () => clearInterval(pollRef.current)
  }, [token])

  async function fetchNowPlaying(tok) {
    if (!tok) return
    // Refresh token if within 60 s of expiry
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0')
    if (Date.now() > expiry - 60_000) {
      const refreshed = await doRefresh()
      if (!refreshed) return
      tok = tokenRef.current
    }
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player?additional_types=track', {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (res.status === 204) { setNow(null); return }
      if (res.status === 401) { disconnect(); return }
      if (!res.ok) return
      const data = await res.json()
      const item = data.item
      if (!item) { setNow(null); return }
      setNow({
        track:      item.name,
        artist:     item.artists?.map(a => a.name).join(', ') || '',
        album:      item.album?.name || '',
        albumArt:   item.album?.images?.[2]?.url || item.album?.images?.[0]?.url || null,
        durationMs: item.duration_ms,
        progressMs: data.progress_ms,
        isPlaying:  data.is_playing,
        deviceName: data.device?.name || '',
        isThisDevice: data.device?.id === webDeviceIdRef.current,
        volume:     data.device?.volume_percent ?? null,
        shuffleOn:  data.shuffle_state ?? false,
      })
      setError(null)
    } catch (e) {
      // Network errors are silent — keep last known state
    }
  }

  async function doRefresh() {
    const refresh = localStorage.getItem(REFRESH_KEY)
    if (!refresh) { disconnect(); return false }
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: refresh,
          client_id:     CLIENT_ID,
        }),
      })
      const data = await res.json()
      if (!data.access_token) { disconnect(); return false }
      saveTokens(data)
      setToken(data.access_token)
      return true
    } catch {
      return false
    }
  }

  // ── Spotify Web Playback SDK ──────────────────────────────────
  useEffect(() => {
    if (!token || sdkInitializedRef.current) return
    sdkInitializedRef.current = true

    function initPlayer() {
      const player = new window.Spotify.Player({
        name: 'NooK Display',
        getOAuthToken: cb => cb(tokenRef.current),
        volume: 0.8,
      })

      player.addListener('ready', async ({ device_id }) => {
        setWebDeviceId(device_id)
        webDeviceIdRef.current = device_id
        setWebReady(true)
        // If nothing is actively playing elsewhere, make this the active device silently
        // (don't auto-play, just register it as the target device)
        const state = await apiFetch('/me/player')
        if (!state || !state.is_playing) {
          await apiFetch('/me/player', 'PUT', { device_ids: [device_id], play: false })
        }
      })

      player.addListener('not_ready', () => {
        setWebReady(false)
      })

      player.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify SDK] initialization_error:', message)
        setWebReady(false)
      })

      player.addListener('authentication_error', ({ message }) => {
        console.error('[Spotify SDK] authentication_error:', message)
        // Token missing streaming scope — signal re-auth with full scopes
        setWebReady(false)
        setNeedsReauth(true)
      })

      player.addListener('account_error', ({ message }) => {
        console.error('[Spotify SDK] account_error:', message)
        // Not Premium — graceful degradation
        setWebReady(false)
      })

      player.addListener('playback_error', ({ message }) => {
        console.error('[Spotify SDK] playback_error:', message)
      })

      player.addListener('player_state_changed', state => {
        if (!state) return
        const track = state.track_window?.current_track
        if (!track) return
        setNow({
          track:      track.name,
          artist:     track.artists?.map(a => a.name).join(', ') || '',
          album:      track.album?.name || '',
          albumArt:   track.album?.images?.[track.album.images.length - 1]?.url || track.album?.images?.[0]?.url || null,
          durationMs: state.duration,
          progressMs: state.position,
          isPlaying:  !state.paused,
          deviceName: 'NooK Display',
          isThisDevice: true,
        })
      })

      player.connect()
      playerRef.current = player
    }

    // Load SDK script if not already loaded
    if (window.Spotify?.Player) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.body.appendChild(script)
      }
      // If script tag exists but SDK not yet ready, the callback will fire when it loads
    }
    // No cleanup here — player stays connected through token refreshes.
    // Explicit disconnect() handles all teardown.
  }, [token])

  async function transferHere() {
    if (!webDeviceIdRef.current) return
    await apiFetch('/me/player', 'PUT', { device_ids: [webDeviceIdRef.current], play: true })
  }

  function saveTokens(data) {
    localStorage.setItem(TOKEN_KEY, data.access_token)
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + data.expires_in * 1000))
  }

  async function signIn() {
    if (!CLIENT_ID) return
    const verifier  = randomVerifier()
    const challenge = base64url(await sha256(verifier))
    sessionStorage.setItem('sp_verifier', verifier)
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      client_id:             CLIENT_ID,
      response_type:         'code',
      redirect_uri:          REDIRECT_URI,
      scope:                 SCOPES,
      state:                 'sp',
      code_challenge_method: 'S256',
      code_challenge:        challenge,
      show_dialog:           'true',
    })
    window.location.href = url
  }

  const disconnect = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect()
      playerRef.current = null
    }
    sdkInitializedRef.current = false
    setWebReady(false)
    setWebDeviceId(null)
    webDeviceIdRef.current = null
    setNeedsReauth(false)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXPIRY_KEY)
    setToken(null)
    setNow(null)
  }, [])

  async function control(action, restEndpoint, restMethod = 'POST') {
    // When SDK player is active on this device, use SDK methods directly
    // (more reliable than REST — no round-trip, no "no active device" errors)
    if (playerRef.current && webDeviceIdRef.current) {
      switch (action) {
        case 'play':     await playerRef.current.resume();        break
        case 'pause':    await playerRef.current.pause();         break
        case 'next':     await playerRef.current.nextTrack();     break
        case 'previous': await playerRef.current.previousTrack(); break
        default: {
          // seek/volume still need REST; restEndpoint may already have '?'
          const sep = restEndpoint.includes('?') ? '&' : '?'
          await apiFetch(`/me/player/${restEndpoint}${sep}device_id=${webDeviceIdRef.current}`, restMethod)
        }
      }
      setTimeout(() => fetchNowPlaying(tokenRef.current), 300)
      return
    }
    // Fallback: REST API for external devices
    const tok = tokenRef.current
    if (!tok) return
    await fetch(`https://api.spotify.com/v1/me/player/${restEndpoint}`, {
      method: restMethod,
      headers: { Authorization: `Bearer ${tok}` },
    })
    setTimeout(() => fetchNowPlaying(tokenRef.current), 300)
  }

  const play      = () => control('play', 'play', 'PUT')
  const pause     = () => control('pause', 'pause', 'PUT')
  const next      = () => control('next', 'next', 'POST')
  const previous  = () => control('previous', 'previous', 'POST')
  const seek      = (ms) => control('seek', `seek?position_ms=${ms}`, 'PUT')
  const setVolume = (pct) => control('volume', `volume?volume_percent=${pct}`, 'PUT')

  // ── Generic API fetch helper ─────────────────────────────────
  async function apiFetch(path, method = 'GET', body = undefined) {
    const tok = tokenRef.current
    if (!tok) return null
    try {
      const res = await fetch(`https://api.spotify.com/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${tok}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (res.status === 204) return null
      if (res.status === 401) { disconnect(); return null }
      if (!res.ok) {
        const errText = await res.text()
        console.error(`[Spotify API] ${method} ${path} → ${res.status}:`, errText)
        return null
      }
      const text = await res.text()
      return text ? JSON.parse(text) : null
    } catch (e) {
      console.error(`[Spotify API] ${method} ${path} fetch error:`, e)
      return null
    }
  }

  // ── Search tracks ────────────────────────────────────────────
  async function search(query) {
    if (!query.trim()) return []
    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=30`)
    return (data?.tracks?.items || []).map(t => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      artist: t.artists?.map(a => a.name).join(', ') || '',
      album: t.album?.name || '',
      albumArt: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
      durationMs: t.duration_ms,
    }))
  }

  // ── User's playlists ─────────────────────────────────────────
  async function fetchPlaylists() {
    const data = await apiFetch('/me/playlists?limit=50')
    console.log('[NooK] playlists raw count:', data?.items?.length)
    return (data?.items || []).map(p => ({
      id: p.id,
      uri: p.uri,
      name: p.name,
      art: p.images?.[0]?.url || null,
      trackCount: p.tracks?.total || 0,
      owner: p.owner?.display_name || '',
    }))
  }

  // ── Tracks in a playlist ─────────────────────────────────────
  async function fetchPlaylistTracks(playlistId) {
    const data = await apiFetch(`/playlists/${playlistId}/tracks?limit=50`)
    console.log('[NooK] playlist tracks raw:', data ? `items=${data.items?.length}` : 'null/error')
    if (!data?.items) return []

    const items = data.items.filter(i => i?.track?.id)
    console.log('[NooK] items with track.id:', items.length)

    return items.map(i => ({
      id: i.track.id,
      uri: i.track.uri,
      name: i.track.name,
      artist: i.track.artists?.map(a => a.name).join(', ') || '',
      album: i.track.album?.name || '',
      albumArt: i.track.album?.images?.[2]?.url || i.track.album?.images?.[0]?.url || null,
      durationMs: i.track.duration_ms,
    }))
  }

  // ── Recently played ──────────────────────────────────────────
  async function fetchRecentlyPlayed() {
    const data = await apiFetch('/me/player/recently-played?limit=50')
    const seen = new Set()
    return (data?.items || [])
      .filter(i => {
        if (seen.has(i.track?.id)) return false
        seen.add(i.track?.id)
        return !!i.track?.id
      })
      .map(i => ({
        id: i.track.id,
        uri: i.track.uri,
        name: i.track.name,
        artist: i.track.artists?.map(a => a.name).join(', ') || '',
        albumArt: i.track.album?.images?.[2]?.url || null,
      }))
  }

  // ── Play a URI (track or context) ────────────────────────────
  async function playUri(uri) {
    const isContext = uri.startsWith('spotify:playlist:') || uri.startsWith('spotify:album:')
    const body = isContext ? { context_uri: uri } : { uris: [uri] }
    // device_id goes as a QUERY PARAM on the play endpoint, not in the body
    const deviceParam = webDeviceIdRef.current ? `?device_id=${webDeviceIdRef.current}` : ''
    await apiFetch(`/me/player/play${deviceParam}`, 'PUT', body)
    setTimeout(() => fetchNowPlaying(tokenRef.current), 400)
  }

  async function toggleShuffle() {
    const currentShuffle = nowPlayingRef.current?.shuffleOn ?? false
    const deviceParam = webDeviceIdRef.current ? `&device_id=${webDeviceIdRef.current}` : ''
    await apiFetch(`/me/player/shuffle?state=${!currentShuffle}${deviceParam}`, 'PUT')
    setTimeout(() => fetchNowPlaying(tokenRef.current), 300)
  }

  async function addToQueue(uri) {
    const deviceParam = webDeviceIdRef.current ? `&device_id=${webDeviceIdRef.current}` : ''
    await apiFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}${deviceParam}`, 'POST')
  }

  return {
    isConnected: !!token,
    nowPlaying,
    loading,
    error,
    signIn,
    disconnect,
    play,
    pause,
    next,
    previous,
    seek,
    setVolume,
    hasClientId: !!CLIENT_ID,
    search,
    fetchPlaylists,
    fetchPlaylistTracks,
    fetchRecentlyPlayed,
    playUri,
    toggleShuffle,
    addToQueue,
    webPlayerReady,
    webDeviceId,
    transferHere,
    needsReauth,
  }
}
