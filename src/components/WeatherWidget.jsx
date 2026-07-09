import { useWeather } from '../hooks/useWeather'
import { weather as mockWeather } from '../data/mockData'

export default function WeatherWidget() {
  const { weather: real } = useWeather()
  const w = real || mockWeather

  return (
    <div className="weather">
      <span className="weather-icon">{w.icon}</span>
      <div>
        <div className="weather-temp">
          {w.temp}°<span className="weather-unit">F</span>
          {!real && <span className="weather-mock"> (mock)</span>}
        </div>
        <div className="weather-condition">{w.condition} · H:{w.high}° L:{w.low}°</div>
        <div className="weather-location">{w.location}</div>
      </div>
    </div>
  )
}
