import { useState, useEffect, useRef, useCallback } from 'react'
import { useNews }   from '../hooks/useNews'
import { useSports } from '../hooks/useSports'
import { IconNewspaper, IconTrophy } from './Icons'

// Brand-coloured monograms rather than the services' actual logos. Those are
// trademarks: Simple Icons, the usual CC0 source for them, no longer carries
// Disney+, Hulu, Prime Video, Peacock or ESPN because the holders asked for
// removal, so half the dock would fall back to letters anyway and the rest
// would have to come from somewhere less careful. A consistent set reads better
// on a wall than a mixed one.
//
// Monograms are unique across the dock — Prime and Peacock previously shared a
// bare "P" — and each tile is labelled underneath regardless.
const APPS = [
  { name: 'Netflix',    url: 'https://netflix.com',     bg: '#E50914', fg: '#fff', icon: 'N'   },
  { name: 'YouTube',    url: 'https://youtube.com',     bg: '#FF0000', fg: '#fff', icon: '▶'   },
  { name: 'Disney+',    url: 'https://disneyplus.com',  bg: '#113CCF', fg: '#fff', icon: 'D+'  },
  { name: 'Hulu',       url: 'https://hulu.com',        bg: '#1CE783', fg: '#000', icon: 'h'   },
  { name: 'Max',        url: 'https://max.com',         bg: '#002BE7', fg: '#fff', icon: 'M'   },
  { name: 'Prime',      url: 'https://primevideo.com',  bg: '#00A8E1', fg: '#fff', icon: 'pv'  },
  // Was an empty string, so this tile rendered blank. It previously held
  // Apple's  glyph, which is private-use and would show as a box on the Pi.
  { name: 'Apple TV+',  url: 'https://tv.apple.com',    bg: '#1c1c1e', fg: '#fff', icon: 'tv+' },
  { name: 'Spotify',    url: 'https://spotify.com',     bg: '#1DB954', fg: '#fff', icon: 'S'   },
  { name: 'Peacock',    url: 'https://peacocktv.com',   bg: '#F5C542', fg: '#000', icon: 'pk'  },
  { name: 'ESPN',       url: 'https://espn.com',        bg: '#CC0000', fg: '#fff', icon: 'E'   },
]

// This is a kiosk with a single Chromium window and no address bar or back
// button. Opening a streaming site here (target=_blank or not) strands the
// display on that site until someone reboots the Pi, so the dock never
// navigates: a tap shows where to watch it, with a code for a phone.
function AppDock({ onOpen }) {
  return (
    <div className="media-dock">
      <div className="media-dock__inner">
        {APPS.map(a => (
          <button
            key={a.name}
            type="button"
            className="media-dock__item"
            onClick={() => onOpen({ title: a.name, eyebrow: 'Streaming', link: a.url,
              summary: `Watch ${a.name} on the TV's own app or a streaming stick, or scan to open it on your phone.` })}
          >
            {/* data-len drives the type scale so "tv+" is not set at the same
                size as "N" and overflow its tile. */}
            <div
              className="media-dock__icon"
              data-len={a.icon.length}
              style={{ background: a.bg, color: a.fg }}
              aria-hidden="true"
            >
              {a.icon}
            </div>
            <span className="media-dock__label">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const qrSrc = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(url)}`

// In-app reader card: headline, summary and a QR code to continue on a phone.
// The QR image comes from the same service the games use; if it fails to load
// the plain URL underneath is still there.
function LinkOverlay({ item, onClose }) {
  const closeRef = useRef(null)
  const [qrFailed, setQrFailed] = useState(false)

  useEffect(() => {
    const prev = document.activeElement
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Nobody may close it on an unattended screen.
    const t = setTimeout(onClose, 3 * 60 * 1000)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); prev?.focus?.() }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal link-overlay" role="dialog" aria-modal="true" aria-labelledby="link-overlay-title">
        <div className="modal-header">
          <span className="news-card__eyebrow link-overlay__eyebrow">{item.eyebrow}</span>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body link-overlay__body">
          <div className="link-overlay__text">
            <h2 className="link-overlay__title" id="link-overlay-title">{item.title}</h2>
            {item.date && <span className="link-overlay__time">{timeAgo(item.date)}</span>}
            {item.summary && <p className="link-overlay__summary">{item.summary}</p>}
          </div>
          {item.link && (
            <div className="link-overlay__qr">
              {!qrFailed && (
                <img src={qrSrc(item.link)} alt="QR code to open this on a phone" width="160" height="160"
                     onError={() => setQrFailed(true)} />
              )}
              <span className="link-overlay__hint">{qrFailed ? 'Open on your phone:' : 'Scan to read on your phone'}</span>
              <span className="link-overlay__url">{item.link}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr)) / 60000
  if (diff < 60)   return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

// Round-robin across feeds (each newest first) so a second feed is not
// crowded out by the first feed's eight stories.
function interleave(feeds) {
  const lists = feeds.map(f =>
    [...f.items]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(item => ({ ...item, category: f.label }))
  )
  const out = []
  for (let i = 0; lists.some(l => i < l.length); i++) {
    lists.forEach(l => { if (i < l.length) out.push(l[i]) })
  }
  return out
}

function NewsCard({ item, hero, onOpen }) {
  const Title = hero ? 'h2' : 'span'
  return (
    <button type="button"
       className={`news-card${hero ? ' news-card--hero' : ''}`}
       onClick={() => onOpen({ ...item, eyebrow: item.category })}
       style={{ backgroundImage: item.thumbnail ? `url("${item.thumbnail}")` : undefined }}>
      <div className="news-card__overlay">
        <span className="news-card__eyebrow">{item.category}</span>
        <Title className="news-card__title">{item.title}</Title>
        {item.date && <span className="news-card__time">{timeAgo(item.date)}</span>}
      </div>
    </button>
  )
}

function NewsPanel({ feeds, onOpen }) {
  const items = interleave(feeds)
  if (items.length === 0 && feeds.some(f => f.loading)) return <p className="media-loading">Loading news…</p>
  // Only surface the error when there is genuinely nothing to show. useNews
  // keeps the last good headlines and marks them stale, so a feed-service
  // outage should leave yesterday's stories on the wall rather than a message.
  if (items.length === 0 && feeds.every(f => f.error)) return <p className="media-error">Could not load news</p>
  if (items.length === 0)          return <p className="media-empty">No stories available</p>

  const [hero, ...rest] = items.slice(0, 6)

  return (
    <div className="news-grid">
      <NewsCard item={hero} hero onOpen={onOpen} />
      {rest.map((item, i) => <NewsCard key={item.link || i} item={item} onOpen={onOpen} />)}
    </div>
  )
}

function GameCard({ game }) {
  const live = game.state === 'in'
  const done = game.state === 'post'

  return (
    <div className={`game-card${live ? ' game-card--live' : done ? ' game-card--final' : ''}`}>
      {/* Away team */}
      <div className="game-card__team">
        {game.awayLogo && <img src={game.awayLogo} alt="" className="game-card__logo" />}
        <div className="game-card__team-info">
          <span className="game-card__team-name">{game.away}</span>
          {game.awayRecord && <span className="game-card__record">{game.awayRecord}</span>}
        </div>
        {(live || done) && <span className={`game-card__score${done && Number(game.awayScore) > Number(game.homeScore) ? ' game-card__score--winner' : ''}`}>{game.awayScore}</span>}
      </div>

      {/* Middle: status */}
      <div className="game-card__middle">
        {live ? (
          <div className="game-card__live-status">
            <span className="scoreboard-live-dot" />
            <span className="game-card__clock">{game.clock || game.detail}</span>
          </div>
        ) : done ? (
          <span className="game-card__final">Final</span>
        ) : (
          <span className="game-card__kickoff">{game.date}</span>
        )}
        {game.broadcast && <span className="game-card__broadcast">{game.broadcast}</span>}
        {game.venue && <span className="game-card__venue">{game.venue}</span>}
      </div>

      {/* Home team */}
      <div className="game-card__team game-card__team--home">
        {(live || done) && <span className={`game-card__score${done && Number(game.homeScore) > Number(game.awayScore) ? ' game-card__score--winner' : ''}`}>{game.homeScore}</span>}
        <div className="game-card__team-info game-card__team-info--right">
          <span className="game-card__team-name">{game.home}</span>
          {game.homeRecord && <span className="game-card__record">{game.homeRecord}</span>}
        </div>
        {game.homeLogo && <img src={game.homeLogo} alt="" className="game-card__logo" />}
      </div>
    </div>
  )
}

function SportsPanel({ leagues }) {
  const active = leagues.filter(l => !l.loading && l.games.length > 0)
  const [idx, setIdx] = useState(0)
  const timerRef    = useRef(null)
  // Paused until this timestamp. A touchscreen never fires mouseleave, so a
  // pause has to run out on its own.
  const pausedUntil = useRef(0)
  const pause = () => { pausedUntil.current = Date.now() + 20_000 }

  useEffect(() => {
    if (active.length <= 1) return
    timerRef.current = setInterval(() => {
      if (Date.now() >= pausedUntil.current) setIdx(i => (i + 1) % active.length)
    }, 8000)
    return () => clearInterval(timerRef.current)
  }, [active.length])

  if (leagues.some(l => l.loading) && active.length === 0) return <p className="media-loading">Loading scores…</p>
  if (active.length === 0) return <p className="media-empty">No games this week</p>

  const league = active[Math.min(idx, active.length - 1)]

  return (
    <div className="sports-carousel" onPointerDown={pause} onWheel={pause}>
      {/* League header with prev/next + dots */}
      <div className="sports-carousel__header">
        <button className="sports-carousel__nav" onClick={() => setIdx(i => (i - 1 + active.length) % active.length)} aria-label="Previous league">‹</button>
        <span className={`sports-carousel__league${league.featured ? ' sports-carousel__league--featured' : ''}`}>{league.label}</span>
        <button className="sports-carousel__nav" onClick={() => setIdx(i => (i + 1) % active.length)} aria-label="Next league">›</button>
      </div>
      <div className="sports-carousel__dots">
        {active.map((_, i) => (
          <button key={i} className={`sports-dot${i === Math.min(idx, active.length - 1) ? ' sports-dot--active' : ''}`} onClick={() => setIdx(i)} aria-label={active[i].label} />
        ))}
      </div>
      {/* Games list */}
      <div className="sports-carousel__games">
        {league.games.slice(0, 8).map(g => <GameCard key={g.id} game={g} />)}
      </div>
    </div>
  )
}

export default function MediaPage() {
  const newsFeeds    = useNews()
  const sportLeagues = useSports()
  const [overlay, setOverlay] = useState(null)
  const closeOverlay = useCallback(() => setOverlay(null), [])

  return (
    <div className="media-page">
      <AppDock onOpen={setOverlay} />

      <div className="media-body">
        <div className="media-news-panel">
          <div className="media-panel-head">
            <IconNewspaper size={13} />
            News
          </div>
          <NewsPanel feeds={newsFeeds} onOpen={setOverlay} />
        </div>

        <div className="media-divider" />

        <div className="media-sports-panel">
          <div className="media-panel-head">
            <IconTrophy size={13} />
            Sports — This Week
          </div>
          <SportsPanel leagues={sportLeagues} />
        </div>
      </div>
      {overlay && <LinkOverlay item={overlay} onClose={closeOverlay} />}
    </div>
  )
}
