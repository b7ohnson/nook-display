import { useState, useEffect, useCallback, useRef } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email profile'

const GCAL = 'https://www.googleapis.com/calendar/v3'

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function toGoogleBody({ title, date, startTime, endTime, allDay }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (allDay) {
    return { summary: title, start: { date }, end: { date: nextDay(date) } }
  }
  return {
    summary: title,
    start: { dateTime: `${date}T${startTime}:00`, timeZone: tz },
    end:   { dateTime: `${date}T${endTime || startTime}:00`, timeZone: tz },
  }
}

// Parse compound ID: "storageKey::calendarId::eventId"
export function parseEventId(compoundId = '') {
  const idx1 = compoundId.indexOf('::')
  const idx2 = compoundId.indexOf('::', idx1 + 2)
  return {
    storageKey: compoundId.slice(0, idx1),
    calendarId: compoundId.slice(idx1 + 2, idx2),
    eventId:    compoundId.slice(idx2 + 2),
  }
}

export function useGoogleCalendar(clientId, storageKey = 'default') {
  const tokenKey = `gcal_token_${storageKey}`
  const userKey  = `gcal_user_${storageKey}`
  const connKey  = `gcal_connected_${storageKey}`

  const [token, setToken]           = useState(() => sessionStorage.getItem(tokenKey))
  const [user, setUser]             = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(userKey) || 'null') } catch { return null }
  })
  const [events, setEvents]         = useState(null)
  const [calendarList, setCalList]  = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const clientRef                   = useRef(null)
  const silentRef                   = useRef(null)

  const onToken = useCallback((accessToken) => {
    sessionStorage.setItem(tokenKey, accessToken)
    localStorage.setItem(connKey, '1')
    setToken(accessToken)
  }, [tokenKey, connKey])

  const buildTokenClient = useCallback(() => {
    if (!window.google?.accounts?.oauth2 || !clientId) return
    // Interactive sign-in (shows account picker + consent for all scopes)
    clientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: 'consent',
      callback: (resp) => {
        if (resp.error) { setError(resp.error_description || resp.error); return }
        onToken(resp.access_token)
      },
    })
    // Silent refresh (no popup — reuses existing Google session)
    silentRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: '',
      callback: (resp) => {
        if (!resp.error) onToken(resp.access_token)
      },
    })
  }, [clientId, onToken])

  const trySilentRefresh = useCallback(() => {
    if (!localStorage.getItem(connKey)) return
    if (silentRef.current) {
      silentRef.current.requestAccessToken()
    }
  }, [connKey])

  useEffect(() => {
    const init = () => {
      buildTokenClient()
      // Auto-reconnect on load if was previously connected
      if (!sessionStorage.getItem(tokenKey) && localStorage.getItem(connKey)) {
        setTimeout(() => silentRef.current?.requestAccessToken(), 500)
      }
    }
    if (window.google?.accounts?.oauth2) { init(); return }
    const el = document.getElementById('gsi-script')
    if (!el) return
    el.addEventListener('load', init)
    return () => el.removeEventListener('load', init)
  }, [buildTokenClient, tokenKey, connKey])

  const signIn = useCallback(() => {
    if (!clientRef.current) buildTokenClient()
    clientRef.current?.requestAccessToken()
  }, [buildTokenClient])

  const signOut = useCallback(() => {
    if (token) window.google?.accounts.oauth2.revoke(token, () => {})
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(userKey)
    localStorage.removeItem(connKey)
    setToken(null); setUser(null); setEvents(null); setError(null); setCalList([])
  }, [token, tokenKey, connKey, userKey])

  const forceReauth = useCallback(() => {
    sessionStorage.removeItem(tokenKey)
    localStorage.removeItem(connKey)
    setToken(null)
    setError('Calendar permission needed — click Connect to re-authorize.')
  }, [tokenKey, connKey])

  // ── Fetch helpers ──────────────────────────────
  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
    }).then(async r => {
      if (r.status === 401) { trySilentRefresh(); throw new Error('session_expired') }
      if (r.status === 403) {
        const body = await r.json().catch(() => ({}))
        if (body?.error?.status === 'PERMISSION_DENIED' || body?.error?.errors?.[0]?.reason === 'insufficientPermissions') {
          forceReauth(); throw new Error('insufficient_scopes')
        }
      }
      if (r.status === 204) return null
      return r.json()
    })
  }, [token, trySilentRefresh, forceReauth])

  const fetchAll = useCallback(async (accessToken) => {
    setLoading(true); setError(null)

    const get = (url) =>
      fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(async r => {
          if (r.status === 401) { trySilentRefresh(); throw new Error('session_expired') }
          if (r.status === 403) {
            const body = await r.json().catch(() => ({}))
            if (body?.error?.status === 'PERMISSION_DENIED' || body?.error?.errors?.[0]?.reason === 'insufficientPermissions') {
              forceReauth(); throw new Error('insufficient_scopes')
            }
          }
          return r.json()
        })

    try {
      const uInfo = await get('https://www.googleapis.com/oauth2/v3/userinfo')
      if (uInfo.email) {
        const u = { name: uInfo.given_name || uInfo.name, picture: uInfo.picture }
        sessionStorage.setItem(userKey, JSON.stringify(u))
        setUser(u)
      }

      const calData = await get(`${GCAL}/users/me/calendarList?maxResults=50`)
      if (calData.error) throw new Error(calData.error.message)
      const cals = calData.items || []
      setCalList(cals.map(c => ({ id: c.id, summary: c.summary, primary: !!c.primary, color: c.backgroundColor })))

      const now   = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const end   = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

      const batches = await Promise.all(
        cals.map(cal =>
          get(
            `${GCAL}/calendars/${encodeURIComponent(cal.id)}/events` +
            `?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}` +
            `&singleEvents=true&orderBy=startTime&maxResults=250`
          ).then(d => {
            if (d.error) return []
            return (d.items || [])
              .filter(e => e.status !== 'cancelled' && (e.start?.date || e.start?.dateTime))
              .map(e => {
                const dt        = new Date(e.start.dateTime || e.start.date + 'T00:00:00')
                const localDate = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
                const localTime = e.start.dateTime ? `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : null
                const endDt     = e.end?.dateTime ? new Date(e.end.dateTime) : null
                const endTime   = endDt ? `${String(endDt.getHours()).padStart(2,'0')}:${String(endDt.getMinutes()).padStart(2,'0')}` : null
                return {
                  id: `${storageKey}::${cal.id}::${e.id}`,
                  title: e.summary || '(No title)',
                  date: localDate, time: localTime, endTime,
                  allDay: !!e.start.date,
                  label: cal.summary,
                  color: cal.backgroundColor || '#4A90D9',
                }
              })
          }).catch(() => [])
        )
      )
      setEvents(batches.flat())
    } catch (err) {
      if (err.message !== 'session_expired' && err.message !== 'insufficient_scopes') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [storageKey, userKey, trySilentRefresh, forceReauth])

  useEffect(() => { if (token) fetchAll(token) }, [token, fetchAll])

  // ── Write methods ──────────────────────────────
  const createEvent = useCallback(async (calendarId = 'primary', eventData) => {
    if (!token) return
    const body = toGoogleBody(eventData)
    await authFetch(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST', body: JSON.stringify(body),
    })
    fetchAll(token)
  }, [token, authFetch, fetchAll])

  const updateEvent = useCallback(async (calendarId, eventId, eventData) => {
    if (!token) return
    const body = toGoogleBody(eventData)
    await authFetch(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PUT', body: JSON.stringify(body),
    })
    fetchAll(token)
  }, [token, authFetch, fetchAll])

  const deleteEvent = useCallback(async (calendarId, eventId) => {
    if (!token) return
    await authFetch(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    })
    fetchAll(token)
  }, [token, authFetch, fetchAll])

  return {
    isSignedIn: !!token,
    signIn, signOut,
    user, events, calendarList,
    loading, error,
    refetch:     () => token && fetchAll(token),
    createEvent, updateEvent, deleteEvent,
  }
}
