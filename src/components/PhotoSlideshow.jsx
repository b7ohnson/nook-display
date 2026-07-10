import { useState, useEffect, useRef } from 'react'
import { useGallery } from '../hooks/useGallery'

const PHOTO_MS     = 8000   // how long each photo stays
const CROSSFADE_MS = 2000   // fade overlap
const KB_VARIANTS  = ['kb-a', 'kb-b', 'kb-c', 'kb-d']

export default function PhotoSlideshow() {
  const { photos, loading } = useGallery()
  const [cur, setCur]       = useState(0)
  const [prev, setPrev]     = useState(null)
  const [fading, setFading] = useState(false)
  const [now, setNow]       = useState(new Date())
  const curRef              = useRef(0)
  const timeoutRef          = useRef(null)

  useEffect(() => { curRef.current = cur }, [cur])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (photos.length <= 1) return
    const advance = () => {
      const oldIdx  = curRef.current
      const nextIdx = (oldIdx + 1) % photos.length
      setPrev(oldIdx)
      setFading(true)
      setCur(nextIdx)
      timeoutRef.current = setTimeout(() => { setPrev(null); setFading(false) }, CROSSFADE_MS)
    }
    const t = setInterval(advance, PHOTO_MS + CROSSFADE_MS)
    return () => { clearInterval(t); clearTimeout(timeoutRef.current) }
  }, [photos.length])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading || photos.length === 0) {
    return (
      <div className="slideshow slideshow--dark">
        <div className="slideshow-overlay" />
        <div className="slideshow-content">
          <div className="slideshow-time">{time}</div>
          <div className="slideshow-date">{date}</div>
          {!loading && (
            <div className="slideshow-caption">Add photos in the NooK companion app</div>
          )}
        </div>
        <div className="slideshow-hint">Touch anywhere to continue</div>
      </div>
    )
  }

  const photo     = photos[cur]
  const prevPhoto = prev !== null ? photos[prev] : null
  const kbClass   = KB_VARIANTS[cur % KB_VARIANTS.length]

  return (
    <div className="slideshow">
      {/* Bottom layer — new photo with Ken Burns */}
      <div
        key={`cur-${cur}`}
        className={`ss-layer ${kbClass}`}
        style={{ backgroundImage: `url(${photo.url})` }}
      />
      {/* Top layer — old photo fading out */}
      {prevPhoto && (
        <div
          key={`prev-${prev}`}
          className={`ss-layer ss-layer--prev ${fading ? 'ss-layer--fading' : ''}`}
          style={{ backgroundImage: `url(${prevPhoto.url})` }}
        />
      )}

      <div className="slideshow-overlay" />

      <div className="slideshow-content">
        <div className="slideshow-time">{time}</div>
        <div className="slideshow-date">{date}</div>
        {photo.name && <div className="slideshow-caption">{photo.name}</div>}
      </div>

      <div className="slideshow-hint">Touch anywhere to continue</div>

      {photos.length > 1 && (
        <div className="slideshow-dots">
          {photos.map((_, i) => (
            <span key={i} className={`s-dot ${i === cur ? 's-dot--active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  )
}
