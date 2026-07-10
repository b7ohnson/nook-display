import { useState, lazy, Suspense } from 'react'
import GamesMenu from './GamesMenu'

const DailyRiddles   = lazy(() => import('./DailyRiddles'))
const Tetris         = lazy(() => import('./Tetris'))
const Trivia         = lazy(() => import('./Trivia'))
const WouldYouRather = lazy(() => import('./WouldYouRather'))
const TriviaShowdown = lazy(() => import('./TriviaShowdown'))
const HeadsUp        = lazy(() => import('./HeadsUp'))
const Jeopardy       = lazy(() => import('./Jeopardy'))
const FamilyFeud     = lazy(() => import('./FamilyFeud'))

const GAME_MAP = {
  riddles:  DailyRiddles,
  tetris:   Tetris,
  trivia:   Trivia,
  wyr:      WouldYouRather,
  showdown: TriviaShowdown,
  headsup:  HeadsUp,
  jeopardy: Jeopardy,
  feud:     FamilyFeud,
}

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null)

  if (activeGame && GAME_MAP[activeGame]) {
    const Game = GAME_MAP[activeGame]
    return (
      <Suspense fallback={<div className="game-loading">Loading…</div>}>
        <Game onExit={() => setActiveGame(null)} />
      </Suspense>
    )
  }

  return <GamesMenu onSelect={setActiveGame} />
}
