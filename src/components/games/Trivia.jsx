import { useState, useEffect, useRef, useCallback } from 'react'
import GamePanel from './GamePanel'
import Leaderboard from './Leaderboard'
import { useGameContent } from '../../hooks/useGameContent'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { weeklyShuffled } from '../../utils/weeklyRotation'
import { IconTrophy, IconThumbsUp, IconBookOpen, IconCheck } from '../Icons'

const QUESTIONS_PER_ROUND = 15
const TIME_PER_Q = 15

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function sampleQuestions(items, category, n) {
  const pool = category === 'All' ? items : items.filter(q => q.category === category)
  // Weekly seeded shuffle gives a stable ordering this week; pick top-30 as weekly pool
  const weeklyPool = weeklyShuffled(pool).slice(0, Math.min(pool.length, Math.max(n * 2, 30)))
  // Random sample from weekly pool for each session
  return shuffle(weeklyPool).slice(0, n)
}

function GradeIcon({ correct, total }) {
  const pct = correct / total
  if (pct >= 0.93) return <><IconTrophy size={22} /> Perfect!</>
  if (pct >= 0.73) return <><IconTrophy size={22} /> Great!</>
  if (pct >= 0.53) return <><IconThumbsUp size={22} /> Good!</>
  return <><IconBookOpen size={22} /> Keep studying!</>
}

export default function Trivia({ onExit }) {
  const { items, loading } = useGameContent('trivia')
  const { addScore }       = useLeaderboard('trivia')

  const [phase, setPhase]         = useState('select')
  const [category, setCategory]   = useState('All')
  const [questions, setQuestions] = useState([])
  const [qIndex, setQIndex]       = useState(0)
  const [selected, setSelected]   = useState(null)
  const [score, setScore]         = useState(0)
  const [correct, setCorrect]     = useState(0)
  const [timer, setTimer]         = useState(TIME_PER_Q)
  const [name, setName]           = useState('')
  const [saved, setSaved]         = useState(false)
  const [showLB, setShowLB]       = useState(false)
  const timerRef = useRef(null)

  const categories = loading ? [] : ['All', ...new Set(items.map(q => q.category).filter(Boolean))]

  const stopTimer = useCallback(() => clearInterval(timerRef.current), [])

  const advanceQ = useCallback((finalSelected, timeLeft, currentQ, currentScore, currentCorrect) => {
    stopTimer()
    const isCorrect = finalSelected === currentQ.answer
    const newScore   = currentScore   + (isCorrect ? 100 + timeLeft * 5 : 0)
    const newCorrect = currentCorrect + (isCorrect ? 1 : 0)
    setScore(newScore)
    setCorrect(newCorrect)

    setTimeout(() => {
      setQIndex(prev => {
        const next = prev + 1
        if (next >= QUESTIONS_PER_ROUND) {
          setPhase('results')
        } else {
          setSelected(null)
          setTimer(TIME_PER_Q)
        }
        return next
      })
    }, 1200)
  }, [stopTimer])

  useEffect(() => {
    if (phase !== 'playing' || selected !== null) return
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          stopTimer()
          const q = questions[qIndex]
          setSelected(-1)
          advanceQ(-1, 0, q, score, correct)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return stopTimer
  }, [phase, qIndex, selected, questions, score, correct, stopTimer, advanceQ])

  const startGame = () => {
    const qs = sampleQuestions(items, category, QUESTIONS_PER_ROUND)
    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setScore(0)
    setCorrect(0)
    setTimer(TIME_PER_Q)
    setSaved(false)
    setShowLB(false)
    setPhase('playing')
  }

  const handleAnswer = (idx) => {
    if (selected !== null) return
    stopTimer()
    setSelected(idx)
    advanceQ(idx, timer, questions[qIndex], score, correct)
  }

  const handleSave = async () => {
    if (!name.trim() || saved) return
    await addScore({ playerName: name.trim(), score })
    setSaved(true)
  }

  if (loading) return (
    <GamePanel title="Trivia" onExit={onExit}>
      <div className="game-loading">Loading questions…</div>
    </GamePanel>
  )

  if (phase === 'select') return (
    <GamePanel title="Trivia" onExit={onExit}>
      <div className="trivia-select">
        <h2 className="trivia-select-title">Choose a category</h2>
        <div className="trivia-cat-grid">
          {categories.map(cat => (
            <button
              key={cat}
              className={`trivia-cat-btn ${category === cat ? 'trivia-cat-btn--active' : ''}`}
              onClick={() => setCategory(cat)}
            >{cat}</button>
          ))}
        </div>
        <div className="trivia-select-meta">{QUESTIONS_PER_ROUND} questions · 15 seconds each · updated weekly</div>
        <button className="trivia-start-btn" onClick={startGame}>Start Quiz</button>
      </div>
    </GamePanel>
  )

  if (phase === 'results') return (
    <GamePanel title="Trivia" onExit={onExit}>
      <div className="trivia-results">
        <div className="trivia-results-score">{score.toLocaleString()}</div>
        <div className="trivia-results-sub">{correct} / {QUESTIONS_PER_ROUND} correct</div>
        <div className="trivia-grade">
          <GradeIcon correct={correct} total={QUESTIONS_PER_ROUND} />
        </div>
        {!saved ? (
          <div className="trivia-save-form">
            <input
              className="trivia-name-input"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              maxLength={20}
            />
            <button className="trivia-save-btn" onClick={handleSave} disabled={!name.trim()}>Save Score</button>
          </div>
        ) : (
          <div className="trivia-saved"><IconCheck size={16} /> Score saved!</div>
        )}
        <button className="trivia-start-btn" onClick={() => setPhase('select')}>Play Again</button>
        <button className="trivia-lb-toggle" onClick={() => setShowLB(v => !v)}>
          <IconTrophy size={14} /> {showLB ? 'Hide Leaderboard' : 'Leaderboard'}
        </button>
        {showLB && <Leaderboard game="trivia" />}
      </div>
    </GamePanel>
  )

  const q = questions[qIndex]
  if (!q) return null

  const timerPct = (timer / TIME_PER_Q) * 100
  const timerColor = timer > 8 ? '#22c55e' : timer > 4 ? '#f59e0b' : '#ef4444'

  return (
    <GamePanel title="Trivia" score={score} status={`Q ${qIndex + 1} / ${QUESTIONS_PER_ROUND}`} onExit={onExit}>
      <div className="trivia-game">
        <div className="trivia-progress-bar">
          <div
            className="trivia-progress-fill"
            style={{ width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }}
          />
        </div>
        <div className="trivia-timer" style={{ color: timerColor }}>{timer}s</div>

        {q.category && <div className="trivia-category-tag">{q.category}</div>}
        <div className="trivia-question">{q.question}</div>

        <div className="trivia-options">
          {q.options.map((opt, i) => {
            let cls = 'trivia-option'
            if (selected !== null) {
              if (i === q.answer) cls += ' trivia-option--correct'
              else if (i === selected) cls += ' trivia-option--wrong'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => handleAnswer(i)}
                disabled={selected !== null}
              >
                <span className="trivia-opt-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </GamePanel>
  )
}
