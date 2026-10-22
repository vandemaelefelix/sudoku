import { createGame, type Game, type Level, type NewGame, type Random } from '@sudoku/core'
import type { PuzzleRepository, PuzzleSource, SavedProgress } from '@/storage'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { startMeasures } from '@/utils/measure.utils'
import { newGeneratedGame, scannedLevel } from './start.utils'

type PuzzleStartDeps = {
  puzzles: PuzzleRepository
  /** The Clerk user ID at the start, or null when signed out. The replaced game, when abandoned, gets it (ADR-028). */
  owner: string | null
  /** The question before a new game ends the game in progress. It resolves true for New game. */
  confirmReplace(): Promise<boolean>
  random?: Random
}

/**
 * Each start gives the new game in progress, or null. null means that the player cancelled, that another start
 * runs, or that the start failed. A failure writes a warning, so a caller shows no error and keeps its screen.
 * opened runs when the repository knows the new game and the write still runs. A caller navigates there.
 */
export type PuzzleStart = {
  /** A generated puzzle of the level. Asks first when a game is in progress. */
  newGame(level: Level, opened?: () => void): Promise<SavedProgress | null>
  /** A scanned grid, at the level of its grade. Asks first when a game is in progress. */
  playScan(grid: Required<NewGame>, opened?: () => void): Promise<SavedProgress | null>
  /** A generated puzzle at the level of a game that is over. It does not ask. */
  newPuzzle(from: SavedProgress): Promise<SavedProgress | null>
  /**
   * The puzzle of a game that is over, from its first state. It does not ask.
   * The retry is a new game in progress with a new id and the same seed. The earlier game stays one history entry.
   */
  retry(from: SavedProgress): Promise<SavedProgress | null>
}

type Request = { level: Level; source: PuzzleSource; seed: number | null; game: Game }

// QR-12 counts from the tap. A start that gives no game must not leave its mark for a later board.
async function measuredStart(level: Level, start: () => Promise<SavedProgress | null>): Promise<SavedProgress | null> {
  startMeasures.levelTapped(level)
  const started = await start()
  if (started === null) startMeasures.tapCancelled()
  return started
}

/**
 * The one way to start a game (ADR-012, ADR-023). It owns the order: ask, make the game, start, tell the caller.
 * PuzzleRepository.start records the game before it as abandoned, so every start calls it once and only after the answer.
 * One start runs at a time, because start() discards the game before it and a second tap must not start a second game.
 */
export function createPuzzleStart({
  puzzles,
  owner,
  confirmReplace,
  random = Math.random,
}: PuzzleStartDeps): PuzzleStart {
  let busy = false

  async function run(
    make: () => Request,
    { ask, opened }: { ask: boolean; opened?: (() => void) | undefined },
  ): Promise<SavedProgress | null> {
    if (busy) return null
    busy = true
    try {
      if (ask) {
        // Ask from the stored state at the tap. peek() follows the last read, so the tap waits for no read.
        const known = puzzles.peek()
        const current = known === undefined ? await puzzles.current() : known
        if (current !== null) {
          if (!(await confirmReplace())) return null
          startMeasures.replaceConfirmed()
        }
      }
      const starting = puzzles.start({ ...make(), owner })
      // The game screen opens on peek() while the write runs, so the caller can navigate at once.
      try {
        opened?.()
      } catch (error) {
        // The game did start. A failed navigation is not a failed start, so the start still resolves.
        devWarn('navigation', `The game screen does not open: ${errorMessage(error)}`)
      }
      return await starting
    } catch (error) {
      devWarn('storage', `The game does not start: ${errorMessage(error)}`)
      return null
    } finally {
      busy = false
    }
  }

  const generated = (level: Level): Request => {
    const started = Date.now()
    const made = newGeneratedGame(level, random)
    startMeasures.generated(level, Date.now() - started)
    return { level, source: 'generated', ...made }
  }

  return {
    newGame: (level, opened) => measuredStart(level, () => run(() => generated(level), { ask: true, opened })),
    playScan: (grid, opened) =>
      run(() => ({ level: scannedLevel(grid.givens), source: 'scanned', seed: null, game: createGame(grid) }), {
        ask: true,
        opened,
      }),
    newPuzzle: ({ level }) => measuredStart(level, () => run(() => generated(level), { ask: false })),
    retry: ({ level, source, seed, game }) =>
      run(
        () => ({
          level,
          source,
          seed,
          game: createGame({ givens: game.givens, solution: game.solution, entries: game.startEntries }),
        }),
        { ask: false },
      ),
  }
}
