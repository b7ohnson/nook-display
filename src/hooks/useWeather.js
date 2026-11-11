import { useState, useEffect, useRef } from 'react'

// WMO weather codes from open-meteo. `kind` picks the SVG in Icons.jsx
// (WeatherIcon); no emoji, so the glyphs match the rest of the display.
const WMO = {
  0:  { label: 'Clear',          kind: 'clear'   },
  1:  { label: 'Mostly clear',   kind: 'partly'  },
  2:  { label: 'Partly cloudy',  kind: 'partly'  },
  3:  { label: 'Overcast',       kind: 'cloudy'  },
  45: { label: 'Fog',            kind: 'fog'     },
  48: { label: 'Freezing fog',   kind: 'fog'     },
  51: { label: 'Light drizzle',  kind: 'drizzle' },
  53: { label: 'Drizzle',        kind: 'drizzle' },
  55: { label: 'Heavy drizzle',  kind: 'drizzle' },
  56: { label: 'Freezing drizzle', kind: 'drizzle' },
  61: { label: 'Light rain',     kind: 'rain'    },
  63: { label: 'Rain',           kind: 'rain'    },
  65: { label: 'Heavy rain',     kind: 'rain'    },
  66: { label: 'Freezing rain',  kind: 'rain'    },
  71: { label: 'Light snow',     kind: 'snow'    },
  73: { label: 'Snow',           kind: 'snow'    },
  75: { label: 'Heavy snow',     kind: 'snow'    },
  77: { label: 'Snow grains',    kind: 'snow'    },
  80: { label: 'Showers',        kind: 'rain'    },
  81: { label: 'Showers',        kind: 'rain'    },
  82: { label: 'Heavy showers',  kind: 'rain'    },
  85: { label: 'Snow showers',   kind: 'snow'    },
  86: { label: 'Snow showers',   kind: 'snow'    },
  95: { label: 'Thunderstorm',   kind: 'storm'   },
  96: { label: 'Thunderstorm',   kind: 'storm'   },
  99: { label: 'Thunderstorm',   kind: 'storm'   },
}

const COORDS_KEY  = 'nook_weather_coords'
const WEATHER_KEY = 'nook_weather_last'

/**
 * A wall-mounted display does not move, so a configured location beats asking
 * the browser: no permission prompt to get stuck on, no dependency on a kiosk
 * profile that may have geolocation disabled, and no IP-based guess landing a
 * county away. Set VITE_HOME_LAT / VITE_HOME_LON to skip geolocation entirely.
 */
const HOME = (() => {
  const lat = Number.parseFloat(import.meta.env.VITE_HOME_LAT)
  const lon = Number.parseFloat(import.meta.env.VITE_HOME_LON)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
})()

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or private mode */ }
}

const HOURLY_COUNT = 6

/**
 * Next few hours from open-meteo's hourly arrays.
 *
 * `timezone=auto` means hourly.time entries are local wall-clock strings with
 * no offset ("2026-07-28T15:00"), so they are compared as text against the same
 * rendering of "now" rather than parsed — parsing them as Date would have the
 * browser read them as local time, which is right only when the display's
 * timezone matches the forecast's.
 */
function buildHourly(hourly) {
  if (!hourly?.time || !hourly?.temperature_2m) return []
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`

  let start = hourly.time.findIndex(t => t.slice(0, 13) > stamp)
  if (start < 0) return []

  return hourly.time.slice(start, start + HOURLY_COUNT).map((t, i) => {
    const hour = Number(t.slice(11, 13))
    const info = wmoInfo(hourly.weather_code?.[start + i])
    return {
      time: t,
      label: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}`,
      temp: Math.round(hourly.temperature_2m[start + i]),
      kind: info.kind,
      night: hourly.is_day?.[start + i] === 0,
      condition: info.label,
    }
  }).filter(h => Number.isFinite(h.temp))
}

function wmoInfo(code) {
  if (WMO[code]) return WMO[code]
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b)
  const match = keys.filter(k => k <= code).at(-1)
  return WMO[match] || { label: 'Unknown', kind: 'cloudy' }
}

export function useWeather() {
  // Start from whatever we already know: configured home, then the last
  // coordinates that worked. Without this, a display whose geolocation prompt
  // is denied once shows mock weather forever with no way to correct it.
  const [coords, setCoords]   = useState(() => HOME || readCache(COORDS_KEY))
  const [weather, setWeather] = useState(() => readCache(WEATHER_KEY)?.data || null)
  const [error, setError]     = useState(null)
  const [stale, setStale]     = useState(() => !!readCache(WEATHER_KEY))
  const cityRef               = useRef(readCache(WEATHER_KEY)?.city || { city: '', state: '' })

  // Only ask the browser when we have nothing better.
  useEffect(() => {
    if (HOME || coords) return
    if (!navigator.geolocation) { setError('No location configured and geolocation unavailable'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const next = {
          lat: Math.round(pos.coords.latitude  * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
        }
        writeCache(COORDS_KEY, next)
        setCoords(next)
      },
      () => setError('Location unavailable — set VITE_HOME_LAT / VITE_HOME_LON'),
      { timeout: 10000 },
    )
  }, [coords])

  // Reverse-geocode once per location, for the label under the temperature.
  useEffect(() => {
    if (!coords || cityRef.current.city) return
    let cancelled = false
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`
    )
      .then(r => r.json())
      .then(g => {
        if (cancelled) return
        cityRef.current = {
          city:  g.city || g.locality || g.principalSubdivision || '',
          state: g.principalSubdivisionCode?.replace(/^[A-Z]+-/, '') || '',
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [coords])

  useEffect(() => {
    if (!coords) return
    let cancelled = false

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${coords.lat}&longitude=${coords.lon}` +
          `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
          `&hourly=temperature_2m,weather_code,is_day` +
          `&daily=temperature_2m_max,temperature_2m_min` +
          // Two days so the strip can run past midnight without falling short.
          `&temperature_unit=fahrenheit&timezone=auto&forecast_days=2`
        )
        if (!res.ok) throw new Error(`Weather API returned ${res.status}`)
        const data = await res.json()
        if (cancelled) return

        const cur = data.current
        const daily = data.daily
        if (!cur || !daily) throw new Error('Malformed weather response')

        const info = wmoInfo(cur.weather_code)
        const { city, state } = cityRef.current
        const next = {
          hourly: buildHourly(data.hourly),
          temp:      Math.round(cur.temperature_2m),
          feelsLike: Math.round(cur.apparent_temperature),
          condition: info.label,
          kind:      info.kind,
          night:     cur.is_day === 0,
          high:      Math.round(daily.temperature_2m_max[0]),
          low:       Math.round(daily.temperature_2m_min[0]),
          location:  [city, state].filter(Boolean).join(', '),
        }

        setWeather(next)
        setStale(false)
        setError(null)
        // Survives reload, so a display that boots without a network shows the
        // last real reading rather than dropping to mock data.
        writeCache(WEATHER_KEY, { data: next, city: cityRef.current, at: Date.now() })
      } catch (err) {
        if (cancelled) return
        // Keep showing the last good reading; just mark it stale.
        setStale(true)
        setError(err.message)
      }
    }

    fetchWeather()
    const t = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [coords])

  return { weather, error, stale, usingConfiguredLocation: !!HOME }
}
