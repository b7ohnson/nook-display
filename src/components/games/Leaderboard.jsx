import { useState } from 'react'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { IconTrophy, IconAlertTriangle } from '../Icons'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This week' },
  { key: 'all',   label: 'All time' },
]

const EMPTY_TEXT = {
  today: 'Nobody has saved a score today.',
  week:  'Nobody has saved a score this week.',
  all:   'No saved scores yet.',
}

export default function Leaderboard({ game }) {
  const [range, setRange] = useState('all')
  const { scores, loading, error } = useLeaderboard(game, range)

  let body
  if (loading) {
    body = <p className="leaderboard-empty">Loading scores</p>
  } else if (error) {
    // A failed query is not the same as an empty board: say so plainly.
    body = (
      <p className="leaderboard-empty leaderboard-empty--error" role="status">
        <IconAlertTriangle size={16} /> {error.message}.
        {error.code === 'failed-precondition' && range !== 'all' && ' All time still works.'}
      </p>
    )
  } else if (scores.length === 0) {
    body = <p className="leaderboard-empty">{EMPTY_TEXT[range]}</p>
  } else {
    body = (
      <ol className="leaderboard-list">
        {scores.map((s, i) => (
          <li key={s.id} className={`leaderboard-row${i === 0 ? ' leaderboard-row--first' : ''}`}>
            <span className="leaderboard-rank">{i + 1}</span>
            <span className="leaderboard-name">{s.playerName}</span>
            <span className="leaderboard-score">{Number(s.score || 0).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">
          <IconTrophy size={18} /> High scores
        </span>
        <div className="leaderboard-tabs" role="group" aria-label="Show scores from">
          {RANGES.map(r => (
            <button
              key={r.key}
              className={`leaderboard-tab ${range === r.key ? 'leaderboard-tab--active' : ''}`}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >{r.label}</button>
          ))}
        </div>
      </div>
      {body}
    </div>
  )
}
