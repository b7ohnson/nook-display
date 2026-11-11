import { useState, useEffect, useRef } from 'react'
import { useGallery } from '../hooks/useGallery'

const PHOTO_MS     = 8000   // how long each photo stays
const CROSSFADE_MS = 2000   // fade overlap
const KB_VARIANTS  = ['kb-a', 'kb-b', 'kb-c', 'kb-d']
const RETRY_MS     = 5 * 60 * 1000
const IMAGE_CACHE  = 'nook-remote-images' // must match the route in sw.js

const LOOKAHEAD    = 3       // current photo plus the next couple

// Photos are painted as CSS backgrounds, which fail silently: a photo that
// can't be fetched just leaves the screen black. So photos are test-loaded
// before they are shown — only the current one and the next couple, since a
// gallery of hundreds downloaded at once stalls the Pi. The service worker
// caches cross-origin images cache-first and can't see their status, so an
// error response (Storage answers 402 when billing lapses) would otherwise be
// replayed for two weeks — a failed photo is evicted so the retry reaches the
// network.
function usePhotoProbe(photos, cur) {
  const [status, setStatus] = useState({}) // url -> 'ok' | 'failed'
  const probing = useRef(new Set())

  // Upcoming photos, skipping ones already known to be broken.
  const window_ = []
  for (let i = 0; i < photos.length && window_.length < LOOKAHEAD; i++) {
    const p = photos[(cur + i) % photos.length]
    if (status[p.url] !== 'failed') window_.push(p.url)
  }
  const windowKey = window_.join('\n')

  useEffect(() => {
    let cancelled = false
    windowKey.split('\n').filter(Boolean).forEach(url => {
      if (status[url] || probing.current.has(url)) return
      probing.current.add(url)
      const img = new Image()
      img.onload = () => {
        probing.current.delete(url)
        if (!cancelled) setStatus(s => ({ ...s, [url]: 'ok' }))
      }
      img.onerror = () => {
        probing.current.delete(url)
        if ('caches' in window) caches.open(IMAGE_CACHE).then(c => c.delete(url)).catch(() => {})
        if (!cancelled) setStatus(s => ({ ...s, [url]: 'failed' }))
      }
      img.src = url
    })
    return () => { cancelled = true; probing.current.clear() }
  }, [windowKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Forget failures now and then so broken photos get another chance.
  useEffect(() => {
    const t = setInterval(() => {
      setStatus(s => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 'failed')))
    }, RETRY_MS)
    return () => clearInterval(t)
  }, [])

  const allFailed = photos.length > 0 && photos.every(p => status[p.url] === 'failed')
  return { status, allFailed }
}

function nextOk(photos, status, from) {
  for (let i = 1; i <= photos.length; i++) {
    const j = (from + i) % photos.length
    if (status[photos[j].url] === 'ok') return j
  }
  return -1
}

export default function PhotoSlideshow() {
  const { photos, loading } = useGallery()
  const [cur, setCur]       = useState(0)
  const [prev, setPrev]     = useState(null)
  const [fading, setFading] = useState(false)
  const [now, setNow]       = useState(new Date())
  const { status, allFailed } = usePhotoProbe(photos, cur)
  const statusRef           = useRef(status)
  const curRef              = useRef(0)
  const timeoutRef          = useRef(null)

  useEffect(() => { curRef.current = cur }, [cur])
  useEffect(() => { statusRef.current = status }, [status])

  // The clock only shows minutes, so tick on the minute boundary.
  useEffect(() => {
    let t
    const tick = () => {
      setNow(new Date())
      t = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    t = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(t)
  }, [])

  // If the current photo turns out to be broken, move to one that works.
  const curUrl = photos[cur % (photos.length || 1)]?.url
  useEffect(() => {
    if (!curUrl || status[curUrl] !== 'failed') return
    const j = nextOk(photos, status, cur % photos.length)
    setCur(j === -1 ? (cur + 1) % photos.length : j)
  }, [curUrl, status, photos, cur])

  useEffect(() => {
    if (photos.length <= 1) return
    const advance = () => {
      const oldIdx  = curRef.current % photos.length
      const nextIdx = nextOk(photos, statusRef.current, oldIdx)
      // Next photo not ready yet: stay put rather than show a black frame.
      if (nextIdx === -1 || nextIdx === oldIdx) return
      setPrev(oldIdx)
      setFading(true)
      setCur(nextIdx)
      timeoutRef.current = setTimeout(() => { setPrev(null); setFading(false) }, CROSSFADE_MS)
    }
    const t = setInterval(advance, PHOTO_MS + CROSSFADE_MS)
    return () => { clearInterval(t); clearTimeout(timeoutRef.current) }
  }, [photos])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const photo     = photos.length ? photos[cur % photos.length] : null
  const showPhoto = photo && status[photo.url] === 'ok'

  if (loading || !showPhoto) {
    return (
      <div className="slideshow slideshow--dark">
        <div className="slideshow-overlay" />
        <div className="slideshow-content">
          <div className="slideshow-time">{time}</div>
          <div className="slideshow-date">{date}</div>
          {!loading && photos.length === 0 && (
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

  const prevPhoto = prev !== null ? photos[prev % photos.length] : null
  const kbClass   = KB_VARIANTS[cur % KB_VARIANTS.length]

  return (
    <div className="slideshow">
      {/* Bottom layer — new photo with Ken Burns */}
      <div
        key={`cur-${cur}`}
        className={`ss-layer ${kbClass}`}
        style={{ backgroundImage: `url("${photo.url}")` }}
      />
      {/* Top layer — old photo fading out */}
      {prevPhoto && (
        <div
          key={`prev-${prev}`}
          className={`ss-layer ss-layer--prev ${fading ? 'ss-layer--fading' : ''}`}
          style={{ backgroundImage: `url("${prevPhoto.url}")` }}
        />
      )}

      <div className="slideshow-overlay" />

      <div className="slideshow-content">
        <div className="slideshow-time">{time}</div>
        <div className="slideshow-date">{date}</div>
        {photo.name && <div className="slideshow-caption">{photo.name}</div>}
      </div>

      <div className="slideshow-hint">Touch anywhere to continue</div>

      {photos.length > 1 && photos.length <= 40 && (
        <div className="slideshow-dots">
          {photos.map((_, i) => (
            <span key={i} className={`s-dot ${i === cur % photos.length ? 's-dot--active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  )
}
