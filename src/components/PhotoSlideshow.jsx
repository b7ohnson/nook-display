import { useState, useEffect } from 'react'
import { photos } from '../data/mockData'

export default function PhotoSlideshow() {
  const [idx, setIdx] = useState(0)
  const [now, setNow] = useState(new Date())
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % photos.length)
        setFade(true)
      }, 600)
    }, 6000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const photo = photos[idx]

  return (
    <div className="slideshow" style={{ background: photo.gradient }}>
      <div className="slideshow-overlay" />

      <div className="slideshow-content" style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.6s ease' }}>
        <div className="slideshow-time">{time}</div>
        <div className="slideshow-date">{date}</div>
        <div className="slideshow-caption">{photo.caption}</div>
      </div>

      <div className="slideshow-hint">Touch anywhere to continue</div>

      <div className="slideshow-dots">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`s-dot ${i === idx ? 's-dot--active' : ''}`}
            onClick={() => { setIdx(i); setFade(true) }}
          />
        ))}
      </div>
    </div>
  )
}
