import { useState, useEffect, useRef } from 'react'

const WMO = {
  0:  { label: 'Clear',          icon: '☀️' },
  1:  { label: 'Mostly Clear',   icon: '🌤️' },
  2:  { label: 'Partly Cloudy',  icon: '⛅' },
  3:  { label: 'Overcast',       icon: '☁️' },
  45: { label: 'Foggy',          icon: '🌫️' },
  48: { label: 'Freezing Fog',   icon: '🌫️' },
  51: { label: 'Light Drizzle',  icon: '🌦️' },
  53: { label: 'Drizzle',        icon: '🌦️' },
  55: { label: 'Heavy Drizzle',  icon: '🌧️' },
  61: { label: 'Light Rain',     icon: '🌧️' },
  63: { label: 'Rain',           icon: '🌧️' },
  65: { label: 'Heavy Rain',     icon: '🌧️' },
  71: { label: 'Light Snow',     icon: '🌨️' },
  73: { label: 'Snow',           icon: '❄️' },
  75: { label: 'Heavy Snow',     icon: '❄️' },
  80: { label: 'Showers',        icon: '🌦️' },
  81: { label: 'Showers',        icon: '🌧️' },
  82: { label: 'Heavy Showers',  icon: '🌧️' },
  95: { label: 'Thunderstorm',   icon: '⛈️' },
  99: { label: 'Thunderstorm',   icon: '⛈️' },
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

function wmoInfo(code) {
  if (WMO[code]) return WMO[code]
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b)
  const match = keys.filter(k => k <= code).at(-1)
  return WMO[match] || { label: 'Unknown', icon: '🌡️' }
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
          `&current=temperature_2m,apparent_temperature,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min` +
          `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`
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
          temp:      Math.round(cur.temperature_2m),
          feelsLike: Math.round(cur.apparent_temperature),
          condition: info.label,
          icon:      info.icon,
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
