const GAMES = [
  { id: 'riddles',   title: 'Daily Riddle',       desc: 'One riddle per day. Keep your streak alive.', icon: '🧩', ready: true  },
  { id: 'tetris',    title: 'Tetris',              desc: 'Classic block-stacking action.',               icon: '🟦', ready: true },
  { id: 'trivia',    title: 'Trivia',              desc: 'Test your knowledge across categories.',       icon: '❓', ready: true },
  { id: 'wyr',       title: 'Would You Rather',    desc: 'Two options. Everyone votes.',                 icon: '⚖️', ready: true },
  { id: 'showdown',  title: 'Trivia Showdown',     desc: 'Buzzer-style multiplayer trivia.',             icon: '🔔', ready: true },
  { id: 'headsup',   title: 'Heads Up',            desc: 'Tilt to guess — phone on your forehead.',     icon: '📱', ready: true },
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
            <span className="game-card-icon">{g.icon}</span>
            <span className="game-card-title">{g.title}</span>
            <span className="game-card-desc">{g.desc}</span>
            {!g.ready && <span className="game-card-badge">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
