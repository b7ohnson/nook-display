import { useState, useEffect } from 'react'
import GamePanel from './GamePanel'
import { useGameContent } from '../../hooks/useGameContent'
import { IconFlame } from '../Icons'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

function loadStreak() {
  try {
    const s = JSON.parse(localStorage.getItem('riddle_streak') || '{}')
    return { streak: s.streak || 0, lastDate: s.lastDate || '' }
  } catch { return { streak: 0, lastDate: '' } }
}

function saveStreak(streak, lastDate) {
  localStorage.setItem('riddle_streak', JSON.stringify({ streak, lastDate }))
}

export default function DailyRiddles({ onExit }) {
  const { items, loading } = useGameContent('riddle')
  const [revealed, setRevealed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [alreadySolved, setAlreadySolved] = useState(false)

  useEffect(() => {
    const { streak, lastDate } = loadStreak()
    setStreak(streak)
    setAlreadySolved(lastDate === todayStr())
    if (lastDate === todayStr()) setRevealed(true)
  }, [])

  if (loading) return (
    <GamePanel title="Daily Riddle" onExit={onExit}>
      <div className="game-loading">Loading today's riddle…</div>
    </GamePanel>
  )

  if (!items.length) return (
    <GamePanel title="Daily Riddle" onExit={onExit}>
      <div className="game-loading">No riddles found.</div>
    </GamePanel>
  )

  const riddle = items[dayOfYear() % items.length]

  const handleReveal = () => {
    setRevealed(true)
    if (!alreadySolved) {
      const { streak, lastDate } = loadStreak()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`
      const newStreak = lastDate === yStr ? streak + 1 : 1
      setStreak(newStreak)
      setAlreadySolved(true)
      saveStreak(newStreak, todayStr())
    }
  }

  const handleHide = () => setRevealed(false)

  return (
    <GamePanel title="Daily Riddle" onExit={onExit}>
      <div className="riddle-page">
        <div className="riddle-streak">
          <IconFlame size={18} /> {streak} day streak
        </div>

        <div className="riddle-card">
          <div className="riddle-label">Today's Riddle</div>
          <p className="riddle-question">{riddle.question}</p>

          {!revealed ? (
            <button className="riddle-reveal-btn" onClick={handleReveal}>
              Reveal Answer
            </button>
          ) : (
            <div className="riddle-answer-block">
              <div className="riddle-answer-label">Answer</div>
              <div className="riddle-answer">{riddle.answer}</div>
              <button className="riddle-hide-btn" onClick={handleHide}>Hide Answer</button>
            </div>
          )}
        </div>

        <p className="riddle-hint">A new riddle every day at midnight.</p>
      </div>
    </GamePanel>
  )
}
