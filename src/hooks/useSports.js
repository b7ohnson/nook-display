import { useState, useEffect } from 'react'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports'

const LEAGUES = [
  { key: 'nba',        label: 'NBA',             path: 'basketball/nba/scoreboard',    featured: false },
  { key: 'nfl',        label: 'NFL',             path: 'football/nfl/scoreboard',      featured: false },
  { key: 'epl',        label: 'Premier League',  path: 'soccer/eng.1/scoreboard',      featured: true  },
  { key: 'laliga',     label: 'La Liga',         path: 'soccer/esp.1/scoreboard',      featured: false },
  { key: 'bundesliga', label: 'Bundesliga',      path: 'soccer/ger.1/scoreboard',      featured: false },
  { key: 'seriea',     label: 'Serie A',         path: 'soccer/ita.1/scoreboard',      featured: false },
  { key: 'ligue1',     label: 'Ligue 1',         path: 'soccer/fra.1/scoreboard',      featured: false },
  { key: 'worldcup',   label: 'World Cup',       path: 'soccer/fifa.world/scoreboard', featured: true  },
]

function weekBounds() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

function parseGames(data) {
  const { start, end } = weekBounds()
  return (data.events || [])
    .filter(ev => {
      const d = new Date(ev.date || ev.competitions?.[0]?.date || '')
      return !isNaN(d) ? d >= start && d <= end : true
    })
    .map(ev => {
      const comp  = ev.competitions?.[0]
      const teams = (comp?.competitors || []).sort((a, b) => a.homeAway === 'home' ? 1 : -1)
      const status = comp?.status?.type
      const gameDate = new Date(ev.date || comp?.date || '')
      return {
        id:        ev.id,
        away:      teams[0]?.team?.shortDisplayName || teams[0]?.team?.abbreviation || '',
        awayScore: teams[0]?.score || '',
        home:      teams[1]?.team?.shortDisplayName || teams[1]?.team?.abbreviation || '',
        homeScore: teams[1]?.score || '',
        state:     status?.state || 'pre',
        detail:    status?.shortDetail || '',
        date:      !isNaN(gameDate) ? gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '',
      }
    })
}

export function useSports() {
  const [leagues, setLeagues] = useState(
    LEAGUES.map(l => ({ ...l, games: [], loading: true, error: null }))
  )

  useEffect(() => {
    LEAGUES.forEach((league, idx) => {
      fetch(`${BASE}/${league.path}?limit=50`)
        .then(r => r.json())
        .then(data => {
          const games = parseGames(data)
          setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, games, loading: false } : l))
        })
        .catch(err => {
          setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, loading: false, error: err.message } : l))
        })
    })
  }, [])

  return leagues
}
