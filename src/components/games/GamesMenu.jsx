import {
  IconPuzzle, IconBlocks, IconHelpCircle,
  IconScale, IconZap, IconSmartphone,
  IconDollarSign, IconMic,
} from '../Icons'

const GAMES = [
  { id: 'riddles',  title: 'Daily Riddle',       desc: 'One riddle per day. Keep your streak alive.', Icon: IconPuzzle,      ready: true },
  { id: 'tetris',   title: 'Tetris',              desc: 'Classic block-stacking action.',               Icon: IconBlocks,      ready: true },
  { id: 'trivia',   title: 'Trivia',              desc: 'Test your knowledge across categories.',       Icon: IconHelpCircle,  ready: true },
  { id: 'wyr',      title: 'Would You Rather',    desc: 'Two options. Everyone votes.',                 Icon: IconScale,       ready: true },
  { id: 'showdown', title: 'Trivia Showdown',     desc: 'Buzzer-style multiplayer trivia.',             Icon: IconZap,         ready: true },
  { id: 'headsup',  title: 'Heads Up',            desc: 'Tilt to guess — phone on your forehead.',     Icon: IconSmartphone,  ready: true },
  { id: 'jeopardy', title: 'Jeopardy!',           desc: '6 categories, daily doubles, and team scoring.', Icon: IconDollarSign, ready: true },
  { id: 'feud',     title: 'Family Feud',         desc: 'Survey says! Two families battle it out.',    Icon: IconMic,         ready: true },
]

export default function GamesMenu({ onSelect }) {
  return (
    <div className="games-menu">
      <h1 className="games-menu-title">Games</h1>
      <p className="games-menu-sub">Pick a game to play together.</p>
      <div className="games-grid">
        {GAMES.map(g => (
          <button
            key={g.id}
            className={`game-card ${!g.ready ? 'game-card--soon' : ''}`}
            onClick={() => g.ready && onSelect(g.id)}
            disabled={!g.ready}
          >
            <span className="game-card-icon"><g.Icon size={32} /></span>
            <span className="game-card-title">{g.title}</span>
            <span className="game-card-desc">{g.desc}</span>
            {!g.ready && <span className="game-card-badge">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
