import { useState, useMemo, useEffect, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import GamePanel from './GamePanel'
import { JEOPARDY_BOARDS } from '../../data/jeopardySeed'
import { useGameRoom, generateRoomCode } from '../../hooks/useGameRoom'

const COMPANION_URL = 'https://skylight-16f44.web.app'
const BOARD_COLORS  = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']

// ── Answer matching ────────────────────────────────────────────
function normalizeAnswer(text) {
  return String(text)
    .toLowerCase()
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, d => '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(d)])
    .replace(/^(what(?:'s| is| are| was| were)?\s+(?:a\s+|an\s+|the\s+)?)/i, '')
    .replace(/^(who(?:'s| is| are| was| were)?\s+(?:a\s+|an\s+|the\s+)?)/i, '')
    .replace(/^(where(?:'s| is| are| was| were)?\s+)/i, '')
    .replace(/\?$/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(a|an|the|their|your|its)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function answersMatch(submitted, correct) {
  const s = normalizeAnswer(submitted)
  const c = normalizeAnswer(correct)
  if (!s || !c) return false
  if (s === c) return true
  if (s.length >= 3 && (c.includes(s) || s.includes(c))) return true
  const words = s.split(' ').filter(w => w.length >= 3)
  return words.length > 0 && words.every(w => c.includes(w))
}

// ── Board setup ────────────────────────────────────────────────
function pickDailyDoubles(board) {
  const cells = []
  board.forEach((col, ci) => col.clues.forEach((_, ri) => cells.push(`${ci}-${ri}`)))
  return new Set(cells.sort(() => Math.random() - 0.5).slice(0, 2))
}

export default function Jeopardy({ onExit }) {
  const [roomCode]         = useState(generateRoomCode)
  const [phase, setPhase]  = useState('setup')
  const [boardIdx, setBoardIdx]   = useState(0)
  const [teamNames, setTeamNames] = useState(['Team 1', 'Team 2'])
  const [scores, setScores]       = useState([0, 0])
  const [used, setUsed]           = useState(new Set())
  const [active, setActive]       = useState(null)
  const [showAns, setShowAns]     = useState(false)
  const [wager, setWager]         = useState('')

  const roomDocRef   = useRef(null)
  const roomCreated  = useRef(false)
  const autoCloseRef = useRef(null)
  const lastVerified = useRef(null)

  const { players, payload, createRoom, removeRoom } = useGameRoom(roomCode)

  const board        = JEOPARDY_BOARDS[boardIdx]
  const dailyDoubles = useMemo(() => pickDailyDoubles(board), [boardIdx]) // eslint-disable-line

  const playUrl = `${COMPANION_URL}/play/${roomCode}`
  const qrUrl   = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(playUrl)}`,
    [roomCode] // eslint-disable-line
  )

  // Create room on mount
  useEffect(() => {
    roomDocRef.current = doc(db, 'gameRooms', roomCode)
    if (roomCreated.current) return
    roomCreated.current = true
    createRoom('jeopardy')
    return () => { clearTimeout(autoCloseRef.current); removeRoom() }
  }, []) // eslint-disable-line

  // Keep payload.teamNames in sync so phones can pick teams during setup
  useEffect(() => {
    if (!roomDocRef.current) return
    updateDoc(roomDocRef.current, { 'payload.teamNames': teamNames })
  }, [teamNames]) // eslint-disable-line

  const addTeam = () => {
    if (teamNames.length >= 4) return
    setTeamNames(t => [...t, `Team ${t.length + 1}`])
    setScores(s => [...s, 0])
  }
  const removeTeam = () => {
    if (teamNames.length <= 2) return
    setTeamNames(t => t.slice(0, -1))
    setScores(s => s.slice(0, -1))
  }

  const startGame = async () => {
    setUsed(new Set())
    await updateDoc(roomDocRef.current, {
      'payload.phase':          'board',
      'payload.buzzersOpen':    false,
      'payload.buzzedBy':       null,
      'payload.submittedAnswer': null,
      'payload.wrongAnswerers': [],
      'payload.answerResult':   null,
      'payload.teamNames':      teamNames,
    })
    setPhase('board')
  }

  const pickClue = async (ci, ri) => {
    const key  = `${ci}-${ri}`
    if (used.has(key)) return
    const clue = board[ci].clues[ri]
    const dd   = dailyDoubles.has(key)
    setActive({ ci, ri, key, clue, dd })
    setShowAns(false)
    setWager('')
    setPhase('clue')
    await updateDoc(roomDocRef.current, {
      'payload.phase':           'clue',
      'payload.clueText':        clue.q,
      'payload.clueValue':       clue.value,
      'payload.clueCategory':    board[ci].category,
      'payload.buzzersOpen':     players.length > 0,
      'payload.buzzedBy':        null,
      'payload.submittedAnswer': null,
      'payload.wrongAnswerers':  [],
      'payload.answerResult':    null,
    })
  }

  const openBuzzers  = () => updateDoc(roomDocRef.current, { 'payload.buzzersOpen': true,  'payload.buzzedBy': null })
  const resetBuzzers = () => updateDoc(roomDocRef.current, { 'payload.buzzersOpen': false, 'payload.buzzedBy': null, 'payload.answerResult': null })

  const award = (teamIdx, mult) => {
    const amt = active.dd && parseInt(wager) > 0 ? parseInt(wager) * mult : active.clue.value * mult
    setScores(s => s.map((v, i) => i === teamIdx ? v + amt : v))
  }

  const closeClue = async () => {
    clearTimeout(autoCloseRef.current)
    if (!active) return
    const key = active.key
    setUsed(u => new Set([...u, key]))
    setActive(null)
    setShowAns(false)
    setPhase('board')
    await updateDoc(roomDocRef.current, {
      'payload.phase':           'board',
      'payload.buzzersOpen':     false,
      'payload.buzzedBy':        null,
      'payload.submittedAnswer': null,
      'payload.wrongAnswerers':  [],
      'payload.answerResult':    null,
    })
  }

  // ── Auto-verify submitted answers ────────────────────────────
  useEffect(() => {
    const sub = payload.submittedAnswer
    if (!sub || !active) return
    const key = `${sub.id}:${sub.submittedAt}`
    if (key === lastVerified.current) return
    lastVerified.current = key

    const correct = answersMatch(sub.text, active.clue.a)
    if (correct) {
      const amt = (active.dd && parseInt(wager) > 0) ? parseInt(wager) : active.clue.value
      setScores(s => s.map((v, i) => i === (sub.teamIdx ?? 0) ? v + amt : v))
      updateDoc(roomDocRef.current, {
        'payload.answerResult': 'correct',
        'payload.answeredBy':   { name: sub.name, teamIdx: sub.teamIdx },
        'payload.buzzersOpen':  false,
      })
      clearTimeout(autoCloseRef.current)
      autoCloseRef.current = setTimeout(closeClue, 2500)
    } else {
      const wrong = [...(payload.wrongAnswerers || []), sub.id]
      const stillAvailable = players.filter(p => !wrong.includes(p.id))
      updateDoc(roomDocRef.current, {
        'payload.answerResult':    'wrong',
        'payload.wrongAnswerers':  wrong,
        'payload.buzzedBy':        null,
        'payload.submittedAnswer': null,
      })
      setTimeout(() => {
        updateDoc(roomDocRef.current, {
          'payload.buzzersOpen':  stillAvailable.length > 0,
          'payload.answerResult': null,
        })
      }, 1500)
    }
  }, [payload.submittedAnswer]) // eslint-disable-line

  const remaining    = board[0].clues.length * board.length - used.size
  const buzzedBy     = payload.buzzedBy
  const buzzersOpen  = payload.buzzersOpen
  const answerResult = payload.answerResult
  const answeredBy   = payload.answeredBy

  // ── Setup ──────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <GamePanel title="Jeopardy!" onExit={onExit}>
      <div className="jeop-setup">
        <div className="jeop-setup-left">
          <div className="jeop-setup-section">
            <label className="jeop-label">Select Board</label>
            <div className="jeop-board-opts">
              {JEOPARDY_BOARDS.map((b, i) => (
                <button
                  key={i}
                  className={`jeop-board-opt ${boardIdx === i ? 'jeop-board-opt--active' : ''}`}
                  onClick={() => setBoardIdx(i)}
                >
                  Board {i + 1}
                  <span className="jeop-board-cats">{b.map(c => c.category).join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="jeop-setup-section">
            <label className="jeop-label">Teams ({teamNames.length})</label>
            {teamNames.map((name, i) => (
              <div key={i} className="jeop-team-row">
                <span className="jeop-team-dot" style={{ background: BOARD_COLORS[i] }} />
                <input
                  className="jeop-team-input"
                  value={name}
                  onChange={e => setTeamNames(t => t.map((n, j) => j === i ? e.target.value : n))}
                />
              </div>
            ))}
            <div className="jeop-team-btns">
              {teamNames.length < 4 && <button className="jeop-team-add" onClick={addTeam}>+ Add team</button>}
              {teamNames.length > 2 && <button className="jeop-team-add" onClick={removeTeam}>− Remove team</button>}
            </div>
          </div>

          <button className="jeop-start-btn" onClick={startGame}>Start Game →</button>
        </div>

        <div className="jeop-setup-right">
          <div className="jeop-lobby-label">Players buzz in from phone</div>
          <img src={qrUrl} alt="QR code" className="jeop-lobby-qr" />
          <div className="jeop-lobby-code">{roomCode}</div>
          <div className="jeop-lobby-url">{playUrl}</div>
          {players.length > 0
            ? <ul className="jeop-lobby-players">
                {players.map(p => (
                  <li key={p.id} style={{ color: p.teamIdx != null ? BOARD_COLORS[p.teamIdx] : undefined }}>
                    ● {p.name}{p.teamIdx != null ? ` (${teamNames[p.teamIdx]})` : ''}
                  </li>
                ))}
              </ul>
            : <div className="jeop-lobby-hint">Waiting for players to scan…</div>
          }
        </div>
      </div>
    </GamePanel>
  )

  // ── Active Clue ────────────────────────────────────────────────
  if (phase === 'clue' && active) {
    const autoMode = players.length > 0
    return (
      <div className="jeop-clue-screen">
        <div className="jeop-clue-topbar">
          <div className="jeop-clue-cat">
            {board[active.ci].category} · ${active.clue.value}
          </div>

          <div className="jeop-buzzer-zone">
            {autoMode ? (
              <>
                {!buzzersOpen && !buzzedBy && !answerResult && (
                  <span className="jeop-buzzer-waiting">Buzzers open…</span>
                )}
                {buzzersOpen && !buzzedBy && (
                  <span className="jeop-buzzer-waiting">Buzzers open — waiting…</span>
                )}
                {buzzedBy && !answerResult && (
                  <span className="jeop-buzzed-name">⚡ {buzzedBy.name} is answering…</span>
                )}
                {answerResult === 'correct' && (
                  <span className="jeop-answer-correct">✓ {answeredBy?.name} got it!</span>
                )}
                {answerResult === 'wrong' && (
                  <span className="jeop-answer-wrong">✗ Wrong answer</span>
                )}
                {(buzzersOpen || buzzedBy) && (
                  <button className="jeop-buzzer-reset" onClick={resetBuzzers}>Reset</button>
                )}
              </>
            ) : (
              <>
                {!buzzersOpen && !buzzedBy && (
                  <button className="jeop-buzzer-open-btn" onClick={openBuzzers}>🔔 Open Buzzers</button>
                )}
                {buzzersOpen && !buzzedBy && (
                  <span className="jeop-buzzer-waiting">Buzzers open…</span>
                )}
                {buzzedBy && (
                  <span className="jeop-buzzed-name">⚡ {buzzedBy.name} buzzed!</span>
                )}
                {(buzzersOpen || buzzedBy) && (
                  <button className="jeop-buzzer-reset" onClick={resetBuzzers}>Reset</button>
                )}
              </>
            )}
          </div>

        </div>

        {active.dd && (
          <div className="jeop-dd-banner">
            ⭐ DAILY DOUBLE
            <input
              className="jeop-wager-input"
              type="number"
              min="0"
              placeholder="Enter wager…"
              value={wager}
              onChange={e => setWager(e.target.value)}
            />
          </div>
        )}

        <div className="jeop-clue-text">{active.clue.q}</div>

        {/* Auto mode: show answer after correct */}
        {autoMode && answerResult === 'correct' && (
          <div className="jeop-answer-reveal">
            <div className="jeop-answer-label">ANSWER</div>
            <div className="jeop-answer-text">{active.clue.a}</div>
          </div>
        )}

        {/* Manual mode: reveal + award buttons */}
        {!autoMode && !showAns && (
          <button className="jeop-show-ans-btn" onClick={() => setShowAns(true)}>
            Reveal Answer
          </button>
        )}
        {!autoMode && showAns && (
          <>
            <div className="jeop-answer-reveal">
              <div className="jeop-answer-label">ANSWER</div>
              <div className="jeop-answer-text">{active.clue.a}</div>
            </div>
            <div className="jeop-award-section">
              <div className="jeop-award-label">Award points to:</div>
              <div className="jeop-award-teams">
                {teamNames.map((name, i) => (
                  <div key={i} className="jeop-award-team">
                    <span className="jeop-award-name" style={{ color: BOARD_COLORS[i] }}>{name}</span>
                    <div className="jeop-award-btns">
                      <button className="jeop-award-btn jeop-award-btn--correct" onClick={() => { award(i, 1); closeClue() }}>
                        +${active.dd && wager ? wager : active.clue.value}
                      </button>
                      <button className="jeop-award-btn jeop-award-btn--wrong" onClick={() => { award(i, -1); closeClue() }}>
                        −${active.dd && wager ? wager : active.clue.value}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button className="jeop-skip-btn jeop-skip-btn--skip" onClick={closeClue}>
          No one got it — skip
        </button>
      </div>
    )
  }

  // ── Game Board ─────────────────────────────────────────────────
  return (
    <div className="jeop-board-screen">
      <div className="jeop-scoreboard">
        {teamNames.map((name, i) => (
          <div key={i} className="jeop-score-card" style={{ borderColor: BOARD_COLORS[i] }}>
            <span className="jeop-score-name" style={{ color: BOARD_COLORS[i] }}>{name}</span>
            <span className="jeop-score-val">${scores[i].toLocaleString()}</span>
          </div>
        ))}
        {players.length > 0 && (
          <div className="jeop-player-pills">
            {players.map(p => (
              <span
                key={p.id}
                className="jeop-player-pill"
                style={{ borderColor: p.teamIdx != null ? BOARD_COLORS[p.teamIdx] : undefined }}
              >
                ● {p.name}
              </span>
            ))}
          </div>
        )}
        <div className="jeop-remaining">{remaining} left</div>
        <button className="jeop-exit-btn" onClick={onExit}>✕</button>
      </div>

      <div className="jeop-grid" style={{ gridTemplateColumns: `repeat(${board.length}, 1fr)` }}>
        {board.map((col, ci) => (
          <div key={`h-${ci}`} className="jeop-cell jeop-cell--header">{col.category}</div>
        ))}
        {[0, 1, 2, 3, 4].map(ri =>
          board.map((col, ci) => {
            const key    = `${ci}-${ri}`
            const isUsed = used.has(key)
            const isDD   = dailyDoubles.has(key)
            return (
              <button
                key={key}
                className={`jeop-cell jeop-cell--value ${isUsed ? 'jeop-cell--used' : ''}`}
                onClick={() => pickClue(ci, ri)}
                disabled={isUsed}
              >
                {isUsed ? '' : `$${col.clues[ri].value}`}
                {isDD && !isUsed && <span className="jeop-dd-star">⭐</span>}
              </button>
            )
          })
        )}
      </div>

      {remaining === 0 && (
        <div className="jeop-game-over">
          Game over! 🎉 Winner:{' '}
          <strong style={{ color: BOARD_COLORS[scores.indexOf(Math.max(...scores))] }}>
            {teamNames[scores.indexOf(Math.max(...scores))]}
          </strong>
        </div>
      )}
    </div>
  )
}
