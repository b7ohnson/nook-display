import { useState, useEffect, useRef, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import GamePanel from './GamePanel'
import { useGameContent } from '../../hooks/useGameContent'
import { useGameRoom, generateRoomCode } from '../../hooks/useGameRoom'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import Leaderboard from './Leaderboard'

const COMPANION_URL = 'https://skylight-16f44.web.app'
const QUESTIONS_PER_ROUND = 10
const TIME_LIMIT = 20

const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c']
const SHAPES = ['▲', '●', '■', '★']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

function calcPoints(answeredAt, startedAt, limit) {
  const elapsed = Math.min((answeredAt - startedAt) / 1000, limit)
  return Math.round(1000 + 1000 * (1 - elapsed / limit))
}

export default function TriviaShowdown({ onExit }) {
  const [roomCode]     = useState(generateRoomCode)
  const [questions, setQuestions] = useState([])
  const [timeLeft, setTimeLeft]   = useState(TIME_LIMIT)
  const [showLB, setShowLB]       = useState(false)

  const questionsRef = useRef([])
  const playersRef   = useRef([])
  const rafRef       = useRef(null)
  const revealedRef  = useRef(false)
  const roomCreated  = useRef(false)
  const roomDocRef   = useRef(null)

  const { room, players, payload, createRoom, updateState, removeRoom } = useGameRoom(roomCode)
  const { items: allQ, loading: qLoading } = useGameContent('trivia')
  const { addScore } = useLeaderboard('showdown')

  // Keep refs current for timer callbacks
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { questionsRef.current = questions }, [questions])

  const phase = payload.phase || 'lobby'
  const currentQ = questions[payload.questionIndex ?? 0]

  useEffect(() => {
    roomDocRef.current = doc(db, 'gameRooms', roomCode)
    if (roomCreated.current) return
    roomCreated.current = true
    createRoom('showdown')
    return () => removeRoom()
  }, []) // eslint-disable-line

  // Timer — driven by payload.questionStartedAt so it resets cleanly each question
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    revealedRef.current = false
    if (phase !== 'question' || !payload.questionStartedAt) return

    const startedAt = payload.questionStartedAt
    const limit     = payload.timeLimit || TIME_LIMIT
    const qIdx      = payload.questionIndex ?? 0

    const tick = () => {
      const remaining = Math.max(0, limit - (Date.now() - startedAt) / 1000)
      setTimeLeft(remaining)
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!revealedRef.current) {
        revealedRef.current = true
        doReveal(qIdx, startedAt, limit)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, payload.questionStartedAt]) // eslint-disable-line

  const doReveal = async (qIdx, startedAt, limit) => {
    const q   = questionsRef.current[qIdx]
    if (!q) return
    const correct = q.answer
    const updated = playersRef.current.map(p => {
      if (p.answer === correct && p.answeredAt > 0) {
        const pts = calcPoints(p.answeredAt, startedAt, limit)
        return { ...p, score: (p.score || 0) + pts, lastPoints: pts }
      }
      return { ...p, lastPoints: 0 }
    })
    await updateDoc(roomDocRef.current, {
      players: updated,
      'payload.answer': correct,
      'payload.phase': 'reveal',
    })
  }

  const manualReveal = () => {
    if (revealedRef.current) return
    revealedRef.current = true
    cancelAnimationFrame(rafRef.current)
    doReveal(payload.questionIndex ?? 0, payload.questionStartedAt, payload.timeLimit || TIME_LIMIT)
  }

  const pushQuestion = async (qs, idx, currentPlayers) => {
    const q = qs[idx]
    const startedAt = Date.now()
    revealedRef.current = false
    setTimeLeft(TIME_LIMIT)
    await updateDoc(roomDocRef.current, {
      players: currentPlayers,
      state: 'active',
      'payload.phase':              'question',
      'payload.questionIndex':      idx,
      'payload.questionText':       q.question,
      'payload.options':            q.options,
      'payload.answer':             -1,
      'payload.questionStartedAt':  startedAt,
      'payload.timeLimit':          TIME_LIMIT,
    })
  }

  const startGame = async () => {
    const qs = shuffle(allQ).slice(0, QUESTIONS_PER_ROUND)
    setQuestions(qs)
    questionsRef.current = qs
    const freshPlayers = players.map(p => ({ ...p, score: 0, answer: -1, answeredAt: null, lastPoints: 0 }))
    await pushQuestion(qs, 0, freshPlayers)
  }

  const nextQuestion = async () => {
    const next = (payload.questionIndex ?? 0) + 1
    if (next >= questions.length) {
      await updateDoc(roomDocRef.current, {
        'payload.phase': 'done',
        state: 'closed',
      })
      const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))
      if (sorted[0]) addScore({ playerName: sorted[0].name, score: sorted[0].score || 0 })
      return
    }
    const freshPlayers = players.map(p => ({ ...p, answer: -1, answeredAt: null, lastPoints: 0 }))
    await pushQuestion(questions, next, freshPlayers)
  }

  const answeredCount = useMemo(() => players.filter(p => p.answer != null && p.answer !== -1).length, [players])
  const playUrl = `${COMPANION_URL}/play/${roomCode}`
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(playUrl)}`
  const timePct = (timeLeft / TIME_LIMIT) * 100
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#f59e0b' : '#ef4444'

  if (qLoading) return <GamePanel title="Trivia Showdown" onExit={onExit}><div className="game-loading">Loading…</div></GamePanel>

  // ── Lobby ──
  if (phase === 'lobby') return (
    <GamePanel title="Trivia Showdown" onExit={onExit}>
      <div className="showdown-lobby">
        <div className="showdown-lobby-left">
          <div className="showdown-room-code">{roomCode}</div>
          <div className="showdown-room-sub">Room Code</div>
          <img src={qrUrl} alt="QR" className="showdown-qr" />
          <div className="showdown-room-url">{playUrl}</div>
        </div>
        <div className="showdown-lobby-right">
          <div className="showdown-players-title">Players Joined ({players.length})</div>
          {players.length === 0
            ? <div className="showdown-waiting">Waiting for players to scan and join…</div>
            : <ul className="showdown-player-list">
                {players.map(p => <li key={p.id} className="showdown-player-item">👤 {p.name}</li>)}
              </ul>
          }
          <button className="showdown-start-btn" onClick={startGame} disabled={players.length === 0}>
            {players.length === 0 ? 'Waiting for players…' : `Start with ${players.length} player${players.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </GamePanel>
  )

  // ── Done ──
  if (phase === 'done') {
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))
    return (
      <GamePanel title="Trivia Showdown" onExit={onExit}>
        <div className="showdown-done">
          <div className="showdown-done-title">Game Over!</div>
          <ol className="showdown-final-scores">
            {sorted.map((p, i) => (
              <li key={p.id} className="showdown-final-row">
                <span className="showdown-final-rank">{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
                <span className="showdown-final-name">{p.name}</span>
                <span className="showdown-final-pts">{(p.score || 0).toLocaleString()} pts</span>
              </li>
            ))}
          </ol>
          <button className="showdown-lb-toggle" onClick={() => setShowLB(v => !v)}>
            {showLB ? 'Hide Leaderboard' : '🏆 All-time Leaderboard'}
          </button>
          {showLB && <Leaderboard game="showdown" />}
        </div>
      </GamePanel>
    )
  }

  // ── Active game (question / reveal) ──
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <GamePanel title="Trivia Showdown" status={`Q ${(payload.questionIndex ?? 0) + 1} / ${QUESTIONS_PER_ROUND}`} onExit={onExit}>
      <div className="showdown-game">
        <div className="showdown-main">

          {/* Timer bar */}
          {phase === 'question' && (
            <div className="showdown-timer-wrap">
              <div className="showdown-timer-bar">
                <div className="showdown-timer-fill" style={{ width: `${timePct}%`, background: timerColor, transition: 'width 0.1s linear' }} />
              </div>
              <div className="showdown-timer-num" style={{ color: timerColor }}>{Math.ceil(timeLeft)}</div>
            </div>
          )}

          {/* Question card */}
          {currentQ && (
            <div className="showdown-question-card">
              {currentQ.category && <div className="showdown-cat-tag">{currentQ.category}</div>}
              <div className="showdown-question">{currentQ.question}</div>
              <div className="showdown-options-grid">
                {currentQ.options.map((opt, i) => {
                  let extraClass = ''
                  if (phase === 'reveal') {
                    extraClass = i === payload.answer ? ' showdown-opt--correct' : ' showdown-opt--wrong'
                  }
                  return (
                    <div
                      key={i}
                      className={`showdown-opt-tile${extraClass}`}
                      style={{ '--tile-color': COLORS[i] }}
                    >
                      <span className="showdown-opt-shape">{SHAPES[i]}</span>
                      <span className="showdown-opt-text">{opt}</span>
                      {phase === 'reveal' && (
                        <span className="showdown-opt-votes">
                          {players.filter(p => p.answer === i).length} ✓
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Status row */}
          {phase === 'question' && (
            <div className="showdown-status-row">
              <div className="showdown-answered-count">
                {answeredCount} / {players.length} answered
              </div>
              <button className="showdown-reveal-now-btn" onClick={manualReveal}>
                Reveal Now →
              </button>
            </div>
          )}

          {phase === 'reveal' && (
            <button className="showdown-next-btn" onClick={nextQuestion}>
              {(payload.questionIndex ?? 0) + 1 >= QUESTIONS_PER_ROUND ? 'View Final Results →' : 'Next Question →'}
            </button>
          )}
        </div>

        {/* Live leaderboard sidebar */}
        <div className="showdown-sidebar">
          <div className="showdown-scores-title">Live Scores</div>
          <ul className="showdown-score-list">
            {sortedPlayers.slice(0, 8).map((p, i) => (
              <li key={p.id} className="showdown-score-row">
                <span className="showdown-score-rank">{i + 1}</span>
                <span className="showdown-score-name">{p.name}</span>
                <div className="showdown-score-right">
                  {phase === 'reveal' && p.lastPoints > 0 && (
                    <span className="showdown-score-pts-gained">+{p.lastPoints.toLocaleString()}</span>
                  )}
                  <span className="showdown-score-pts">{(p.score || 0).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GamePanel>
  )
}
