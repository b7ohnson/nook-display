import { useRef, useEffect, useState, useCallback } from 'react'
import GamePanel from './GamePanel'
import Leaderboard from './Leaderboard'
import { useLeaderboard } from '../../hooks/useLeaderboard'

const COLS = 10, ROWS = 20, BLOCK = 28, NEXT_BLOCK = 22

const PIECES = [
  { shape: [[1,1,1,1]],          color: '#00d4d4' }, // I
  { shape: [[1,1],[1,1]],        color: '#d4d400' }, // O
  { shape: [[0,1,0],[1,1,1]],    color: '#9000d4' }, // T
  { shape: [[0,1,1],[1,1,0]],    color: '#00c400' }, // S
  { shape: [[1,1,0],[0,1,1]],    color: '#d40000' }, // Z
  { shape: [[1,0,0],[1,1,1]],    color: '#0060d4' }, // J
  { shape: [[0,0,1],[1,1,1]],    color: '#d47000' }, // L
]

const SCORE_TABLE = [0, 100, 300, 500, 800]

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0))
}

function randPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)]
  const shape = p.shape.map(r => [...r])
  return { shape, color: p.color, x: Math.floor((COLS - shape[0].length) / 2), y: -1 }
}

function rotate90(shape) {
  const rows = shape.length, cols = shape[0].length
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  )
}

function collides(board, shape, x, y) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        if (x + c < 0 || x + c >= COLS || y + r >= ROWS) return true
        if (y + r >= 0 && board[y + r][x + c]) return true
      }
  return false
}

function lockPiece(board, piece) {
  const b = board.map(r => [...r])
  piece.shape.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell && piece.y + r >= 0) b[piece.y + r][piece.x + c] = piece.color
    })
  )
  return b
}

function clearLines(board) {
  const kept = board.filter(row => row.some(c => !c))
  const cleared = ROWS - kept.length
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(0))
  return { board: [...empty, ...kept], cleared }
}

function dropMs(level) {
  return Math.max(80, 800 - (level - 1) * 75)
}

function drawBlock(ctx, px, py, color, sz) {
  ctx.fillStyle = color
  ctx.fillRect(px + 1, py + 1, sz - 2, sz - 2)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(px + 1, py + 1, sz - 2, 3)
  ctx.fillRect(px + 1, py + 1, 3, sz - 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(px + 1, py + sz - 4, sz - 2, 3)
  ctx.fillRect(px + sz - 4, py + 1, 3, sz - 2)
}

export default function Tetris({ onExit }) {
  const canvasRef = useRef(null)
  const nextRef   = useRef(null)
  const loopRef   = useRef(null)
  const gsRef     = useRef(null)
  const tickRef   = useRef(null)

  const [status, setStatus] = useState('idle')
  const [score,  setScore]  = useState(0)
  const [lines,  setLines]  = useState(0)
  const [level,  setLevel]  = useState(1)
  const [name,   setName]   = useState('')
  const [saved,  setSaved]  = useState(false)
  const [showLB, setShowLB] = useState(false)

  const { addScore } = useLeaderboard('tetris')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const nextCanvas = nextRef.current
    const gs = gsRef.current
    if (!canvas || !gs) return

    const ctx = canvas.getContext('2d')
    const W = COLS * BLOCK, H = ROWS * BLOCK

    ctx.fillStyle = '#111318'
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, H); ctx.stroke()
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(W, r * BLOCK); ctx.stroke()
    }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (gs.board[r][c]) drawBlock(ctx, c * BLOCK, r * BLOCK, gs.board[r][c], BLOCK)

    if (gs.current && gs.status === 'playing') {
      let gy = gs.current.y
      while (!collides(gs.board, gs.current.shape, gs.current.x, gy + 1)) gy++
      ctx.globalAlpha = 0.2
      gs.current.shape.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell && gy + r >= 0) drawBlock(ctx, (gs.current.x + c) * BLOCK, (gy + r) * BLOCK, gs.current.color, BLOCK)
        })
      )
      ctx.globalAlpha = 1
    }

    if (gs.current) {
      gs.current.shape.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell && gs.current.y + r >= 0)
            drawBlock(ctx, (gs.current.x + c) * BLOCK, (gs.current.y + r) * BLOCK, gs.current.color, BLOCK)
        })
      )
    }

    if (nextCanvas && gs.next) {
      const nctx = nextCanvas.getContext('2d')
      nctx.fillStyle = '#111318'
      nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height)
      const s = gs.next.shape
      const ox = Math.floor((nextCanvas.width  - s[0].length * NEXT_BLOCK) / 2)
      const oy = Math.floor((nextCanvas.height - s.length    * NEXT_BLOCK) / 2)
      s.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell) drawBlock(nctx, ox + c * NEXT_BLOCK, oy + r * NEXT_BLOCK, gs.next.color, NEXT_BLOCK)
        })
      )
    }
  }, [])

  // tickRef updated every render so it always has fresh closures
  useEffect(() => {
    tickRef.current = function tick() {
      const gs = gsRef.current
      if (!gs || gs.status !== 'playing') return

      const dropped = { ...gs.current, y: gs.current.y + 1 }
      if (!collides(gs.board, dropped.shape, dropped.x, dropped.y)) {
        gs.current = dropped
      } else {
        const newBoard = lockPiece(gs.board, gs.current)
        const { board: clearedBoard, cleared } = clearLines(newBoard)
        const newLines = gs.lines + cleared
        const newLevel = Math.floor(newLines / 10) + 1

        gs.score += SCORE_TABLE[cleared] * gs.level
        gs.lines  = newLines
        gs.level  = newLevel
        gs.board  = clearedBoard

        const newCurrent = gs.next
        gs.next = randPiece()

        if (collides(clearedBoard, newCurrent.shape, newCurrent.x, newCurrent.y)) {
          gs.status  = 'gameover'
          gs.current = null
          clearInterval(loopRef.current)
          setStatus('gameover')
        } else {
          gs.current = newCurrent
          if (newLevel !== gs.level - (gs.lines - newLines) / 10) {
            clearInterval(loopRef.current)
            loopRef.current = setInterval(() => tickRef.current(), dropMs(newLevel))
          }
        }

        setScore(gs.score)
        setLines(gs.lines)
        setLevel(gs.level)
      }
      draw()
    }
  })

  const startLoop = useCallback((lvl) => {
    clearInterval(loopRef.current)
    loopRef.current = setInterval(() => tickRef.current(), dropMs(lvl))
  }, [])

  const startGame = useCallback(() => {
    clearInterval(loopRef.current)
    const current = randPiece()
    const next    = randPiece()
    gsRef.current = { board: emptyBoard(), current, next, score: 0, lines: 0, level: 1, status: 'playing' }
    setScore(0); setLines(0); setLevel(1); setStatus('playing'); setSaved(false); setShowLB(false)
    setTimeout(() => { startLoop(1); draw() }, 0)
  }, [startLoop, draw])

  useEffect(() => {
    gsRef.current = { board: emptyBoard(), current: null, next: randPiece(), score: 0, lines: 0, level: 1, status: 'idle' }
    setTimeout(() => draw(), 0)
    return () => clearInterval(loopRef.current)
  }, [draw])

  useEffect(() => {
    const onKey = (e) => {
      const gs = gsRef.current
      if (!gs) return

      if (e.key === 'p' || e.key === 'P') {
        if (gs.status === 'playing') {
          gs.status = 'paused'
          clearInterval(loopRef.current)
          setStatus('paused')
        } else if (gs.status === 'paused') {
          gs.status = 'playing'
          startLoop(gs.level)
          setStatus('playing')
        }
        return
      }

      if (gs.status !== 'playing' || !gs.current) return

      let moved = null

      if (e.key === 'ArrowLeft') {
        moved = { ...gs.current, x: gs.current.x - 1 }
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        moved = { ...gs.current, x: gs.current.x + 1 }
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        moved = { ...gs.current, y: gs.current.y + 1 }
        if (!collides(gs.board, moved.shape, moved.x, moved.y)) {
          gs.score += 1; setScore(gs.score)
        }
        e.preventDefault()
      } else if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
        const rotated = rotate90(gs.current.shape)
        const kicks = [0, 1, -1, 2, -2]
        for (const k of kicks) {
          if (!collides(gs.board, rotated, gs.current.x + k, gs.current.y)) {
            moved = { ...gs.current, shape: rotated, x: gs.current.x + k }
            break
          }
        }
        e.preventDefault()
      } else if (e.key === ' ') {
        let dy = 0
        while (!collides(gs.board, gs.current.shape, gs.current.x, gs.current.y + dy + 1)) dy++
        gs.score += dy * 2; setScore(gs.score)
        gs.current = { ...gs.current, y: gs.current.y + dy }
        tickRef.current()
        e.preventDefault()
        return
      }

      if (moved && !collides(gs.board, moved.shape, moved.x, moved.y)) {
        gs.current = moved
        draw()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startLoop, draw])

  const touch = useCallback((dir) => {
    const gs = gsRef.current
    if (!gs || gs.status !== 'playing' || !gs.current) return

    if (dir === 'left') {
      const m = { ...gs.current, x: gs.current.x - 1 }
      if (!collides(gs.board, m.shape, m.x, m.y)) { gs.current = m; draw() }
    } else if (dir === 'right') {
      const m = { ...gs.current, x: gs.current.x + 1 }
      if (!collides(gs.board, m.shape, m.x, m.y)) { gs.current = m; draw() }
    } else if (dir === 'down') {
      const m = { ...gs.current, y: gs.current.y + 1 }
      if (!collides(gs.board, m.shape, m.x, m.y)) { gs.current = m; gs.score += 1; setScore(gs.score); draw() }
    } else if (dir === 'rotate') {
      const rotated = rotate90(gs.current.shape)
      const kicks = [0, 1, -1, 2, -2]
      for (const k of kicks) {
        if (!collides(gs.board, rotated, gs.current.x + k, gs.current.y)) {
          gs.current = { ...gs.current, shape: rotated, x: gs.current.x + k }; draw(); break
        }
      }
    } else if (dir === 'drop') {
      let dy = 0
      while (!collides(gs.board, gs.current.shape, gs.current.x, gs.current.y + dy + 1)) dy++
      gs.score += dy * 2; setScore(gs.score)
      gs.current = { ...gs.current, y: gs.current.y + dy }
      tickRef.current()
    }
  }, [draw])

  const handleSave = async () => {
    if (!name.trim() || saved) return
    await addScore({ playerName: name.trim(), score })
    setSaved(true)
  }

  return (
    <GamePanel title="Tetris" onExit={onExit}>
      <div className="tetris-layout">
        <div className="tetris-canvas-wrap">
          <canvas ref={canvasRef} width={COLS * BLOCK} height={ROWS * BLOCK} className="tetris-canvas" />

          {status === 'idle' && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-title">TETRIS</div>
              <button className="tetris-start-btn" onClick={startGame}>▶ Play</button>
            </div>
          )}

          {status === 'paused' && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-title">PAUSED</div>
              <button className="tetris-start-btn" onClick={() => {
                if (!gsRef.current) return
                gsRef.current.status = 'playing'
                setStatus('playing')
                startLoop(gsRef.current.level)
              }}>▶ Resume</button>
            </div>
          )}

          {status === 'gameover' && (
            <div className="tetris-overlay tetris-overlay--go">
              <div className="tetris-overlay-title">GAME OVER</div>
              <div className="tetris-final-score">{score.toLocaleString()}</div>
              <div className="tetris-final-sub">Level {level} · {lines} lines</div>
              {!saved ? (
                <div className="tetris-save-form">
                  <input
                    className="tetris-name-input"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    maxLength={20}
                  />
                  <button className="tetris-save-btn" onClick={handleSave} disabled={!name.trim()}>Save Score</button>
                </div>
              ) : (
                <div className="tetris-saved">✓ Score saved!</div>
              )}
              <button className="tetris-start-btn" onClick={startGame}>Play Again</button>
              <button className="tetris-lb-toggle" onClick={() => setShowLB(v => !v)}>
                {showLB ? 'Hide Leaderboard' : '🏆 Leaderboard'}
              </button>
              {showLB && <Leaderboard game="tetris" />}
            </div>
          )}
        </div>

        <div className="tetris-sidebar">
          <div className="tetris-stat-box">
            <div className="tetris-stat-label">NEXT</div>
            <canvas ref={nextRef} width={5 * NEXT_BLOCK} height={4 * NEXT_BLOCK} className="tetris-next-canvas" />
          </div>
          <div className="tetris-stat-box">
            <div className="tetris-stat-label">SCORE</div>
            <div className="tetris-stat-val">{score.toLocaleString()}</div>
          </div>
          <div className="tetris-stat-box">
            <div className="tetris-stat-label">LEVEL</div>
            <div className="tetris-stat-val">{level}</div>
          </div>
          <div className="tetris-stat-box">
            <div className="tetris-stat-label">LINES</div>
            <div className="tetris-stat-val">{lines}</div>
          </div>
          <div className="tetris-hint-box">
            <div className="tetris-hint-row"><kbd>←→</kbd> Move</div>
            <div className="tetris-hint-row"><kbd>↑</kbd> Rotate</div>
            <div className="tetris-hint-row"><kbd>↓</kbd> Soft drop</div>
            <div className="tetris-hint-row"><kbd>Spc</kbd> Hard drop</div>
            <div className="tetris-hint-row"><kbd>P</kbd> Pause</div>
          </div>
        </div>
      </div>

      <div className="tetris-touch-controls">
        <button className="tetris-touch-btn" onPointerDown={() => touch('left')}>◀</button>
        <button className="tetris-touch-btn" onPointerDown={() => touch('rotate')}>↻</button>
        <button className="tetris-touch-btn" onPointerDown={() => touch('down')}>▼</button>
        <button className="tetris-touch-btn" onPointerDown={() => touch('right')}>▶</button>
        <button className="tetris-touch-drop" onPointerDown={() => touch('drop')}>Drop ▼▼</button>
      </div>
    </GamePanel>
  )
}
