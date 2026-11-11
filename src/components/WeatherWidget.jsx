import { useWeather } from '../hooks/useWeather'
import { WeatherIcon, IconCloudOff } from './Icons'

export default function WeatherWidget() {
  const { weather: w, stale, error } = useWeather()

  // No reading at all yet: say so rather than showing made-up numbers.
  if (!w) {
    return (
      <div className="weather weather--empty" role="status">
        <span className="weather-icon"><IconCloudOff size={40} /></span>
        <div>
          <div className="weather-condition weather-condition--empty">
            {error ? 'Weather unavailable' : 'Checking the weather'}
          </div>
          {error && <div className="weather-location">Will try again in half an hour</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="weather">
      <span className="weather-icon" title={w.condition}>
        <WeatherIcon kind={w.kind} night={w.night} size={44} />
      </span>
      <div>
        <div className="weather-temp">
          {w.temp}°<span className="weather-unit">F</span>
          {stale && (
            <span className="weather-mock" title="The weather service is unreachable; this is the last reading">
              {' '}last reading
            </span>
          )}
        </div>
        <div className="weather-condition">{w.condition} · H {w.high}° L {w.low}°</div>
        {w.feelsLike != null && <div className="weather-feels">Feels like {w.feelsLike}°</div>}
        {w.location && <div className="weather-location">{w.location}</div>}
      </div>
      {/* Absent on readings cached before the hourly forecast existed. */}
      {w.hourly?.length > 0 && (
        <ol className="weather-hourly" aria-label="Hourly forecast">
          {w.hourly.map(h => (
            <li key={h.time} className="weather-hourly__slot">
              <span className="weather-hourly__hour">{h.label}</span>
              <span className="weather-hourly__icon" title={h.condition}>
                <WeatherIcon kind={h.kind} night={h.night} size={22} />
                <span className="sr-only">{h.condition}</span>
              </span>
              <span className="weather-hourly__temp">{h.temp}°</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
