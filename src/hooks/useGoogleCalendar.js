import { useState, useEffect, useCallback, useRef } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email profile'

const GCAL = 'https://www.googleapis.com/calendar/v3'
const GSI_SRC = 'https://accounts.google.com/gsi/client'

const REFRESH_MS      = 5 * 60 * 1000
const RETRY_MS        = 30 * 1000
const TOKEN_MARGIN_MS = 5 * 60 * 1000
const SILENT_TIMEOUT  = 30 * 1000
const WRITABLE_ROLES  = new Set(['owner', 'writer'])

const pad = n => String(n).padStart(2, '0')

// Dates are formatted from local parts on purpose: toISOString() is UTC and
// lands on the wrong day for part of every day in any non-UTC zone.
export function fmtLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtLocalTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return fmtLocalDate(new Date(y, m - 1, d + n))
}

// Every local date an event touches, first to last inclusive.
export function eventDates(e) {
  const last = e.endDate && e.endDate > e.date ? e.endDate : e.date
  const out = []
  for (let d = e.date; d <= last && out.length < 62; d = addDays(d, 1)) out.push(d)
  return out
}

// `endDate` is the last day the event occupies (inclusive); Google's all-day
// end.date is exclusive, so it is converted here and nowhere else.
function timingBody({ date, endDate, startTime, endTime, allDay }) {
  if (allDay) {
    const last = endDate && endDate > date ? endDate : date
    return {
      start: { date, dateTime: null, timeZone: null },
      end:   { date: addDays(last, 1), dateTime: null, timeZone: null },
    }
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const s = new Date(`${date}T${startTime}:00`)
  let e = endTime
    ? new Date(`${endDate && endDate >= date ? endDate : date}T${endTime}:00`)
    : new Date(s.getTime() + 3600_000)
  // An end at or before the start on the same date means "past midnight".
  if (e <= s) e = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, e.getHours(), e.getMinutes())
  return {
    start: { dateTime: `${fmtLocalDate(s)}T${fmtLocalTime(s)}:00`, timeZone: tz, date: null },
    end:   { dateTime: `${fmtLocalDate(e)}T${fmtLocalTime(e)}:00`, timeZone: tz, date: null },
  }
}

function stripNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null))
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

async function gfetch(url, accessToken, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  })
  if (r.status === 204) return null
  const body = await r.json().catch(() => null)
  if (!r.ok) {
    const err = new Error(body?.error?.message || body?.error_description || `Google Calendar request failed (${r.status})`)
    err.status = r.status
    err.reason = body?.error?.errors?.[0]?.reason || body?.error?.status || null
    throw err
  }
  return body
}

async function listAll(url, accessToken) {
  const items = []
  let pageToken
  do {
    const d = await gfetch(url + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''), accessToken)
    items.push(...(d?.items || []))
    pageToken = d?.nextPageToken
  } while (pageToken && items.length < 5000)
  return items
}

function isScopeError(err) {
  return err.status === 403 && (
    err.reason === 'insufficientPermissions' ||
    err.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    /insufficient authentication scopes/i.test(err.message)
  )
}

function toEvent(e, cal, storageKey) {
  const base = {
    id: `${storageKey}::${cal.id}::${e.id}`,
    title: e.summary || '(No title)',
    label: cal.summary,
    color: cal.backgroundColor || '#4A90D9',
    writable: WRITABLE_ROLES.has(cal.accessRole),
  }
  if (e.start.date) {
    const lastDay = e.end?.date ? addDays(e.end.date, -1) : e.start.date
    return {
      ...base,
      date: e.start.date,
      endDate: lastDay > e.start.date ? lastDay : e.start.date,
      time: null, endTime: null, startMs: null, endMs: null,
      allDay: true,
    }
  }
  const start = new Date(e.start.dateTime)
  const end   = e.end?.dateTime ? new Date(e.end.dateTime) : new Date(start.getTime() + 3600_000)
  const endMs = Math.max(end.getTime(), start.getTime())
  return {
    ...base,
    date: fmtLocalDate(start),
    // An event ending exactly at midnight does not occupy the next day.
    endDate: fmtLocalDate(new Date(Math.max(endMs - 1, start.getTime()))),
    time: fmtLocalTime(start),
    endTime: fmtLocalTime(new Date(endMs)),
    startMs: start.getTime(),
    endMs,
    allDay: false,
  }
}

// Silent token requests open a hidden Google popup. Two connections asking at
// the same moment race each other, so they queue across hook instances.
let silentChain = Promise.resolve()

function ensureGsiScript(onLoad) {
  if (window.google?.accounts?.oauth2) { onLoad(); return () => {} }
  let el = document.getElementById('gsi-script')
  // The tag in index.html never retries; if the display booted offline, add a
  // fresh one once we are asked again.
  if (!el || el.dataset.failed) {
    el?.remove()
    el = document.createElement('script')
    el.id = 'gsi-script'
    el.src = GSI_SRC
    el.async = true
    document.head.appendChild(el)
  }
  const onError = () => { el.dataset.failed = '1' }
  el.addEventListener('load', onLoad)
  el.addEventListener('error', onError)
  return () => {
    el.removeEventListener('load', onLoad)
    el.removeEventListener('error', onError)
  }
}

export function useGoogleCalendar(clientId, storageKey = 'default') {
  const tokenKey = `gcal_token_${storageKey}`
  const expKey   = `gcal_token_exp_${storageKey}`
  const userKey  = `gcal_user_${storageKey}`
  const connKey  = `gcal_connected_${storageKey}`
  const emailKey = `gcal_email_${storageKey}`

  const [token, setToken]           = useState(() => {
    const t   = sessionStorage.getItem(tokenKey)
    const exp = Number(sessionStorage.getItem(expKey) || 0)
    return t && exp > Date.now() + 60_000 ? t : null
  })
  const [user, setUser]             = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(userKey) || 'null') } catch { return null }
  })
  const [events, setEvents]         = useState(null)
  const [calendarList, setCalList]  = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)

  const clientRef        = useRef(null)
  const pendingRef       = useRef(null)   // { silent, done } for the in-flight token request
  const needsConsentRef  = useRef(false)
  const tokenRef         = useRef(token)
  const eventsRef        = useRef(null)
  const fetchSeqRef      = useRef(0)
  const retryTimerRef    = useRef(null)
  const fetchDebounceRef = useRef(null)
  const initRef          = useRef(false)

  useEffect(() => { tokenRef.current = token }, [token])
  useEffect(() => { eventsRef.current = events }, [events])

  // The connection is still wanted but cannot be renewed without a tap.
  // Loaded events stay on screen; the header shows a Reconnect button.
  const markReconnect = useCallback((message) => {
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(expKey)
    tokenRef.current = null
    setToken(null)
    setLoading(false)
    if (localStorage.getItem(connKey)) setNeedsReconnect(true)
    if (message) setError(message)
  }, [tokenKey, expKey, connKey])

  const onTokenResponse = useCallback((resp) => {
    const pending = pendingRef.current
    pendingRef.current = null
    pending?.done()
    if (resp.error || !resp.access_token) {
      if (pending?.silent) markReconnect()
      else setError(resp.error_description || resp.error || 'Google sign-in failed')
      return
    }
    const ttl = (Number(resp.expires_in) || 3600) * 1000
    sessionStorage.setItem(tokenKey, resp.access_token)
    sessionStorage.setItem(expKey, String(Date.now() + ttl))
    localStorage.setItem(connKey, '1')
    needsConsentRef.current = false
    tokenRef.current = resp.access_token
    setNeedsReconnect(false)
    setError(null)
    setToken(resp.access_token)
  }, [tokenKey, expKey, connKey, markReconnect])

  const onTokenError = useCallback((err) => {
    const pending = pendingRef.current
    pendingRef.current = null
    pending?.done()
    if (pending?.silent) markReconnect()
    else if (err?.type !== 'popup_closed') setError('Could not open Google sign-in')
  }, [markReconnect])

  const buildTokenClient = useCallback(() => {
    if (clientRef.current || !window.google?.accounts?.oauth2 || !clientId) return
    clientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: onTokenResponse,
      error_callback: onTokenError,
    })
  }, [clientId, onTokenResponse, onTokenError])

  const requestSilent = useCallback(() => {
    if (!localStorage.getItem(connKey)) return
    silentChain = silentChain.then(() => new Promise(resolve => {
      buildTokenClient()
      if (!clientRef.current || !localStorage.getItem(connKey)) {
        if (!clientRef.current) markReconnect()
        resolve()
        return
      }
      const entry = { silent: true }
      const timer = setTimeout(() => {
        if (pendingRef.current === entry) { pendingRef.current = null; markReconnect() }
        resolve()
      }, SILENT_TIMEOUT)
      entry.done = () => { clearTimeout(timer); resolve() }
      pendingRef.current = entry
      const email = localStorage.getItem(emailKey)
      try {
        clientRef.current.requestAccessToken({ prompt: '', ...(email ? { login_hint: email } : {}) })
      } catch {
        pendingRef.current = null
        clearTimeout(timer)
        markReconnect()
        resolve()
      }
    }))
  }, [connKey, emailKey, buildTokenClient, markReconnect])

  useEffect(() => {
    if (!clientId) return
    const init = () => {
      buildTokenClient()
      if (initRef.current) return
      initRef.current = true
      if (!tokenRef.current && localStorage.getItem(connKey)) requestSilent()
    }
    const cleanup = ensureGsiScript(init)
    // If Google's script never arrives (booted offline), say so rather than
    // sitting on an empty calendar.
    const giveUp = setTimeout(() => {
      if (!window.google?.accounts?.oauth2 && !tokenRef.current && localStorage.getItem(connKey)) {
        setNeedsReconnect(true)
      }
    }, 15_000)
    const onOnline = () => {
      if (tokenRef.current || !localStorage.getItem(connKey)) return
      ensureGsiScript(() => { buildTokenClient(); requestSilent() })
    }
    window.addEventListener('online', onOnline)
    return () => {
      cleanup()
      clearTimeout(giveUp)
      window.removeEventListener('online', onOnline)
    }
  }, [clientId, connKey, buildTokenClient, requestSilent])

  // Renew shortly before the access token expires rather than waiting for a 401.
  useEffect(() => {
    if (!token) return
    const exp = Number(sessionStorage.getItem(expKey) || 0)
    const t = setTimeout(requestSilent, Math.max(exp - Date.now() - TOKEN_MARGIN_MS, 10_000))
    return () => clearTimeout(t)
  }, [token, expKey, requestSilent])

  // Must run synchronously inside the tap handler or Chromium blocks the popup.
  const signIn = useCallback(() => {
    buildTokenClient()
    if (!clientRef.current) {
      setError('Google sign-in is not available — check the internet connection')
      return
    }
    const email = localStorage.getItem(emailKey)
    pendingRef.current = { silent: false, done: () => {} }
    setError(null)
    clientRef.current.requestAccessToken(
      needsConsentRef.current ? { prompt: 'consent', ...(email ? { login_hint: email } : {}) }
        : email ? { prompt: '', login_hint: email }
        : { prompt: 'select_account' }
    )
  }, [buildTokenClient, emailKey])

  const signOut = useCallback(() => {
    const tok = tokenRef.current
    if (tok) window.google?.accounts.oauth2.revoke(tok, () => {})
    clearTimeout(retryTimerRef.current)
    fetchSeqRef.current++
    sessionStorage.removeItem(tokenKey)
    sessionStorage.removeItem(expKey)
    sessionStorage.removeItem(userKey)
    localStorage.removeItem(connKey)
    localStorage.removeItem(emailKey)
    tokenRef.current = null
    setToken(null); setUser(null); setEvents(null); setError(null); setCalList([])
    setNeedsReconnect(false)
  }, [tokenKey, expKey, connKey, userKey, emailKey])

  // Returns true when the failure was an auth problem that has been routed to
  // the reconnect path.
  const handleAuthError = useCallback((err) => {
    if (err.status === 401) {
      err.message = 'Calendar session expired — reconnecting'
      requestSilent()
      return true
    }
    if (isScopeError(err)) {
      needsConsentRef.current = true
      err.message = 'Calendar permission needed — tap Reconnect to re-authorize'
      markReconnect(err.message)
      return true
    }
    return false
  }, [requestSilent, markReconnect])

  const fetchAll = useCallback(async (accessToken) => {
    const seq = ++fetchSeqRef.current
    clearTimeout(retryTimerRef.current)
    if (eventsRef.current === null) setLoading(true)

    const scheduleRetry = () => {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(() => {
        if (tokenRef.current) fetchAll(tokenRef.current)
      }, RETRY_MS)
    }

    try {
      if (!localStorage.getItem(emailKey) || !sessionStorage.getItem(userKey)) {
        const uInfo = await gfetch('https://www.googleapis.com/oauth2/v3/userinfo', accessToken)
        if (seq !== fetchSeqRef.current) return
        if (uInfo?.email) {
          const u = { name: uInfo.given_name || uInfo.name, picture: uInfo.picture }
          sessionStorage.setItem(userKey, JSON.stringify(u))
          localStorage.setItem(emailKey, uInfo.email)
          setUser(u)
        }
      }

      const cals = await listAll(`${GCAL}/users/me/calendarList?maxResults=250`, accessToken)
      if (seq !== fetchSeqRef.current) return
      setCalList(cals.map(c => ({
        id: c.id, summary: c.summary, primary: !!c.primary, color: c.backgroundColor,
        accessRole: c.accessRole, writable: WRITABLE_ROLES.has(c.accessRole),
      })))

      // Recomputed on every refresh so the window follows the calendar forward.
      const now   = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const end   = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString()

      const results = await Promise.allSettled(
        cals.map(cal =>
          listAll(
            `${GCAL}/calendars/${encodeURIComponent(cal.id)}/events` +
            `?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}` +
            `&singleEvents=true&orderBy=startTime&maxResults=250`,
            accessToken
          )
        )
      )
      if (seq !== fetchSeqRef.current) return

      const authFailure = results.find(r => r.status === 'rejected' && (r.reason?.status === 401 || isScopeError(r.reason)))
      if (authFailure) throw authFailure.reason

      const previous = eventsRef.current || []
      const failed = []
      const next = results.flatMap((r, i) => {
        const cal = cals[i]
        if (r.status === 'rejected') {
          failed.push(cal.summary || cal.id)
          // Keep what was last loaded for this calendar rather than blanking it.
          const prefix = `${storageKey}::${cal.id}::`
          return previous.filter(e => e.id.startsWith(prefix))
        }
        return r.value
          .filter(e => e.status !== 'cancelled' && (e.start?.date || e.start?.dateTime))
          .map(e => toEvent(e, cal, storageKey))
      })
      setEvents(next)
      if (failed.length) {
        setError(`Could not load ${failed.join(', ')}`)
        scheduleRetry()
      } else {
        setError(null)
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      if (!handleAuthError(err)) {
        setError(err instanceof TypeError || !navigator.onLine
          ? 'Calendar offline — showing the last loaded events'
          : err.message)
        scheduleRetry()
      }
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [storageKey, userKey, emailKey, handleAuthError])

  useEffect(() => {
    if (!token) return
    fetchAll(token)
    const iv = setInterval(() => fetchAll(token), REFRESH_MS)
    const onOnline = () => fetchAll(token)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(iv)
      clearTimeout(retryTimerRef.current)
      clearTimeout(fetchDebounceRef.current)
      window.removeEventListener('online', onOnline)
    }
  }, [token, fetchAll])

  // ── Write methods ──────────────────────────────
  const write = useCallback(async (url, opts) => {
    const tok = tokenRef.current
    if (!tok) throw new Error('Calendar is not connected — tap Reconnect first')
    try {
      const res = await gfetch(url, tok, opts)
      clearTimeout(fetchDebounceRef.current)
      fetchDebounceRef.current = setTimeout(() => {
        if (tokenRef.current) fetchAll(tokenRef.current)
      }, 400)
      return res
    } catch (err) {
      handleAuthError(err)
      throw err
    }
  }, [fetchAll, handleAuthError])

  const createEvent = useCallback((calendarId = 'primary', eventData) => {
    const t = timingBody(eventData)
    const body = { summary: eventData.title, start: stripNulls(t.start), end: stripNulls(t.end) }
    return write(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST', body: JSON.stringify(body),
    })
  }, [write])

  // `changes` holds only what the user changed: `title`, and/or the timing
  // fields (date, endDate, startTime, endTime, allDay) as a set. PATCH leaves
  // description, location, guests and reminders alone.
  const updateEvent = useCallback((calendarId, eventId, changes) => {
    const body = {}
    if (changes.title !== undefined) body.summary = changes.title
    if (changes.date) Object.assign(body, timingBody(changes))
    if (!Object.keys(body).length) return Promise.resolve(null)
    return write(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH', body: JSON.stringify(body),
    })
  }, [write])

  const deleteEvent = useCallback((calendarId, eventId) => {
    return write(`${GCAL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    })
  }, [write])

  const refetch = useCallback(() => {
    if (tokenRef.current) fetchAll(tokenRef.current)
  }, [fetchAll])

  return {
    isSignedIn: !!token,
    needsReconnect: needsReconnect && !token,
    signIn, signOut,
    user, events, calendarList,
    loading, error,
    refetch,
    createEvent, updateEvent, deleteEvent,
  }
}
