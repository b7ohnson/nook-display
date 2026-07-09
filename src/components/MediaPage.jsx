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

function AppTile({ name, url, bg, fg, icon }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="app-tile">
      <div className="app-tile-icon" style={{ background: bg, color: fg }}>{icon}</div>
      <span className="app-tile-name">{name}</span>
    </a>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr)) / 60000
  if (diff < 60)   return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function NewsTiles({ feeds }) {
  // Merge all feed items, tag each with its category
  const items = feeds.flatMap(f =>
    f.items.map(item => ({ ...item, category: f.label }))
  )
  if (feeds.some(f => f.loading)) return <p className="media-loading">Loading news…</p>
  if (feeds.every(f => f.error))  return <p className="media-error">Could not load news</p>

  return (
    <div className="news-tiles">
      {items.slice(0, 10).map((item, i) => (
        <a
          key={i}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`news-tile ${i % 3 === 0 ? 'news-tile--featured' : ''}`}
        >
          <span className="news-tile-cat">{item.category}</span>
          <span className="news-tile-title">{item.title}</span>
          {item.date && <span className="news-tile-age">{timeAgo(item.date)}</span>}
        </a>
      ))}
    </div>
  )
}

function GameRow({ game }) {
  const live = game.state === 'in'
  const done = game.state === 'post'
  return (
    <div className={`game-row ${live ? 'game-row--live' : ''}`}>
      <div className="game-teams">
        <span className="game-team">{game.away}</span>
        {(live || done) && <span className="game-score">{game.awayScore}</span>}
        <span className="game-vs">{live || done ? '–' : 'vs'}</span>
        {(live || done) && <span className="game-score">{game.homeScore}</span>}
        <span className="game-team">{game.home}</span>
      </div>
      <span className={`game-status ${live ? 'game-status--live' : ''}`}>{game.detail}</span>
    </div>
  )
}

function SportsTiles({ leagues }) {
  const active = leagues.filter(l => !l.loading && l.games.length > 0)
  const loading = leagues.some(l => l.loading)

  return (
    <div className="sports-tiles">
      {loading && active.length === 0 && <p className="media-loading">Loading scores…</p>}
      {!loading && active.length === 0 && <p className="media-empty">No games this week</p>}
      {active.map(league => (
        <div
          key={league.key}
          className={`sports-tile ${league.featured ? 'sports-tile--featured' : ''}`}
        >
          <div className="sports-tile-label">{league.label}</div>
          {league.games.map(g => <GameRow key={g.id} game={g} />)}
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

      <div className="app-launcher">
        {APPS.map(a => <AppTile key={a.name} {...a} />)}
      </div>

      <div className="media-body">
        <div className="media-news-panel">
          <div className="media-panel-head">
            <IconNewspaper size={13} />
            News
          </div>
          <NewsTiles feeds={newsFeeds} />
        </div>

        <div className="media-sports-panel">
          <div className="media-panel-head">
            <IconTrophy size={13} />
            Sports — This Week
          </div>
          <SportsTiles leagues={sportLeagues} />
        </div>
      </div>
    </div>
  )
}
