import { needsSave, type Digit, type Game } from '@sudoku/core'
import { CLOCK_INTERVAL_MS, MAX_ELAPSED_MS } from '@/game/constants/game.constants'
import {
  reduceSession,
  startSession,
  type GameStart,
  type HintCardAction,
  type Session,
  type SessionAction,
} from './session.utils'

/** The moves of the player. The object keeps its identity for the whole game. */
export type GameActions = {
  select(cell: number): void
  digit(digit: Digit): void
  erase(): void
  undo(): void
  hint(): void
  /** The buttons of the hint card and the hint strip. */
  hintCard(action: HintCardAction): void
  toggleNotesMode(): void
  pause(): void
  resume(): void
}

/** Stores the game in progress. It returns at once and never throws: the UI never waits for a save. */
export type SaveGame = (game: Game) => void

/**
 * One game in progress, without React. The snapshot and subscribe pair fits React useSyncExternalStore.
 * The session keeps the order that a save needs: it counts the time first, then pauses, then saves.
 */
export type GameSession = {
  /** The same object until an action changes the session. */
  getSnapshot(): Session
  subscribe(listener: () => void): () => void
  actions: GameActions
  /**
   * Starts the clock and sends the saves. Without it, the session has no clock and saves nothing.
   * A save follows each move that needsSave counts. The returned function counts the last slice of time,
   * saves the game once more when it changed, and stops the clock (QR-11).
   * save null runs the clock only.
   */
  attach(save: SaveGame | null): () => void
  /**
   * The app left the foreground: counts the time, pauses the game and saves the paused game.
   * The game stays paused until the player resumes it.
   */
  background(): void
}

export function createGameSession(start: GameStart): GameSession {
  let session = startSession(start)
  const listeners = new Set<() => void>()
  let attached = false
  let save: SaveGame | null = null
  let lastSaved = session.game
  // timer is null while the clock does not run. last is the time of the last report.
  let timer: ReturnType<typeof setInterval> | null = null
  let last = 0

  const saveGame = () => {
    if (save === null || session.game === lastSaved) return
    lastSaved = session.game
    save(session.game)
  }

  const syncClock = () => {
    const running = attached && session.game.status === 'playing'
    if (running && timer === null) {
      last = Date.now()
      timer = setInterval(flushClock, CLOCK_INTERVAL_MS)
    } else if (!running && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const dispatch = (action: SessionAction) => {
    const previous = session
    session = reduceSession(session, action)
    if (session === previous) return
    syncClock()
    if (save !== null && needsSave(lastSaved, session.game)) saveGame()
    listeners.forEach((listener) => listener())
  }

  function flushClock() {
    if (timer === null) return
    const now = Date.now()
    const elapsedMs = Math.min(now - last, MAX_ELAPSED_MS)
    last = now
    dispatch({ type: 'tick', elapsedMs })
  }

  // The flush comes first: the core ignores a tick once the game is paused.
  const pause = () => {
    flushClock()
    dispatch({ type: 'pause' })
  }

  const actions: GameActions = {
    select: (cell) => dispatch({ type: 'select', cell }),
    digit: (digit) => dispatch({ type: 'digit', digit }),
    erase: () => dispatch({ type: 'erase' }),
    undo: () => dispatch({ type: 'undo' }),
    hint: () => dispatch({ type: 'hint' }),
    hintCard: (type) => dispatch({ type }),
    toggleNotesMode: () => dispatch({ type: 'toggleNotesMode' }),
    pause,
    resume: () => dispatch({ type: 'resume' }),
  }

  return {
    getSnapshot: () => session,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    actions,
    attach(nextSave) {
      attached = true
      save = nextSave
      syncClock()
      return () => {
        flushClock()
        saveGame()
        attached = false
        save = null
        syncClock()
      }
    },
    background() {
      pause()
      saveGame()
    },
  }
}
