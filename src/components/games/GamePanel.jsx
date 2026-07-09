export default function GamePanel({ title, score, status, onRestart, onExit, children }) {
  return (
    <div className="game-panel">
      <div className="game-panel-header">
        <button className="game-panel-back" onClick={onExit}>← Games</button>
        <h2 className="game-panel-title">{title}</h2>
        <div className="game-panel-actions">
          {score != null && (
            <span className="game-panel-score">Score: <strong>{score}</strong></span>
          )}
          {status && <span className="game-panel-status">{status}</span>}
          {onRestart && (
            <button className="game-panel-btn" onClick={onRestart}>Restart</button>
          )}
        </div>
      </div>
      <div className="game-panel-body">{children}</div>
    </div>
  )
}
