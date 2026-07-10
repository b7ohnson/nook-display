import { useState, useMemo } from 'react'
import GamePanel from './GamePanel'
import { useGameContent } from '../../hooks/useGameContent'
import { IconStar } from '../Icons'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function WouldYouRather({ onExit }) {
  const { items, loading } = useGameContent('wouldYouRather')

  const prompts = useMemo(() => shuffle(items), [items])

  const [index, setIndex]       = useState(0)
  const [votesA, setVotesA]     = useState(0)
  const [votesB, setVotesB]     = useState(0)
  const [revealed, setRevealed] = useState(false)

  const total = votesA + votesB
  const pctA  = total > 0 ? Math.round((votesA / total) * 100) : 0
  const pctB  = total > 0 ? Math.round((votesB / total) * 100) : 0

  const vote = (side) => {
    if (side === 'A') setVotesA(v => v + 1)
    else              setVotesB(v => v + 1)
    setRevealed(true)
  }

  const next = () => {
    setIndex(i => i + 1)
    setVotesA(0)
    setVotesB(0)
    setRevealed(false)
  }

  const restart = () => {
    setIndex(0)
    setVotesA(0)
    setVotesB(0)
    setRevealed(false)
  }

  if (loading) return (
    <GamePanel title="Would You Rather" onExit={onExit}>
      <div className="game-loading">Loading prompts…</div>
    </GamePanel>
  )

  if (!prompts.length) return (
    <GamePanel title="Would You Rather" onExit={onExit}>
      <div className="game-loading">No prompts found.</div>
    </GamePanel>
  )

  if (index >= prompts.length) return (
    <GamePanel title="Would You Rather" onExit={onExit}>
      <div className="wyr-done">
        <div className="wyr-done-icon"><IconStar size={48} /></div>
        <div className="wyr-done-title">You've seen them all!</div>
        <div className="wyr-done-sub">{prompts.length} prompts completed</div>
        <button className="wyr-restart-btn" onClick={restart}>Start Over</button>
      </div>
    </GamePanel>
  )

  const p = prompts[index]

  return (
    <GamePanel title="Would You Rather" status={`${index + 1} / ${prompts.length}`} onExit={onExit}>
      <div className="wyr-page">
        <div className="wyr-label">Would you rather…</div>

        <div className="wyr-options">
          <button
            className={`wyr-option wyr-option--a ${revealed ? 'wyr-option--voted' : ''}`}
            onClick={() => vote('A')}
            disabled={revealed}
          >
            <span className="wyr-opt-letter">A</span>
            <span className="wyr-opt-text">{p.optionA}</span>
            {revealed && (
              <div className="wyr-tally">
                <div className="wyr-tally-bar" style={{ width: `${pctA}%` }} />
                <span className="wyr-tally-pct">{votesA} {votesA === 1 ? 'vote' : 'votes'} — {pctA}%</span>
              </div>
            )}
          </button>

          <div className="wyr-or">OR</div>

          <button
            className={`wyr-option wyr-option--b ${revealed ? 'wyr-option--voted' : ''}`}
            onClick={() => vote('B')}
            disabled={revealed}
          >
            <span className="wyr-opt-letter">B</span>
            <span className="wyr-opt-text">{p.optionB}</span>
            {revealed && (
              <div className="wyr-tally">
                <div className="wyr-tally-bar wyr-tally-bar--b" style={{ width: `${pctB}%` }} />
                <span className="wyr-tally-pct">{votesB} {votesB === 1 ? 'vote' : 'votes'} — {pctB}%</span>
              </div>
            )}
          </button>
        </div>

        <div className="wyr-actions">
          <button
            className="wyr-next-btn"
            onClick={next}
            disabled={!revealed}
          >
            {index + 1 >= prompts.length ? 'Finish' : 'Next →'}
          </button>
          {revealed && total > 0 && (
            <button className="wyr-vote-again" onClick={() => setRevealed(false)}>
              + Another vote
            </button>
          )}
        </div>
      </div>
    </GamePanel>
  )
}
