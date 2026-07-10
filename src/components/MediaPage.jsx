import { useState, useEffect, useRef } from 'react'
import { useNews }   from '../hooks/useNews'
import { useSports } from '../hooks/useSports'
import { IconNewspaper, IconTrophy } from './Icons'

const APPS = [
  { name: 'Netflix',    url: 'https://netflix.com',     bg: '#E50914', fg: '#fff', icon: 'N' },
  { name: 'YouTube',    url: 'https://youtube.com',     bg: '#FF0000', fg: '#fff', icon: '▶' },
  { name: 'Disney+',    url: 'https://disneyplus.com',  bg: '#113CCF', fg: '#fff', icon: 'D+' },
  { name: 'Hulu',       url: 'https://hulu.com',        bg: '#1CE783', fg: '#000', icon: 'H' },
  { name: 'Max',        url: 'https://max.com',         bg: '#002BE7', fg: '#fff', icon: 'M' },
  { name: 'Prime',      url: 'https://primevideo.com',  bg: '#00A8E1', fg: '#fff', icon: 'P' },
  { name: 'Apple TV+',  url: 'https://tv.apple.com',    bg: '#1c1c1e', fg: '#fff', icon: '' },
  { name: 'Spotify',    url: 'https://spotify.com',     bg: '#1DB954', fg: '#fff', icon: 'S' },
  { name: 'Peacock',    url: 'https://peacocktv.com',   bg: '#F5C542', fg: '#000', icon: 'P' },
  { name: 'ESPN',       url: 'https://espn.com',        bg: '#CC0000', fg: '#fff', icon: 'E' },
]

function AppDock() {
  return (
    <div className="media-dock">
      <div className="media-dock__inner">
        {APPS.map(a => (
          <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" className="media-dock__item">
            <div className="media-dock__icon" style={{ background: a.bg, color: a.fg }}>{a.icon}</div>
            <span className="media-dock__label">{a.name}</span>
          </a>
        ))}
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

function NewsPanel({ feeds }) {
  const items = feeds.flatMap(f =>
    f.items.map(item => ({ ...item, category: f.label }))
  )
  if (feeds.some(f => f.loading)) return <p className="media-loading">Loading news…</p>
  if (feeds.every(f => f.error))  return <p className="media-error">Could not load news</p>
  if (items.length === 0)          return <p className="media-empty">No stories available</p>

  const [hero, ...rest] = items.slice(0, 8)

  return (
    <div className="news-grid">
      <a href={hero.link} target="_blank" rel="noopener noreferrer"
         className="news-card news-card--hero"
         style={{ backgroundImage: hero.thumbnail ? `url(${hero.thumbnail})` : undefined }}>
        <div className="news-card__overlay">
          <span className="news-card__eyebrow">{hero.category}</span>
          <h2 className="news-card__title">{hero.title}</h2>
          {hero.date && <span className="news-card__time">{timeAgo(hero.date)}</span>}
        </div>
      </a>
      {rest.slice(0, 5).map((item, i) => (
        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
           className="news-card"
           style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined }}>
          <div className="news-card__overlay">
            <span className="news-card__eyebrow">{item.category}</span>
            <span className="news-card__title">{item.title}</span>
            {item.date && <span className="news-card__time">{timeAgo(item.date)}</span>}
          </div>
        </a>
      ))}
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
  const timerRef = useRef(null)

  useEffect(() => {
    if (active.length <= 1) return
    timerRef.current = setInterval(() => {
      setIdx(i => (i + 1) % active.length)
    }, 8000)
    return () => clearInterval(timerRef.current)
  }, [active.length])

  if (leagues.some(l => l.loading) && active.length === 0) return <p className="media-loading">Loading scores…</p>
  if (active.length === 0) return <p className="media-empty">No games this week</p>

  const league = active[Math.min(idx, active.length - 1)]

  return (
    <div className="sports-carousel">
      {/* League header with prev/next + dots */}
      <div className="sports-carousel__header">
        <button className="sports-carousel__nav" onClick={() => setIdx(i => (i - 1 + active.length) % active.length)}>‹</button>
        <span className={`sports-carousel__league${league.featured ? ' sports-carousel__league--featured' : ''}`}>{league.label}</span>
        <button className="sports-carousel__nav" onClick={() => setIdx(i => (i + 1) % active.length)}>›</button>
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

  return (
    <div className="media-page">
      <AppDock />

      <div className="media-body">
        <div className="media-news-panel">
          <div className="media-panel-head">
            <IconNewspaper size={13} />
            News
          </div>
          <NewsPanel feeds={newsFeeds} />
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
    </div>
  )
}
