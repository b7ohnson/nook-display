import { useState } from 'react'
import { useLeaderboard } from '../../hooks/useLeaderboard'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'all',   label: 'All Time' },
]

export default function Leaderboard({ game }) {
  const [range, setRange] = useState('all')
  const { scores, loading } = useLeaderboard(game, range)

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">🏆 Leaderboard</span>
        <div className="leaderboard-tabs">
          {RANGES.map(r => (
            <button
              key={r.key}
              className={`leaderboard-tab ${range === r.key ? 'leaderboard-tab--active' : ''}`}
              onClick={() => setRange(r.key)}
            >{r.label}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="leaderboard-empty">Loading…</p>
      ) : scores.length === 0 ? (
        <p className="leaderboard-empty">No scores yet — be the first!</p>
      ) : (
        <ol className="leaderboard-list">
          {scores.map((s, i) => (
            <li key={s.id} className="leaderboard-row">
              <span className="leaderboard-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
              <span className="leaderboard-name">{s.playerName}</span>
              <span className="leaderboard-score">{s.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
