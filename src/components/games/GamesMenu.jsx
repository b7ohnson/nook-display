import {
  IconPuzzle, IconBlocks, IconHelpCircle,
  IconScale, IconZap, IconSmartphone,
  IconDollarSign, IconMic,
} from '../Icons'

const GAMES = [
  { id: 'riddles',  title: 'Daily Riddle',       desc: 'A new riddle each day, and a streak for solving them in a row.', Icon: IconPuzzle,      ready: true },
  { id: 'tetris',   title: 'Tetris',              desc: 'Stack the falling blocks. It speeds up every ten lines.',               Icon: IconBlocks,      ready: true },
  { id: 'trivia',   title: 'Trivia',              desc: 'Fifteen questions on your own, against the clock.',       Icon: IconHelpCircle,  ready: true },
  { id: 'wyr',      title: 'Would You Rather',    desc: 'Two choices, everyone picks one, then argue about it.',                 Icon: IconScale,       ready: true },
  { id: 'showdown', title: 'Trivia Showdown',     desc: 'Everyone answers on their phone. Faster answers score more.',             Icon: IconZap,         ready: true },
  { id: 'headsup',  title: 'Heads Up',            desc: 'Phone on your forehead, the room gives you clues.',     Icon: IconSmartphone,  ready: true },
  { id: 'jeopardy', title: 'Jeopardy!',           desc: 'Teams pick from six categories. Two Daily Doubles hide on the board.', Icon: IconDollarSign, ready: true },
  { id: 'feud',     title: 'Family Feud',         desc: 'Two families guess the top survey answers, then Fast Money.',    Icon: IconMic,         ready: true },
]

export default function GamesMenu({ onSelect }) {
  return (
    <div className="games-menu">
      <h1 className="games-menu-title">Games</h1>
      <div className="games-grid">
        {GAMES.map(g => (
          <button
            key={g.id}
            className={`game-card ${!g.ready ? 'game-card--soon' : ''}`}
            onClick={() => g.ready && onSelect(g.id)}
            disabled={!g.ready}
            aria-label={`${g.title}. ${g.desc}`}
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
