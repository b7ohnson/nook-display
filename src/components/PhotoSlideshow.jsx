import { useState, useEffect, useRef } from 'react'
import { useGallery } from '../hooks/useGallery'

const PHOTO_MS     = 8000   // how long each photo stays
const CROSSFADE_MS = 2000   // fade overlap
const KB_VARIANTS  = ['kb-a', 'kb-b', 'kb-c', 'kb-d']
const RETRY_MS     = 5 * 60 * 1000
const IMAGE_CACHE  = 'nook-remote-images' // must match the route in sw.js

// Photos are painted as CSS backgrounds, which fail silently: a photo that
// can't be fetched just leaves the screen black. So each one is test-loaded
// first and only the ones that actually decode are shown. The service worker
// caches cross-origin images cache-first and can't see their status, so an
// error response (Storage answers 402 when billing lapses) would otherwise be
// replayed for two weeks — a failed photo is evicted so the retry reaches the
// network.
function useLoadablePhotos(photos) {
  const [status, setStatus] = useState({}) // url -> 'ok' | 'failed'

  useEffect(() => {
    let cancelled = false
    const probe = (url) => {
      const img = new Image()
      img.onload = () => { if (!cancelled) setStatus(s => ({ ...s, [url]: 'ok' })) }
      img.onerror = () => {
        if ('caches' in window) {
          caches.open(IMAGE_CACHE).then(c => c.delete(url)).catch(() => {})
        }
        if (!cancelled) setStatus(s => ({ ...s, [url]: 'failed' }))
      }
      img.src = url
    }
    photos.forEach(p => probe(p.url))
    const t = setInterval(() => {
      setStatus(s => {
        photos.forEach(p => { if (s[p.url] === 'failed') probe(p.url) })
        return s
      })
    }, RETRY_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [photos])

  const usable  = photos.filter(p => status[p.url] === 'ok')
  const settled = photos.every(p => status[p.url])
  return { usable, allFailed: photos.length > 0 && settled && usable.length === 0 }
}

export default function PhotoSlideshow() {
  const { photos: allPhotos, loading } = useGallery()
  const { usable: photos, allFailed } = useLoadablePhotos(allPhotos)
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
          {!loading && allPhotos.length === 0 && (
            <div className="slideshow-caption">Add photos in the NooK companion app</div>
          )}
          {allFailed && (
            <div className="slideshow-caption">Photos can't be loaded right now</div>
          )}
        </div>
        <div className="slideshow-hint">Touch anywhere to continue</div>
      </div>
    )
  }

  // The usable list can shrink between renders, so indexes are wrapped.
  const photo     = photos[cur % photos.length]
  const prevPhoto = prev !== null ? photos[prev % photos.length] : null
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
