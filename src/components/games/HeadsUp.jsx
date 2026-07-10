import { useState } from 'react'
import GamePanel from './GamePanel'
import { useGameRoom, generateRoomCode } from '../../hooks/useGameRoom'
import { IconSmartphone, IconCheckCircle, IconSkipForward } from '../Icons'

const COMPANION_URL = 'https://skylight-16f44.web.app'
const CATEGORIES = ['Animals', 'Movies', 'Sports Stars', 'Food', 'Jobs', 'Actions']
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309']

export default function HeadsUp({ onExit }) {
  const [roomCode] = useState(generateRoomCode)
  const [category, setCategory] = useState('')
  const [phase, setPhase] = useState('setup')

  const { players, payload, createRoom, updatePayload, removeRoom } = useGameRoom(roomCode)

  const playUrl = `${COMPANION_URL}/play/headsup/${roomCode}`
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(playUrl)}`

  const openLobby = async () => {
    if (!category) return
    await createRoom('headsup')
    await updatePayload({ category, phase: 'waiting' })
    setPhase('lobby')
  }

  const startRound = async () => {
    await updatePayload({ phase: 'playing' })
    setPhase('active')
  }

  const endRound = async () => {
    await removeRoom()
    setPhase('done')
  }

  const finishedPlayers = players.filter(p => p.finished)

  if (phase === 'setup') return (
    <GamePanel title="Heads Up" onExit={onExit}>
      <div className="headsup-setup">
        <h2 className="headsup-setup-title">Choose a Category</h2>
        <div className="headsup-cat-grid">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`headsup-cat-btn ${category === cat ? 'headsup-cat-btn--active' : ''}`}
              onClick={() => setCategory(cat)}
            >{cat}</button>
          ))}
        </div>
        <button className="headsup-create-btn" onClick={openLobby} disabled={!category}>
          Create Room →
        </button>
      </div>
    </GamePanel>
  )

  if (phase === 'lobby') return (
    <GamePanel title="Heads Up" onExit={() => { removeRoom(); onExit() }}>
      <div className="headsup-lobby">
        <div className="headsup-lobby-left">
          <div className="headsup-cat-badge">{category}</div>
          <div className="headsup-room-code">{roomCode}</div>
          <img src={qrUrl} alt="Scan to join" className="headsup-qr" />
          <div className="headsup-room-url">{playUrl}</div>
        </div>
        <div className="headsup-lobby-right">
          <div className="headsup-players-title">Players ({players.length})</div>
          {players.length === 0
            ? <p className="headsup-waiting">Scan the QR code to join…</p>
            : <ul className="headsup-player-list">
                {players.map(p => (
                  <li key={p.id} className="headsup-player-item">
                    <IconSmartphone size={14} /> {p.name}
                  </li>
                ))}
              </ul>
          }
          <button
            className="headsup-start-btn"
            onClick={startRound}
            disabled={players.length === 0}
          >
            {players.length === 0 ? 'Waiting for players…' : 'Start Round →'}
          </button>
        </div>
      </div>
    </GamePanel>
  )

  if (phase === 'active') return (
    <GamePanel
      title="Heads Up"
      status={`${category} · ${finishedPlayers.length}/${players.length} done`}
      onExit={() => { removeRoom(); onExit() }}
    >
      <div className="headsup-active">
        <div className="headsup-active-info">
          <div className="headsup-active-icon"><IconSmartphone size={40} /></div>
          <div className="headsup-active-text">Players are playing on their phones!</div>
          <div className="headsup-active-hint">
            <IconCheckCircle size={14} /> tilt forward = correct &nbsp;·&nbsp;
            <IconSkipForward size={14} /> tilt back = skip &nbsp;·&nbsp; 3 min timer
          </div>
        </div>
        <div className="headsup-scores-grid">
          {players.map(p => (
            <div key={p.id} className={`headsup-score-card ${p.finished ? 'headsup-score-card--done' : ''}`}>
              <div className="headsup-score-name">{p.name}</div>
              {p.finished
                ? <div className="headsup-score-tally">
                    <IconCheckCircle size={13} /> {p.correct || 0}
                    &nbsp;&nbsp;
                    <IconSkipForward size={13} /> {p.skipped || 0}
                  </div>
                : <div className="headsup-score-playing">Playing…</div>
              }
            </div>
          ))}
        </div>
        <button className="headsup-end-btn" onClick={endRound}>End Round</button>
      </div>
    </GamePanel>
  )

  const sorted = [...players].sort((a, b) => (b.correct || 0) - (a.correct || 0))
  return (
    <GamePanel title="Heads Up" onExit={onExit}>
      <div className="headsup-results">
        <div className="headsup-results-title">Results — {category}</div>
        <ol className="headsup-results-list">
          {sorted.map((p, i) => (
            <li key={p.id} className="headsup-results-row">
              <span
                className="headsup-results-rank"
                style={i < 3 ? { color: RANK_COLORS[i], fontWeight: 700 } : {}}
              >
                {i < 3 ? `#${i + 1}` : `${i + 1}.`}
              </span>
              <span className="headsup-results-name">{p.name}</span>
              <span className="headsup-results-score">
                <IconCheckCircle size={13} /> {p.correct || 0}
                &nbsp;&nbsp;
                <IconSkipForward size={13} /> {p.skipped || 0}
              </span>
            </li>
          ))}
        </ol>
        <button className="headsup-create-btn" onClick={() => { setPhase('setup'); setCategory('') }}>
          Play Again
        </button>
      </div>
    </GamePanel>
  )
}
