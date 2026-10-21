import { countsForBestTime, createGame, hint, place, select, tick, type Game } from '@sudoku/core'
import type { GameStorage } from './gameStorage.types'
import type { HistoryRecord, Level, PuzzleSource, StorageDeps } from './storage.types'

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
function nearlyWon(): Game {
  const entries = SOLUTION.map((digit, cell) => (GIVENS[cell] === 0 && cell !== 2 ? digit : 0))
  return select(createGame({ givens: GIVENS, solution: SOLUTION, entries }), 2)
}

export function wonGame(playedMs: number): Game {
  return place(tick(nearlyWon(), playedMs), 4).game
}

/** The last cell filled by a hint. */
export function wonWithHint(playedMs: number): Game {
  return hint(tick(nearlyWon(), playedMs), () => 0).game
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

export function testDeps(): StorageDeps {
  let ids = 0
  let seconds = 0
  return {
    newId: () => `game-${++ids}`,
    now: () => new Date(Date.UTC(2026, 9, 12, 9, 0, seconds++)).toISOString(),
  }
}

const ALICE = 'user-alice'
const BOB = 'user-bob'
const GENERATED = { includeScanned: false, owner: null }
const WITH_SCANNED = { includeScanned: true, owner: null }

async function finishGame(
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
function single<T>(items: readonly T[]): T {
  const [item] = items
  if (items.length !== 1 || item === undefined) throw new Error(`Expected one item, got ${items.length}`)
  return item
}

/** A history entry as the server sends it. */
function remote(id: string, changes: Partial<HistoryRecord> = {}): HistoryRecord {
  const at = '2026-10-01T09:00:00.000Z'
  return {
    id,
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

/** Storage whose clock the test sets, so a win lands on a chosen day. */
async function clocked(open: (deps: StorageDeps) => Promise<GameStorage>) {
  let nowIso = '2026-10-10T09:00:00.000Z'
  let ids = 0
  const clockedStorage = await open({ newId: () => `clocked-${++ids}`, now: () => nowIso })
  return {
    storage: clockedStorage,
    setNow: (iso: string) => {
      nowIso = iso
    },
  }
}

/** The rules every GameStorage keeps: the SQLite one and the in-memory fake. */
export function describeGameStorage(name: string, open: (deps: StorageDeps) => Promise<GameStorage>): void {
  describe(name, () => {
    let storage: GameStorage

    beforeEach(async () => {
      storage = await open(testDeps())
    })

    it('has no game in progress at first', async () => {
      await expect(storage.puzzles.current()).resolves.toBeNull()
    })

    it('returns the game it started', async () => {
      const game = newGame()
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game, owner: null })
      expect(started).toEqual({ id: 'game-1', level: 'easy', source: 'generated', seed: null, game })
      await expect(storage.puzzles.current()).resolves.toEqual(started)
    })

    it('peeks the game it started, saved or read, without a read', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      expect(storage.puzzles.peek()).toEqual(started)
      const moved = place(select(newGame(), 2), 4).game
      const saving = storage.puzzles.save(started.id, moved, null)
      expect(storage.puzzles.peek()?.game).toEqual(moved)
      await saving
      await expect(storage.puzzles.current()).resolves.toEqual(storage.puzzles.peek())
    })

    it('peeks a started game before its write ends', async () => {
      const starting = storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame(), owner: null })
      const peeked = storage.puzzles.peek()
      await expect(starting).resolves.toEqual(peeked)
    })

    it('peeks no game after a discard and after a finished game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.discard(first.id)
      expect(storage.puzzles.peek()).toBeNull()
      const second = await storage.puzzles.start({ level: 'hard', source: 'generated', game: nearlyWon(), owner: null })
      await storage.puzzles.save(second.id, wonGame(1_000), null)
      expect(storage.puzzles.peek()).toBeNull()
    })

    it('keeps a save in peek when a read from before the save resolves after it', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      const reading = storage.puzzles.current()
      const moved = place(select(newGame(), 2), 4).game
      await Promise.all([reading, storage.puzzles.save(id, moved, null)])
      expect(storage.puzzles.peek()?.game).toEqual(moved)
    })

    it('discards the game in progress when a new one starts', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      const second = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: newGame(), owner: null })
      await storage.puzzles.save(first.id, tick(newGame(), 5_000), null)
      await expect(storage.puzzles.current()).resolves.toEqual(second)
    })

    it('records a game as abandoned when a new game replaces it after a move', async () => {
      const first = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        seed: 77,
        game: newGame(),
        owner: null,
      })
      await storage.puzzles.save(first.id, movedGame(61_000), null)
      await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })
      await expect(storage.history.list(null)).resolves.toEqual([
        {
          id: first.id,
          level: 'easy',
          source: 'generated',
          seed: 77,
          result: 'abandoned',
          playedMs: 61_000,
          mistakes: 0,
          hintsUsed: 0,
          finishedAt: expect.any(String),
        },
      ])
    })

    it('keeps the mistakes and the hints of an abandoned game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      const wrong = place(select(newGame(), 2), 1).game
      await storage.puzzles.save(first.id, wrong, null)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      const [entry] = await storage.history.list(null)
      expect(entry).toMatchObject({ id: first.id, result: 'abandoned', mistakes: 1 })
    })

    it('records no entry for a game without a move', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(first.id, select(newGame(), 2), null)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('records no abandoned entry when a new game follows a finished game', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
      await storage.puzzles.save(first.id, wonGame(40_000), null)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      const results = (await storage.history.list(null)).map((entry) => entry.result)
      expect(results).toEqual(['won'])
    })

    it('records no entry for a game that a discard removed', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(first.id, movedGame(), null)
      await storage.puzzles.discard(first.id)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('leaves an abandoned game out of the best time', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(first.id, movedGame(5_000), null)
      await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await expect(storage.history.bestTimes(null)).resolves.toEqual({})
    })

    describe('clear', () => {
      it('removes every history entry from the list, the best times and the stats', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await finishGame(storage, 'hard', lostGame(20_000))
        await storage.history.clear(null)
        await expect(storage.history.list(null)).resolves.toEqual([])
        await expect(storage.history.bestTimes(null)).resolves.toEqual({})
        await expect(storage.stats.summary(null, WITH_SCANNED)).resolves.toMatchObject({ played: 0, abandoned: 0 })
        await expect(storage.stats.streak('UTC', WITH_SCANNED)).resolves.toMatchObject({ current: 0, longest: 0 })
      })

      it('keeps the game in progress', async () => {
        const started = await storage.puzzles.start({
          level: 'easy',
          source: 'generated',
          game: newGame(),
          owner: null,
        })
        await storage.puzzles.save(started.id, movedGame(), null)
        await storage.history.clear(null)
        await expect(storage.puzzles.current()).resolves.toMatchObject({ id: started.id })
      })

      it('counts the games that finish afterwards', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await storage.history.clear(null)
        await finishGame(storage, 'easy', wonGame(30_000))
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({ played: 1, bestMs: 30_000 })
      })
    })

    describe('owner', () => {
      it('writes the owner of the finish to the history entry', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id, result: 'won' }])
        await expect(storage.history.list(null)).resolves.toEqual([])
        await expect(storage.history.list(BOB)).resolves.toEqual([])
      })

      it('writes the owner at the finish, not the owner at the start', async () => {
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
        await storage.puzzles.save(id, lostGame(20_000), ALICE)
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id, result: 'lost' }])
        await expect(storage.history.list(null)).resolves.toEqual([])
      })

      it('gives an abandoned game the owner of the start that replaces it', async () => {
        const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
        await storage.puzzles.save(first.id, movedGame(), null)
        await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: ALICE })
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: first.id, result: 'abandoned' }])
        await expect(storage.history.list(null)).resolves.toEqual([])
      })

      it('gives the best times of one owner', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
        await finishGame(storage, 'hard', wonGame(90_000), 'generated', BOB)
        await expect(storage.history.bestTimes(ALICE)).resolves.toEqual({ easy: 60_000 })
        await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 30_000 })
        await expect(storage.history.bestTimes(BOB)).resolves.toEqual({ hard: 90_000 })
      })

      it('clears only the entries of one owner', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const unowned = await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
        await storage.history.clear(ALICE)
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.list(null)).resolves.toMatchObject([{ id: unowned }])
        await storage.history.clear(null)
        await expect(storage.history.list(null)).resolves.toEqual([])
      })

      it('counts every stat only for the owner of the filter', async () => {
        const { storage: clockedStorage, setNow } = await clocked(open)
        storage = clockedStorage
        setNow('2026-10-10T09:00:00.000Z')
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        setNow('2026-10-12T09:00:00.000Z')
        await finishGame(storage, 'easy', lostGame(20_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(30_000), 'generated', null)
        await finishGame(storage, 'hard', wonGame(90_000), 'generated', BOB)
        const alice = { includeScanned: true, owner: ALICE }
        const signedOut = { includeScanned: true, owner: null }

        await expect(storage.stats.summary(null, alice)).resolves.toMatchObject({ played: 2, won: 1, bestMs: 60_000 })
        await expect(storage.stats.summary(null, signedOut)).resolves.toMatchObject({ played: 1, bestMs: 30_000 })
        const byLevel = await storage.stats.byLevel(alice)
        expect(byLevel.easy).toMatchObject({ played: 2 })
        expect(byLevel.hard).toMatchObject({ played: 0 })
        await expect(storage.stats.recentTimes('easy', 5, alice)).resolves.toEqual([60_000])
        await expect(storage.stats.recentTimes('easy', 5, signedOut)).resolves.toEqual([30_000])
        await expect(storage.stats.streak('UTC', alice)).resolves.toMatchObject({ current: 0, longest: 1 })
        await expect(storage.stats.streak('UTC', signedOut)).resolves.toMatchObject({ current: 1 })
      })
    })

    describe('waiting list', () => {
      it('holds a finished game of the owner with its timestamps', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const entry = single(await storage.history.list(ALICE))
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([
          { ...entry, id, createdAt: entry.finishedAt, updatedAt: entry.finishedAt, deletedAt: null },
        ])
      })

      it('holds only the entries of the owner, oldest change first, up to the limit', async () => {
        const first = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', null)
        await finishGame(storage, 'easy', wonGame(40_000), 'generated', BOB)
        const second = await finishGame(storage, 'hard', lostGame(20_000), 'generated', ALICE)
        const third = await finishGame(storage, 'hard', wonGame(90_000), 'generated', ALICE)
        const ids = async (limit: number) => (await storage.history.pending(ALICE, limit)).map((record) => record.id)
        await expect(ids(10)).resolves.toEqual([first, second, third])
        await expect(ids(2)).resolves.toEqual([first, second])
      })

      it('drops the entries that the server accepted', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
        const [first, second] = await storage.history.pending(ALICE, 10)
        if (first === undefined || second === undefined) throw new Error('Expected two entries')
        await storage.history.markPushed([first])
        await expect(storage.history.pending(ALICE, 10)).resolves.toMatchObject([{ id: second.id }])
        await storage.history.markPushed([second, { id: 'unknown', updatedAt: second.updatedAt }])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('changes nothing for an empty list', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await storage.history.markPushed([])
        await expect(storage.history.pending(ALICE, 10)).resolves.toHaveLength(1)
      })

      it('holds a cleared entry again, as a deleted entry with a newer change', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.markPushed([sent])
        await storage.history.clear(ALICE)
        const deleted = single(await storage.history.pending(ALICE, 10))
        expect(deleted).toMatchObject({ id, deletedAt: expect.any(String) })
        expect(deleted.updatedAt > sent.updatedAt).toBe(true)
      })

      it('keeps an entry that changed after the push', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.clear(ALICE)
        await storage.history.markPushed([sent])
        await expect(storage.history.pending(ALICE, 10)).resolves.toMatchObject([{ id, deletedAt: expect.any(String) }])
      })

      it('ignores a repeated mark, also after a newer change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.markPushed([sent])
        await storage.history.markPushed([sent])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
        await storage.history.clear(ALICE)
        const deleted = single(await storage.history.pending(ALICE, 10))
        await storage.history.markPushed([sent])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([deleted])
        await storage.history.markPushed([deleted])
        await storage.history.markPushed([deleted])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('drops an entry of a clock ahead once the server accepts it', async () => {
        const { storage: clockedStorage, setNow } = await clocked(open)
        storage = clockedStorage
        setNow('2030-01-01T00:00:00.000Z')
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        setNow('2026-10-12T10:00:00.000Z')
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.markPushed([sent])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('never holds a game finished while signed out', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })
    })

    describe('upsertRemote', () => {
      it('adds a new entry that is not on the waiting list', async () => {
        await storage.history.upsertRemote([remote('r1', { seed: 412_077 })], ALICE)
        const {
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          deletedAt: _deletedAt,
          ...entry
        } = remote('r1', {
          seed: 412_077,
        })
        await expect(storage.history.list(ALICE)).resolves.toEqual([entry])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
        await expect(storage.history.list(null)).resolves.toEqual([])
      })

      it('replaces an entry with a newer change', async () => {
        await storage.history.upsertRemote([remote('r1')], ALICE)
        await storage.history.upsertRemote(
          [remote('r1', { playedMs: 45_000, updatedAt: '2026-10-02T09:00:00.000Z' })],
          ALICE,
        )
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: 'r1', playedMs: 45_000 }])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('ignores an older change', async () => {
        await storage.history.upsertRemote([remote('r1', { updatedAt: '2026-10-02T09:00:00.000Z' })], ALICE)
        await storage.history.upsertRemote([remote('r1', { playedMs: 45_000 })], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: 'r1', playedMs: 60_000 }])
      })

      it('ignores a change with the same time', async () => {
        await storage.history.upsertRemote([remote('r1')], ALICE)
        await storage.history.upsertRemote([remote('r1', { playedMs: 45_000 })], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: 'r1', playedMs: 60_000 }])
      })

      it('takes a local entry off the waiting list when the server sends the same change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.upsertRemote([{ ...sent, playedMs: 45_000 }], ALICE)
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: sent.id, playedMs: 60_000 }])
      })

      it('keeps the waiting list of an entry of another owner with the same change', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        const sent = single(await storage.history.pending(BOB, 10))
        await storage.history.upsertRemote([sent], ALICE)
        await expect(storage.history.pending(BOB, 10)).resolves.toEqual([sent])
      })

      it('removes an entry that the server deleted', async () => {
        await storage.history.upsertRemote([remote('r1')], ALICE)
        const later = '2026-10-02T09:00:00.000Z'
        await storage.history.upsertRemote([remote('r1', { updatedAt: later, deletedAt: later })], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.stats.summary(null, { includeScanned: true, owner: ALICE })).resolves.toMatchObject({
          played: 0,
        })
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('keeps a deleted entry it did not know, so an older copy does not bring it back', async () => {
        const later = '2026-10-02T09:00:00.000Z'
        await storage.history.upsertRemote([remote('r1', { updatedAt: later, deletedAt: later })], ALICE)
        await storage.history.upsertRemote([remote('r1')], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('never takes an entry from another owner', async () => {
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        await storage.history.upsertRemote([remote(id, { updatedAt: '2030-01-01T00:00:00.000Z' })], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id, playedMs: 60_000 }])
        await expect(storage.history.pending(BOB, 10)).resolves.toMatchObject([{ id }])
      })

      it('changes nothing when the server sends back an entry of this device', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const sent = single(await storage.history.pending(ALICE, 10))
        await storage.history.markPushed([sent])
        await storage.history.upsertRemote([sent], ALICE)
        await expect(storage.history.list(ALICE)).resolves.toHaveLength(1)
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('lists the entries by the time they finished, whatever the order of the upsert', async () => {
        await storage.history.upsertRemote(
          [
            remote('r2', { finishedAt: '2026-10-02T09:00:00.000Z' }),
            remote('r3', { finishedAt: '2026-10-03T09:00:00.000Z' }),
            remote('r1', { finishedAt: '2026-09-30T09:00:00.000Z' }),
          ],
          ALICE,
        )
        const id = await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        const ids = (await storage.history.list(ALICE)).map((entry) => entry.id)
        expect(ids).toEqual([id, 'r3', 'r2', 'r1'])
      })

      it('keeps the newest of two copies in one call', async () => {
        await storage.history.upsertRemote(
          [remote('r1', { playedMs: 45_000, updatedAt: '2026-10-02T09:00:00.000Z' }), remote('r1')],
          ALICE,
        )
        await expect(storage.history.list(ALICE)).resolves.toMatchObject([{ id: 'r1', playedMs: 45_000 }])
      })

      it('clears an entry with a change from a clock ahead of this one, and puts it on the waiting list', async () => {
        const future = '2030-01-01T00:00:00.000Z'
        await storage.history.upsertRemote([remote('r1', { updatedAt: future })], ALICE)
        await storage.history.clear(ALICE)
        const deleted = single(await storage.history.pending(ALICE, 10))
        expect(deleted).toMatchObject({ id: 'r1', deletedAt: expect.any(String) })
        expect(deleted.updatedAt > future).toBe(true)
      })
    })

    describe('adoptUnowned', () => {
      it('gives the entries without an owner to the owner and puts them on the waiting list', async () => {
        const first = await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
        const second = await finishGame(storage, 'hard', lostGame(20_000), 'generated', null)
        await expect(storage.history.adoptUnowned(ALICE)).resolves.toBe(2)
        await expect(storage.history.list(null)).resolves.toEqual([])
        const ids = (await storage.history.list(ALICE)).map((entry) => entry.id)
        expect(ids).toEqual([second, first])
        const pending = (await storage.history.pending(ALICE, 10)).map((record) => record.id)
        expect(pending).toEqual([first, second])
      })

      it('leaves a cleared entry without an owner', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
        await storage.history.clear(null)
        const live = await finishGame(storage, 'easy', wonGame(50_000), 'generated', null)
        await expect(storage.history.adoptUnowned(ALICE)).resolves.toBe(1)
        const pending = (await storage.history.pending(ALICE, 10)).map((record) => record.id)
        expect(pending).toEqual([live])
      })

      it('leaves the entries of another owner', async () => {
        const bob = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        await expect(storage.history.adoptUnowned(ALICE)).resolves.toBe(0)
        await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id: bob }])
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
      })
    })

    describe('countUnowned', () => {
      it('counts the live entries without an owner', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
        await finishGame(storage, 'hard', lostGame(20_000), 'generated', null)
        await finishGame(storage, 'easy', wonGame(50_000), 'generated', ALICE)
        await expect(storage.history.countUnowned()).resolves.toBe(2)
      })

      it('does not count a cleared entry and does not change anything', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', null)
        await storage.history.clear(null)
        await expect(storage.history.countUnowned()).resolves.toBe(0)
        await expect(storage.history.countUnowned()).resolves.toBe(0)
      })
    })

    describe('deleteOwner', () => {
      it('removes every entry of the owner, live and deleted, for good', async () => {
        await finishGame(storage, 'easy', wonGame(60_000), 'generated', ALICE)
        await storage.history.clear(ALICE)
        await finishGame(storage, 'hard', lostGame(20_000), 'generated', ALICE)
        await storage.history.deleteOwner(ALICE)
        await expect(storage.history.list(ALICE)).resolves.toEqual([])
        await expect(storage.history.pending(ALICE, 10)).resolves.toEqual([])
      })

      it('leaves the entries of another owner and of no owner', async () => {
        const bob = await finishGame(storage, 'easy', wonGame(60_000), 'generated', BOB)
        const nobody = await finishGame(storage, 'easy', wonGame(61_000), 'generated', null)
        await finishGame(storage, 'easy', wonGame(62_000), 'generated', ALICE)
        await storage.history.deleteOwner(ALICE)
        await expect(storage.history.list(BOB)).resolves.toMatchObject([{ id: bob }])
        await expect(storage.history.list(null)).resolves.toMatchObject([{ id: nobody }])
      })
    })

    describe('sync state', () => {
      it('has no cursor, time or answer at first', async () => {
        await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
        await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
        await expect(storage.sync.adoptAsked(ALICE)).resolves.toBe(false)
      })

      it('keeps the cursor of its owner', async () => {
        await storage.sync.saveCursor(ALICE, 'cursor-1')
        await expect(storage.sync.cursor(ALICE)).resolves.toBe('cursor-1')
        await storage.sync.saveCursor(ALICE, 'cursor-2')
        await expect(storage.sync.cursor(ALICE)).resolves.toBe('cursor-2')
      })

      it('gives no cursor to another owner and forgets the old one', async () => {
        await storage.sync.saveCursor(ALICE, 'cursor-1')
        await expect(storage.sync.cursor(BOB)).resolves.toBeNull()
        await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
      })

      it('clears the cursor alone', async () => {
        await storage.sync.saveCursor(ALICE, 'cursor-1')
        await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
        await storage.sync.clearCursor()
        await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
        await expect(storage.sync.syncedAt(ALICE)).resolves.toBe('2026-10-15T10:00:00.000Z')
      })

      it('keeps the time of the last sync per owner', async () => {
        await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
        await expect(storage.sync.syncedAt(ALICE)).resolves.toBe('2026-10-15T10:00:00.000Z')
        await expect(storage.sync.syncedAt(BOB)).resolves.toBeNull()
      })

      it('remembers the answer to the adopt prompt per owner', async () => {
        await storage.sync.markAdoptAsked(ALICE)
        await expect(storage.sync.adoptAsked(ALICE)).resolves.toBe(true)
        await expect(storage.sync.adoptAsked(BOB)).resolves.toBe(false)
      })

      it('clears everything of one owner and nothing of another', async () => {
        await storage.sync.saveCursor(ALICE, 'cursor-1')
        await storage.sync.saveSyncedAt(ALICE, '2026-10-15T10:00:00.000Z')
        await storage.sync.markAdoptAsked(ALICE)
        await storage.sync.markAdoptAsked(BOB)
        await storage.sync.clear(ALICE)
        await expect(storage.sync.cursor(ALICE)).resolves.toBeNull()
        await expect(storage.sync.syncedAt(ALICE)).resolves.toBeNull()
        await expect(storage.sync.adoptAsked(ALICE)).resolves.toBe(false)
        await expect(storage.sync.adoptAsked(BOB)).resolves.toBe(true)
      })
    })

    describe('subscribe', () => {
      it('fires after a won game and after a lost game', async () => {
        const listener = jest.fn()
        storage.subscribe(listener)
        const won = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: ALICE })
        listener.mockClear()
        await storage.puzzles.save(won.id, wonGame(60_000), ALICE)
        expect(listener).toHaveBeenCalledTimes(1)
        const lost = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: ALICE })
        listener.mockClear()
        await storage.puzzles.save(lost.id, lostGame(20_000), ALICE)
        expect(listener).toHaveBeenCalledTimes(1)
      })

      it('fires after a start that can abandon a game, and after a clear', async () => {
        const listener = jest.fn()
        storage.subscribe(listener)
        await storage.puzzles.start({ level: 'easy', source: 'generated', game: movedGame(), owner: ALICE })
        expect(listener).toHaveBeenCalledTimes(1)
        await storage.history.clear(ALICE)
        expect(listener).toHaveBeenCalledTimes(2)
      })

      it('does not fire for a move', async () => {
        const { id } = await storage.puzzles.start({
          level: 'easy',
          source: 'generated',
          game: newGame(),
          owner: ALICE,
        })
        const listener = jest.fn()
        storage.subscribe(listener)
        await storage.puzzles.save(id, movedGame(), ALICE)
        expect(listener).not.toHaveBeenCalled()
      })

      it('fires only after the write resolved, so the waiting list has the entry', async () => {
        const { id } = await storage.puzzles.start({
          level: 'easy',
          source: 'generated',
          game: newGame(),
          owner: ALICE,
        })
        let seen = -1
        storage.subscribe(() => {
          void storage.history.pending(ALICE, 10).then((pending) => {
            seen = pending.length
          })
        })
        await storage.puzzles.save(id, wonGame(60_000), ALICE)
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(seen).toBe(1)
      })

      it('stops after the unsubscribe and survives a throwing listener', async () => {
        const listener = jest.fn()
        const off = storage.subscribe(listener)
        storage.subscribe(() => {
          throw new Error('listener bug')
        })
        off()
        const { id } = await storage.puzzles.start({
          level: 'easy',
          source: 'generated',
          game: newGame(),
          owner: ALICE,
        })
        await expect(storage.puzzles.save(id, wonGame(60_000), ALICE)).resolves.toBeUndefined()
        expect(listener).not.toHaveBeenCalled()
      })
    })

    it('refuses to start a won or a lost game', async () => {
      await expect(
        storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000), owner: null }),
      ).rejects.toThrow(RangeError)
      await expect(
        storage.puzzles.start({ level: 'easy', source: 'generated', game: lostGame(1_000), owner: null }),
      ).rejects.toThrow(RangeError)
    })

    it('keeps the last move and the time played', async () => {
      const { id } = await storage.puzzles.start({ level: 'medium', source: 'generated', game: newGame(), owner: null })
      const moved = place(select(tick(newGame(), 61_000), 2), 4).game
      await storage.puzzles.save(id, moved, null)
      const current = await storage.puzzles.current()
      expect(current?.game).toEqual(moved)
      expect(current?.game.playedMs).toBe(61_000)
    })

    it('moves a won game to the history', async () => {
      const { id } = await storage.puzzles.start({ level: 'hard', source: 'scanned', game: nearlyWon(), owner: null })
      await storage.puzzles.save(id, wonGame(90_000), null)
      await expect(storage.puzzles.current()).resolves.toBeNull()
      await expect(storage.history.list(null)).resolves.toEqual([
        {
          id,
          level: 'hard',
          source: 'scanned',
          seed: null,
          result: 'won',
          playedMs: 90_000,
          mistakes: 0,
          hintsUsed: 0,
          finishedAt: expect.any(String),
        },
      ])
    })

    it('moves a lost game to the history', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, lostGame(30_000), null)
      const [entry] = await storage.history.list(null)
      expect(entry).toMatchObject({ id, result: 'lost', mistakes: 3, playedMs: 30_000 })
    })

    it('saving a finished game twice adds one history entry', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
      await storage.puzzles.save(id, wonGame(40_000), null)
      await storage.puzzles.save(id, wonGame(40_000), null)
      await expect(storage.history.list(null)).resolves.toHaveLength(1)
    })

    it('discards a game without a history entry', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.discard(id)
      await expect(storage.puzzles.current()).resolves.toBeNull()
      await expect(storage.history.list(null)).resolves.toEqual([])
    })

    it('lists the history newest first', async () => {
      const first = await storage.puzzles.start({ level: 'easy', source: 'generated', game: nearlyWon(), owner: null })
      await storage.puzzles.save(first.id, wonGame(10_000), null)
      const second = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(second.id, lostGame(20_000), null)
      const ids = (await storage.history.list(null)).map((entry) => entry.id)
      expect(ids).toEqual([second.id, first.id])
    })

    it('gives the best time per level from won games without hints', async () => {
      await expect(storage.history.bestTimes(null)).resolves.toEqual({})
      const finish = async (level: 'easy' | 'hard', game: Game) => {
        const { id } = await storage.puzzles.start({ level, source: 'generated', game: newGame(), owner: null })
        await storage.puzzles.save(id, game, null)
      }
      await finish('easy', wonGame(90_000))
      await finish('easy', wonGame(60_000))
      await finish('easy', lostGame(30_000))
      await finish('hard', wonGame(200_000))
      await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000, hard: 200_000 })
    })

    it('leaves a won game with a hint out of the best time', async () => {
      const finish = async (game: Game) => {
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
        await storage.puzzles.save(id, game, null)
      }
      await finish(wonWithHint(10_000))
      await expect(storage.history.bestTimes(null)).resolves.toEqual({})
      await finish(wonGame(60_000))
      await finish(wonWithHint(20_000))
      await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000 })
      await expect(storage.history.list(null)).resolves.toHaveLength(3)
    })

    it('keeps the seed of a generated game in progress and in the history', async () => {
      const started = await storage.puzzles.start({
        level: 'easy',
        source: 'generated',
        seed: 412_077,
        game: nearlyWon(),
        owner: null,
      })
      expect(started.seed).toBe(412_077)
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: 412_077 })
      await storage.puzzles.save(started.id, wonGame(40_000), null)
      await expect(storage.history.list(null)).resolves.toMatchObject([{ id: started.id, seed: 412_077 }])
    })

    it('gives a game without a seed the seed null', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'scanned', game: newGame(), owner: null })
      expect(started.seed).toBeNull()
      await expect(storage.puzzles.current()).resolves.toMatchObject({ seed: null })
    })

    it('leaves a scanned game out of the best time', async () => {
      const finish = async (source: 'generated' | 'scanned', game: Game) => {
        const { id } = await storage.puzzles.start({ level: 'easy', source, game: newGame(), owner: null })
        await storage.puzzles.save(id, game, null)
      }
      await finish('scanned', wonGame(10_000))
      await expect(storage.history.bestTimes(null)).resolves.toEqual({})
      await finish('generated', wonGame(60_000))
      await finish('scanned', wonGame(20_000))
      await expect(storage.history.bestTimes(null)).resolves.toEqual({ easy: 60_000 })
    })

    it('counts the best and the average time by countsForBestTime', async () => {
      await finishGame(storage, 'easy', wonGame(90_000))
      await finishGame(storage, 'easy', wonGame(60_000))
      await finishGame(storage, 'easy', wonWithHint(10_000))
      await finishGame(storage, 'easy', wonWithMistake(70_000))
      await finishGame(storage, 'easy', wonGame(20_000), 'scanned')
      await finishGame(storage, 'easy', lostGame(5_000))
      await finishGame(storage, 'hard', wonWithHint(30_000))
      await finishGame(storage, 'hard', wonGame(200_000))
      await finishGame(storage, 'easy', wonGame(1_000), 'generated', ALICE)
      const { id } = await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save(id, movedGame(1_000), null)
      await storage.puzzles.start({ level: 'hard', source: 'generated', game: newGame(), owner: null })

      const entries = await storage.history.list(null)
      const best = await storage.history.bestTimes(null)
      const levels = ['easy', 'medium', 'hard'] as const
      const summaries = await Promise.all(levels.map((level) => storage.stats.summary(level, WITH_SCANNED)))
      for (const [index, level] of levels.entries()) {
        const times = entries
          .filter((entry) => entry.level === level && countsForBestTime(entry))
          .map((entry) => entry.playedMs)
        const summary = summaries[index]
        expect(best[level] ?? null).toBe(times.length === 0 ? null : Math.min(...times))
        expect(summary?.bestMs).toBe(best[level] ?? null)
        expect(summary?.averageMs).toBe(
          times.length === 0 ? null : times.reduce((sum, time) => sum + time, 0) / times.length,
        )
      }
      expect(best).toEqual({ easy: 60_000, hard: 200_000 })
    })

    it('runs the next task after a task that failed', async () => {
      await expect(
        storage.puzzles.start({ level: 'easy', source: 'generated', game: wonGame(1_000), owner: null }),
      ).rejects.toThrow(RangeError)
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await expect(storage.puzzles.current()).resolves.toEqual(started)
    })

    it('ignores a save or a discard of a game that is not in progress', async () => {
      const started = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await storage.puzzles.save('unknown', tick(newGame(), 9_000), null)
      await storage.puzzles.discard('unknown')
      await expect(storage.puzzles.current()).resolves.toEqual(started)
      await storage.puzzles.save(started.id, wonGame(9_000), null)
      await storage.puzzles.discard(started.id)
      await expect(storage.history.list(null)).resolves.toHaveLength(1)
    })

    it('saves that run together land in their order', async () => {
      const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
      await Promise.all([1_000, 2_000, 3_000].map((ms) => storage.puzzles.save(id, tick(newGame(), ms), null)))
      expect((await storage.puzzles.current())?.game.playedMs).toBe(3_000)
    })

    describe('stats', () => {
      const NOTHING = {
        played: 0,
        won: 0,
        lost: 0,
        abandoned: 0,
        winRate: null,
        bestMs: null,
        averageMs: null,
        flawlessWins: 0,
        averageMistakes: null,
        averageHints: null,
      }

      it('has no numbers before the first game', async () => {
        await expect(storage.stats.summary(null, GENERATED)).resolves.toEqual(NOTHING)
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual(NOTHING)
      })

      it('counts the games of a level by the rules of ADR-023', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await finishGame(storage, 'easy', wonWithMistake(90_000))
        await finishGame(storage, 'easy', wonWithHint(30_000))
        await finishGame(storage, 'easy', lostGame(20_000))
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toEqual({
          played: 4,
          won: 3,
          lost: 1,
          abandoned: 0,
          winRate: 0.75,
          bestMs: 60_000,
          averageMs: 75_000,
          flawlessWins: 1,
          averageMistakes: 1,
          averageHints: 0.25,
        })
      })

      it('has an average time only where it has a best time: both count the same games', async () => {
        await finishGame(storage, 'easy', wonWithHint(30_000))
        await finishGame(storage, 'hard', wonGame(10_000), 'scanned')
        const [easy, hard] = await Promise.all([
          storage.stats.summary('easy', WITH_SCANNED),
          storage.stats.summary('hard', WITH_SCANNED),
        ])
        for (const summary of [easy, hard]) expect(summary).toMatchObject({ bestMs: null, averageMs: null })
      })

      it('gives a win rate of 0 for a level with only lost games', async () => {
        await finishGame(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, winRate: 0 })
      })

      it('counts an abandoned game apart from the win rate', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        const { id } = await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
        await storage.puzzles.save(id, movedGame(), null)
        await storage.puzzles.start({ level: 'easy', source: 'generated', game: newGame(), owner: null })
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          won: 1,
          abandoned: 1,
          winRate: 1,
        })
      })

      it('counts one level or all levels', async () => {
        await finishGame(storage, 'easy', wonGame(10_000))
        await finishGame(storage, 'hard', lostGame(20_000))
        await expect(storage.stats.summary(null, GENERATED)).resolves.toMatchObject({ played: 2, won: 1, lost: 1 })
        await expect(storage.stats.summary('hard', GENERATED)).resolves.toMatchObject({ played: 1, won: 0 })
      })

      it('counts a scanned game only when the filter says so, and never for the best time', async () => {
        await finishGame(storage, 'easy', wonGame(60_000))
        await finishGame(storage, 'easy', wonGame(10_000), 'scanned')
        await expect(storage.stats.summary('easy', GENERATED)).resolves.toMatchObject({
          played: 1,
          averageMs: 60_000,
          bestMs: 60_000,
        })
        await expect(storage.stats.summary('easy', WITH_SCANNED)).resolves.toMatchObject({
          played: 2,
          averageMs: 60_000,
          bestMs: 60_000,
        })
      })

      it('gives the summary of each of the four levels', async () => {
        await finishGame(storage, 'medium', wonGame(10_000))
        const levels = await storage.stats.byLevel(GENERATED)
        expect(Object.keys(levels)).toEqual(['easy', 'medium', 'hard', 'expert'])
        expect(levels.medium).toMatchObject({ played: 1, won: 1 })
        expect(levels.expert).toEqual(NOTHING)
      })

      it('gives the times of the last wins, oldest first', async () => {
        await finishGame(storage, 'easy', wonGame(10_000))
        await finishGame(storage, 'easy', wonGame(20_000))
        await finishGame(storage, 'easy', wonGame(30_000))
        await finishGame(storage, 'easy', lostGame(5_000))
        await expect(storage.stats.recentTimes('easy', 2, GENERATED)).resolves.toEqual([20_000, 30_000])
        await expect(storage.stats.recentTimes('hard', 5, GENERATED)).resolves.toEqual([])
      })

      describe('streak', () => {
        it('counts the days in a row with a win, and lets a day pass', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          for (const day of ['2026-10-10', '2026-10-11', '2026-10-12']) {
            setNow(`${day}T09:00:00.000Z`)
            // oxlint-disable-next-line no-await-in-loop -- each win needs its own clock time, so the games run in order.
            await finishGame(clockedStorage, 'easy', wonGame(60_000))
          }
          setNow('2026-10-12T20:00:00.000Z')
          const streak = await clockedStorage.stats.streak('UTC', GENERATED)
          expect(streak).toMatchObject({ current: 3, longest: 3 })
          expect(streak.recent).toHaveLength(14)
          expect(streak.recent.slice(-3)).toEqual([true, true, true])
          setNow('2026-10-13T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 3 })
          setNow('2026-10-14T08:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0, longest: 3 })
        })

        it('counts the day in the time zone of the player', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T11:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-12T12:00:00.000Z')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 1 })
          await expect(clockedStorage.stats.streak('Pacific/Kiritimati', GENERATED)).resolves.toMatchObject({
            current: 2,
          })
        })

        it('does not count a lost game or an abandoned game as a win', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-10T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          setNow('2026-10-11T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', lostGame(20_000))
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000))
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({
            current: 1,
            longest: 1,
          })
        })

        it('counts a scanned win only when the filter says so', async () => {
          const { storage: clockedStorage, setNow } = await clocked(open)
          setNow('2026-10-12T09:00:00.000Z')
          await finishGame(clockedStorage, 'easy', wonGame(60_000), 'scanned')
          await expect(clockedStorage.stats.streak('UTC', GENERATED)).resolves.toMatchObject({ current: 0 })
          await expect(clockedStorage.stats.streak('UTC', WITH_SCANNED)).resolves.toMatchObject({ current: 1 })
        })
      })
    })
  })
}
