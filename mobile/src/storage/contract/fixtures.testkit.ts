import { createGame, fillHint, planHint, place, select, tick, type Game } from '@sudoku/core'
import type { GameStorage } from '@/storage/gameStorage.types'
import type { SyncPageInput } from '@/storage/HistoryRepository'
import type { HistoryRecord, Level, PuzzleSource, StorageDeps } from '@/storage/storage.types'
import { toWireEntry } from '@/storage/wireEntry'

/** Opens a fresh storage on the given clock and id source. Each implementation under test gives one. */
export type StorageOpener = (deps: StorageDeps) => Promise<GameStorage>

// The puzzle of the design canvas. Cell 2 is empty and needs a 4.
const GIVENS = digits('530070000600195000098000060800060003400803001700020006060000280000419005000080079')
const SOLUTION = digits('534678912672195348198342567859761423426853791713924856961537284287419635345286179')

function digits(text: string): number[] {
  return [...text].map(Number)
}

export function newGame(): Game {
  return createGame({ givens: GIVENS, solution: SOLUTION })
}

/** Every open cell is filled except cell 2. */
export function nearlyWon(): Game {
  const entries = SOLUTION.map((digit, cell) => (GIVENS[cell] === 0 && cell !== 2 ? digit : 0))
  return select(createGame({ givens: GIVENS, solution: SOLUTION, entries }), 2)
}

export function wonGame(playedMs: number): Game {
  return place(tick(nearlyWon(), playedMs), 4).game
}

/** The last cell filled by a hint. */
export function wonWithHint(playedMs: number): Game {
  const game = tick(nearlyWon(), playedMs)
  const plan = planHint(game)
  if (plan === null) throw new Error('The nearly won game has an open cell')
  return fillHint(game, plan, []).game
}

/** One mistake, then the right number in cell 2. The mistake is set directly: place refuses a complete digit, and only 4 is open. */
export function wonWithMistake(playedMs: number): Game {
  return place({ ...tick(nearlyWon(), playedMs), mistakes: 1 }, 4).game
}

/** A game in progress that has one move and no mistake. */
export function movedGame(playedMs = 61_000): Game {
  return place(select(tick(newGame(), playedMs), 2), 4).game
}

/** Three wrong numbers in cell 2. */
export function lostGame(playedMs: number): Game {
  let game = select(tick(newGame(), playedMs), 2)
  for (const digit of [1, 2, 3] as const) game = place(game, digit).game
  return game
}

/** An id that the sync contract accepts. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function testDeps(): StorageDeps {
  let ids = 0
  let seconds = 0
  return {
    newId: () => uuid(++ids),
    now: () => new Date(Date.UTC(2026, 9, 12, 9, 0, seconds++)).toISOString(),
  }
}

export const ALICE = 'user-alice'
export const BOB = 'user-bob'
export const GENERATED = { includeScanned: false, owner: null }
export const WITH_SCANNED = { includeScanned: true, owner: null }

export async function finishGame(
  storage: GameStorage,
  level: Level,
  game: Game,
  source: PuzzleSource = 'generated',
  owner: string | null = null,
): Promise<string> {
  const { id } = await storage.puzzles.start({ level, source, game: newGame(), owner })
  await storage.puzzles.save(id, game, owner)
  return id
}

/** The one item of a list. Fails the test when the list does not have exactly one item. */
export function single<T>(items: readonly T[]): T {
  const [item] = items
  if (items.length !== 1 || item === undefined) throw new Error(`Expected one item, got ${items.length}`)
  return item
}

/** A history entry as the server sends it. Its id does not clash with the ids of `testDeps`. */
export function remote(n: number, changes: Partial<HistoryRecord> = {}): HistoryRecord {
  const at = '2026-10-01T09:00:00.000Z'
  return {
    id: uuid(900 + n),
    level: 'easy',
    source: 'generated',
    seed: null,
    result: 'won',
    playedMs: 60_000,
    mistakes: 0,
    hintsUsed: 0,
    finishedAt: at,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    ...changes,
  }
}

/** Gives `owner` a saved cursor, as a page of the server does. Tests need it to set up the sync state. */
export async function seedCursor(storage: GameStorage, owner: string, cursor: string): Promise<void> {
  await storage.history.applySyncPage({ owner, sent: [], acceptedIds: [], changes: [], cursor })
}

/** An answer of the server that takes the entries it got and sends nothing. */
export function accepting(owner: string, sent: readonly HistoryRecord[]): SyncPageInput {
  return { owner, sent, acceptedIds: sent.map((record) => record.id), changes: [], cursor: 'cursor' }
}

/** An answer of the server that sends these entries and takes none. */
export function sending(owner: string, records: readonly HistoryRecord[]): SyncPageInput {
  return { owner, sent: [], acceptedIds: [], changes: records.map(toWireEntry), cursor: 'cursor' }
}

export async function batchIds(storage: GameStorage, owner: string): Promise<string[]> {
  return (await storage.history.nextBatch(owner)).map((record) => record.id)
}

/** Storage whose clock the test sets, so a win lands on a chosen day. */
export async function clocked(open: StorageOpener) {
  let nowIso = '2026-10-10T09:00:00.000Z'
  let ids = 0
  const clockedStorage = await open({ newId: () => uuid(++ids), now: () => nowIso })
  return {
    storage: clockedStorage,
    setNow: (iso: string) => {
      nowIso = iso
    },
  }
}
