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

let cache = null
let cacheTime = 0

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
        id:         ev.id,
        away:       teams[0]?.team?.shortDisplayName || teams[0]?.team?.abbreviation || '',
        awayScore:  teams[0]?.score || '',
        awayRecord: teams[0]?.records?.[0]?.summary || '',
        awayLogo:   teams[0]?.team?.logo || '',
        awayColor:  '#' + (teams[0]?.team?.color || '888888'),
        home:       teams[1]?.team?.shortDisplayName || teams[1]?.team?.abbreviation || '',
        homeScore:  teams[1]?.score || '',
        homeRecord: teams[1]?.records?.[0]?.summary || '',
        homeLogo:   teams[1]?.team?.logo || '',
        homeColor:  '#' + (teams[1]?.team?.color || '888888'),
        state:      status?.state || 'pre',
        detail:     status?.shortDetail || '',
        period:     comp?.status?.period || null,
        clock:      comp?.status?.displayClock || '',
        broadcast:  comp?.broadcasts?.[0]?.names?.[0] || '',
        venue:      comp?.venue?.shortName || comp?.venue?.fullName || '',
        date:       !isNaN(gameDate) ? gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
      }
    })
}

export function useSports() {
  const [leagues, setLeagues] = useState(
    LEAGUES.map(l => ({ ...l, games: [], loading: true, error: null }))
  )

  useEffect(() => {
    const doFetch = () => {
      if (Date.now() - cacheTime < 5 * 60 * 1000 && cache) {
        setLeagues(cache)
        return
      }
      let remaining = LEAGUES.length
      LEAGUES.forEach((league, idx) => {
        fetch(`${BASE}/${league.path}?limit=50`)
          .then(r => r.json())
          .then(data => {
            const games = parseGames(data)
            remaining--
            const allDone = remaining === 0
            setLeagues(prev => {
              const next = prev.map((l, i) => i === idx ? { ...l, games, loading: false } : l)
              if (allDone) { cache = next; cacheTime = Date.now() }
              return next
            })
          })
          .catch(err => {
            remaining--
            setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, loading: false, error: err.message } : l))
          })
      })
    }
    doFetch()
    const t = setInterval(doFetch, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  return leagues
}
