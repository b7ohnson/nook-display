import { useState, useEffect } from 'react'

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

function wmoInfo(code) {
  if (WMO[code]) return WMO[code]
  // Find nearest lower code
  const keys = Object.keys(WMO).map(Number).sort((a, b) => a - b)
  const match = keys.filter(k => k <= code).at(-1)
  return WMO[match] || { label: 'Unknown', icon: '🌡️' }
}

export function useWeather() {
  const [coords, setCoords]   = useState(null)
  const [weather, setWeather] = useState(null)
  const [error, setError]     = useState(null)

  // Get geolocation once
  useEffect(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()  => setError('Location denied — showing mock weather'),
      { timeout: 10000 }
    )
  }, [])

  // Fetch weather whenever coords are available, refresh every 30 min
  useEffect(() => {
    if (!coords) return

    const fetchWeather = async () => {
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${coords.lat}&longitude=${coords.lon}` +
            `&current=temperature_2m,apparent_temperature,weather_code` +
            `&daily=temperature_2m_max,temperature_2m_min` +
            `&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`
          ),
          fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client` +
            `?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`
          ),
        ])

        const wData = await wRes.json()
        const gData = await gRes.json()

        const cur   = wData.current
        const daily = wData.daily
        const info  = wmoInfo(cur.weather_code)
        const city  = gData.city || gData.locality || gData.principalSubdivision || ''
        const state = gData.principalSubdivisionCode?.replace(/^[A-Z]+-/, '') || ''

        setWeather({
          temp:      Math.round(cur.temperature_2m),
          feelsLike: Math.round(cur.apparent_temperature),
          condition: info.label,
          icon:      info.icon,
          high:      Math.round(daily.temperature_2m_max[0]),
          low:       Math.round(daily.temperature_2m_min[0]),
          location:  [city, state].filter(Boolean).join(', '),
        })
      } catch (err) {
        setError(err.message)
      }
    }

    fetchWeather()
    const t = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [coords])

  return { weather, error }
}
