import { useState } from 'react'
import GamesMenu from './GamesMenu'
import DailyRiddles from './DailyRiddles'
import Tetris from './Tetris'
import Trivia from './Trivia'
import WouldYouRather from './WouldYouRather'
import TriviaShowdown from './TriviaShowdown'
import HeadsUp from './HeadsUp'
import Jeopardy from './Jeopardy'
import FamilyFeud from './FamilyFeud'

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
    return <Game onExit={() => setActiveGame(null)} />
  }

  return <GamesMenu onSelect={setActiveGame} />
}
