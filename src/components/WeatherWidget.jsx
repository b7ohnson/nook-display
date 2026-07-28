import { useWeather } from '../hooks/useWeather'
import { weather as mockWeather } from '../data/mockData'

export default function WeatherWidget() {
  const { weather: real, stale } = useWeather()
  const w = real || mockWeather

  return (
    <div className="weather">
      <span className="weather-icon">{w.icon}</span>
      <div>
        <div className="weather-temp">
          {w.temp}°<span className="weather-unit">F</span>
          {!real && <span className="weather-mock"> (mock)</span>}
          {real && stale && <span className="weather-mock" title="Showing the last reading — the weather service is unreachable"> (offline)</span>}
        </div>
        <div className="weather-condition">{w.condition} · H:{w.high}° L:{w.low}°</div>
        {w.feelsLike != null && <div className="weather-feels">Feels like {w.feelsLike}°</div>}
        <div className="weather-location">{w.location}</div>
      </div>
      {/* Absent on mock data and on readings cached before the hourly forecast
          existed, so this stays optional rather than assumed. */}
      {w.hourly?.length > 0 && (
        <ol className="weather-hourly" aria-label="Hourly forecast">
          {w.hourly.map(h => (
            <li key={h.time} className="weather-hourly__slot">
              <span className="weather-hourly__hour">{h.label}</span>
              <span className="weather-hourly__icon" title={h.condition}>{h.icon}</span>
              <span className="weather-hourly__temp">{h.temp}°</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
