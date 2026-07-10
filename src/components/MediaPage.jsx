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
    <div className="news-editorial">
      <a href={hero.link} target="_blank" rel="noopener noreferrer" className="news-hero">
        <span className="news-eyebrow">{hero.category}</span>
        <h2 className="news-hero__title">{hero.title}</h2>
        {hero.date && <span className="news-hero__time">{timeAgo(hero.date)}</span>}
      </a>

      <div className="news-supporting">
        {rest.slice(0, 6).map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="news-story">
            <span className="news-eyebrow news-eyebrow--small">{item.category}</span>
            <span className="news-story__title">{item.title}</span>
            {item.date && <span className="news-story__time">{timeAgo(item.date)}</span>}
          </a>
        ))}
      </div>
    </div>
  )
}

function GameRow({ game }) {
  const live = game.state === 'in'
  const done = game.state === 'post'
  const pre  = game.state === 'pre'
  return (
    <div className={`scoreboard-game${live ? ' scoreboard-game--live' : done ? ' scoreboard-game--final' : ' scoreboard-game--upcoming'}`}>
      <div className="scoreboard-game__teams">
        <span className="scoreboard-game__team">{game.away}</span>
        {(live || done) ? (
          <span className="scoreboard-game__scores">
            <strong>{game.awayScore}</strong>
            <span className="scoreboard-game__dash">–</span>
            <strong>{game.homeScore}</strong>
          </span>
        ) : (
          <span className="scoreboard-game__vs">vs</span>
        )}
        <span className="scoreboard-game__team">{game.home}</span>
      </div>
      <span className="scoreboard-game__detail">
        {live && <span className="scoreboard-live-dot" aria-label="Live" />}
        {live ? 'LIVE' : game.detail || (pre ? game.date : '')}
      </span>
    </div>
  )
}

function SportsPanel({ leagues }) {
  const active  = leagues.filter(l => !l.loading && l.games.length > 0)
  const loading = leagues.some(l => l.loading)

  return (
    <div className="scoreboard">
      {loading && active.length === 0 && <p className="media-loading">Loading scores…</p>}
      {!loading && active.length === 0 && <p className="media-empty">No games this week</p>}
      {active.map(league => (
        <div key={league.key} className={`scoreboard-league${league.featured ? ' scoreboard-league--featured' : ''}`}>
          <div className="scoreboard-league__header">{league.label}</div>
          <div className="scoreboard-league__games">
            {league.games.map(g => <GameRow key={g.id} game={g} />)}
          </div>
        </div>
      ))}
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
