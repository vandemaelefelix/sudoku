import { createGame, type Game } from '@sudoku/core'
import { reduceSession, startSession, type Session, type SessionAction } from '@/game/utils/session.utils'
import { sampleStart } from '@/game/utils/sample.utils'

/** Cell 2 is empty in the canvas puzzle. Its solution is 4. */
export const OPEN = 2

export const sampleGame = (): Game => createGame(sampleStart())

export const sampleSession = (): Session => startSession(sampleStart())

export const runSession = (session: Session, ...actions: SessionAction[]): Session =>
  actions.reduce(reduceSession, session)

/** The game of the canvas puzzle after the actions. */
export const sampleGameAfter = (...actions: SessionAction[]): Game => runSession(sampleSession(), ...actions).game
