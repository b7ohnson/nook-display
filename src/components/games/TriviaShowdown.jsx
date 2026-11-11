import { useState, useEffect, useRef, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { gameRoom } from 'nook-core/paths'
import { db } from '../../firebase'
import GamePanel from './GamePanel'
import { useGameContent } from '../../hooks/useGameContent'
import { useGameRoom, generateRoomCode } from '../../hooks/useGameRoom'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import Leaderboard from './Leaderboard'
import { weeklyShuffled } from '../../utils/weeklyRotation'
import { IconUser, IconTrophy } from '../Icons'

const COMPANION_URL = 'https://skylight-16f44.web.app'
const QUESTIONS_PER_ROUND = 15
const TIME_LIMIT = 20

// Answer tile colours from the theme tokens in App.css; the shapes stay so
// the four answers can be told apart without colour.
const COLORS = ['var(--team-1)', 'var(--team-2)', 'var(--team-3)', 'var(--team-4)']
const SHAPES = ['▲', '●', '■', '★']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// answeredAt comes from the phone's clock and startedAt from the display's,
// so a skewed phone clock could put elapsed below zero (more than the maximum
// 2000 points) or past the limit. Clamp to the real range.
function calcPoints(answeredAt, startedAt, limit) {
  const raw = (answeredAt - startedAt) / 1000
  const elapsed = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), limit) : limit
  return Math.round(1000 + 1000 * (1 - elapsed / limit))
}

export default function TriviaShowdown({ onExit }) {
  const [roomCode]     = useState(generateRoomCode)
  const [questions, setQuestions] = useState([])
  const [timeLeft, setTimeLeft]   = useState(TIME_LIMIT)
  const [showLB, setShowLB]       = useState(false)

  const questionsRef = useRef([])
  const rafRef       = useRef(null)
  const revealedRef  = useRef(false)
  const roomCreated  = useRef(false)
  const roomDocRef   = useRef(null)

  const { players, payload, createRoom, mutatePlayers, removeRoom } = useGameRoom(roomCode)
  const { items: allQ, loading: qLoading } = useGameContent('trivia')
  const { addScore } = useLeaderboard('showdown')

  // Keep refs current for timer callbacks
  useEffect(() => { questionsRef.current = questions }, [questions])

  const phase = payload.phase || 'lobby'
  const currentQ = questions[payload.questionIndex ?? 0]

  useEffect(() => {
    roomDocRef.current = doc(db, ...gameRoom(roomCode))
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
    // Scored against the stored players inside a transaction, so an answer
    // that arrives while this runs is counted rather than overwritten.
    await mutatePlayers(stored => stored.map(p => {
      if (p.answer === correct && p.answeredAt > 0) {
        const pts = calcPoints(p.answeredAt, startedAt, limit)
        return { ...p, score: (p.score || 0) + pts, lastPoints: pts }
      }
      return { ...p, lastPoints: 0 }
    }), {
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

  // resetScores: true on the first question of a game.
  const pushQuestion = async (qs, idx, resetScores) => {
    const q = qs[idx]
    const startedAt = Date.now()
    revealedRef.current = false
    setTimeLeft(TIME_LIMIT)
    await mutatePlayers(stored => stored.map(p => ({
      ...p,
      ...(resetScores ? { score: 0 } : {}),
      answer: -1,
      answeredAt: null,
      lastPoints: 0,
    })), {
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
    const weeklyPool = weeklyShuffled(allQ).slice(0, Math.min(allQ.length, QUESTIONS_PER_ROUND * 2))
    const qs = shuffle(weeklyPool).slice(0, QUESTIONS_PER_ROUND)
    setQuestions(qs)
    questionsRef.current = qs
    if (qs.length === 0) return
    await pushQuestion(qs, 0, true)
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
    await pushQuestion(questions, next, false)
  }

  const answeredCount = useMemo(() => players.filter(p => p.answer != null && p.answer !== -1).length, [players])
  const playUrl = `${COMPANION_URL}/play/${roomCode}`
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(playUrl)}`
  const timePct = (timeLeft / TIME_LIMIT) * 100
  const timerColor = timeLeft > 10 ? 'var(--ok)' : timeLeft > 5 ? 'var(--warn)' : 'var(--danger)'

  if (qLoading) return <GamePanel title="Trivia Showdown" onExit={onExit}><div className="game-loading">Loading…</div></GamePanel>

  // ── Lobby ──
  if (phase === 'lobby') return (
    <GamePanel title="Trivia Showdown" onExit={onExit}>
      <div className="showdown-lobby">
        <div className="showdown-lobby-left">
          <div className="showdown-room-code">{roomCode}</div>
          <div className="showdown-room-sub">Room code</div>
          <img src={qrUrl} alt="QR code to join this game" className="showdown-qr" />
          <div className="showdown-room-url">{playUrl}</div>
        </div>
        <div className="showdown-lobby-right">
          <div className="showdown-players-title">Joined ({players.length})</div>
          {players.length === 0
            ? <div className="showdown-waiting">Scan the code with a phone to join.</div>
            : <ul className="showdown-player-list">
                {players.map(p => <li key={p.id} className="showdown-player-item"><IconUser size={14} /> {p.name}</li>)}
              </ul>
          }
          <button className="showdown-start-btn" onClick={startGame} disabled={players.length === 0 || allQ.length === 0}>
            {players.length === 0 ? 'Waiting for players' : `Start with ${players.length} player${players.length > 1 ? 's' : ''}`}
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
          <div className="showdown-done-title">Final scores</div>
          <ol className="showdown-final-scores">
            {sorted.map((p, i) => (
              <li key={p.id} className="showdown-final-row">
                <span className={`showdown-final-rank${i === 0 ? ' showdown-final-rank--first' : ''}`}>{i + 1}</span>
                <span className="showdown-final-name">{p.name}</span>
                <span className="showdown-final-pts">{(p.score || 0).toLocaleString()} pts</span>
              </li>
            ))}
          </ol>
          <button className="showdown-lb-toggle" onClick={() => setShowLB(v => !v)}>
            <IconTrophy size={14} /> {showLB ? 'Hide high scores' : 'High scores'}
          </button>
          {showLB && <Leaderboard game="showdown" />}
        </div>
      </GamePanel>
    )
  }

  // ── Active game (question / reveal) ──
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <GamePanel title="Trivia Showdown" status={`Question ${(payload.questionIndex ?? 0) + 1} of ${questions.length || QUESTIONS_PER_ROUND}`} onExit={onExit}>
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
                          {players.filter(p => p.answer === i).length} picked
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
                Show the answer
              </button>
            </div>
          )}

          {phase === 'reveal' && (
            <button className="showdown-next-btn" onClick={nextQuestion}>
              {(payload.questionIndex ?? 0) + 1 >= questions.length ? 'Final scores' : 'Next question'}
            </button>
          )}
        </div>

        {/* Live leaderboard sidebar */}
        <div className="showdown-sidebar">
          <div className="showdown-scores-title">Scores</div>
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
