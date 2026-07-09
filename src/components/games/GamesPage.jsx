import { useState } from 'react'
import GamesMenu from './GamesMenu'
import DailyRiddles from './DailyRiddles'
import Tetris from './Tetris'
import Trivia from './Trivia'
import WouldYouRather from './WouldYouRather'
import TriviaShowdown from './TriviaShowdown'
import HeadsUp from './HeadsUp'

const GAME_MAP = {
  riddles:  DailyRiddles,
  tetris:   Tetris,
  trivia:   Trivia,
  wyr:      WouldYouRather,
  showdown: TriviaShowdown,
  headsup:  HeadsUp,
}

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null)

  if (activeGame && GAME_MAP[activeGame]) {
    const Game = GAME_MAP[activeGame]
    return <Game onExit={() => setActiveGame(null)} />
  }

  return <GamesMenu onSelect={setActiveGame} />
}
