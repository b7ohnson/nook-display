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

/**
 * VITE_FAVORITE_LEAGUES is a comma-separated list of the keys above, e.g.
 *
 *   VITE_FAVORITE_LEAGUES=nba,epl
 *
 * It controls which leagues are fetched at all, not just which are displayed —
 * every league here is a separate ESPN request every five minutes, so narrowing
 * it cuts eight requests down to the ones the family actually watches. Order is
 * preserved, so the first key listed leads the carousel. Unset, or set to keys
 * that match nothing, falls back to all leagues with the `featured` ones first.
 */
const FAVORITES = (import.meta.env.VITE_FAVORITE_LEAGUES || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

const ACTIVE_LEAGUES = (() => {
  if (FAVORITES.length) {
    const picked = FAVORITES
      .map(key => LEAGUES.find(l => l.key === key))
      .filter(Boolean)
    if (picked.length) return picked
    console.warn('VITE_FAVORITE_LEAGUES matched no known leagues — showing all')
  }
  return [...LEAGUES].sort((a, b) => Number(b.featured) - Number(a.featured))
})()

const REFRESH_MS = 5 * 60 * 1000

let cache = null
let cacheTime = 0

// Sunday to Saturday, matching the rest of the display.
function weekBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
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
    ACTIVE_LEAGUES.map(l => ({ ...l, games: [], loading: true, error: null }))
  )

  useEffect(() => {
    const doFetch = () => {
      // Small margin so the 5-minute tick is not skipped by a cache that is a
      // few milliseconds younger than the interval.
      if (cache && Date.now() - cacheTime < REFRESH_MS - 30_000) {
        setLeagues(cache)
        return
      }
      // Stamped when the round starts, not when it finishes, so the next
      // tick always sees an expired cache.
      const startedAt = Date.now()
      let remaining = ACTIVE_LEAGUES.length
      ACTIVE_LEAGUES.forEach((league, idx) => {
        fetch(`${BASE}/${league.path}?limit=50`)
          .then(r => {
            if (!r.ok) throw new Error(`ESPN returned ${r.status}`)
            return r.json()
          })
          .then(data => {
            const games = parseGames(data)
            remaining--
            const allDone = remaining === 0
            setLeagues(prev => {
              const next = prev.map((l, i) => i === idx ? { ...l, games, loading: false } : l)
              if (allDone) { cache = next; cacheTime = startedAt }
              return next
            })
          })
          .catch(err => {
            remaining--
            // Keep the last good games for this league on screen.
            setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, loading: false, error: err.message } : l))
          })
      })
    }
    doFetch()
    const t = setInterval(doFetch, REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  return leagues
}
