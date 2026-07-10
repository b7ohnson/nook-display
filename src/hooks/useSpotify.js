import { useState, useEffect, useRef, useCallback } from 'react'

const CLIENT_ID   = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = window.location.origin + '/'
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
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
  const [nowPlaying, setNow]    = useState(null) // { track, artist, album, albumArt, durationMs, progressMs, isPlaying }
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const pollRef                 = useRef(null)
  const tokenRef                = useRef(token)

  useEffect(() => { tokenRef.current = token }, [token])

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
    })
    window.location.href = url
  }

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXPIRY_KEY)
    setToken(null)
    setNow(null)
  }, [])

  async function control(endpoint, method = 'POST') {
    const tok = tokenRef.current
    if (!tok) return
    await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${tok}` },
    })
    setTimeout(() => fetchNowPlaying(tokenRef.current), 300)
  }

  const play      = () => control('play', 'PUT')
  const pause     = () => control('pause', 'PUT')
  const next      = () => control('next', 'POST')
  const previous  = () => control('previous', 'POST')
  const seek      = (ms) => control(`seek?position_ms=${ms}`, 'PUT')
  const setVolume = (pct) => control(`volume?volume_percent=${pct}`, 'PUT')

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
  }
}
