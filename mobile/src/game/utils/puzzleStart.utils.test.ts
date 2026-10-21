import { createGame, generate, place, select, tick, type Digit, type Game, type Level } from '@sudoku/core'
import { createMemoryStorage, type GameStorage, type SavedProgress } from '@/storage'
import { createPuzzleStart } from './puzzleStart.utils'
import { levelOf } from './start.utils'

const OWNER = 'user-alice'

function setup(answer = true, owner: string | null = null) {
  const storage = createMemoryStorage()
  const confirmReplace = jest.fn(async () => answer)
  // 0.5 makes the seed 500 000.
  const start = createPuzzleStart({ puzzles: storage.puzzles, owner, confirmReplace, random: () => 0.5 })
  return { storage, confirmReplace, start }
}

async function begin(storage: GameStorage, level: Level = 'easy', source: 'generated' | 'scanned' = 'generated') {
  return storage.puzzles.start({ level, source, seed: 9, game: createGame(generate(level, 9)), owner: null })
}

/** A game with one wrong entry, one tick of time and so a move to record. */
function played(from: Game): Game {
  const cell = from.givens.findIndex((digit) => digit === 0)
  const wrong = (((from.solution[cell] ?? 0) % 9) + 1) as Digit
  return tick(place(select(from, cell), wrong).game, 5_000)
}

const deferred = <T>() => Promise.withResolvers<T>()

const spyStart = (storage: GameStorage) => jest.spyOn(storage.puzzles, 'start')

// The waits of the repository are promises. One turn of the event loop lets them all settle.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('newGame', () => {
  it('starts a generated puzzle of the level, with the seed as the puzzle number', async () => {
    const { storage, start } = setup()
    const started = await start.newGame('hard')
    expect(started).toMatchObject({ level: 'hard', source: 'generated', seed: 500_000 })
    expect(started?.game.givens).toEqual(generate('hard', 500_000).givens)
    expect(await storage.puzzles.current()).toEqual(started)
  })

  it('starts for the owner', async () => {
    const { storage, start } = setup(true, OWNER)
    const spy = spyStart(storage)
    await start.newGame('easy')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ owner: OWNER }))
  })

  it('does not ask when no game is in progress', async () => {
    const { confirmReplace, start } = setup()
    await start.newGame('easy')
    expect(confirmReplace).not.toHaveBeenCalled()
  })

  it('asks before it replaces a game in progress, and Cancel keeps that game', async () => {
    const { storage, confirmReplace, start } = setup(false)
    const first = await begin(storage)
    const spy = spyStart(storage)
    const opened = jest.fn()
    await expect(start.newGame('hard', opened)).resolves.toBeNull()
    expect(confirmReplace).toHaveBeenCalledTimes(1)
    expect(spy).not.toHaveBeenCalled()
    expect(opened).not.toHaveBeenCalled()
    expect(await storage.puzzles.current()).toEqual(first)
  })

  it('replaces the game in progress on New game', async () => {
    const { storage, start } = setup()
    const first = await begin(storage)
    const started = await start.newGame('hard')
    expect(started?.id).not.toBe(first.id)
    expect(await storage.puzzles.current()).toMatchObject({ level: 'hard' })
  })

  it('asks from current() when the repository does not know the game yet', async () => {
    const { storage, confirmReplace } = setup()
    await begin(storage)
    const unknown = createPuzzleStart({
      puzzles: { ...storage.puzzles, peek: () => undefined },
      owner: null,
      confirmReplace,
    })
    await unknown.newGame('easy')
    expect(confirmReplace).toHaveBeenCalledTimes(1)
  })

  it('records the replaced game as abandoned only after the player says New game', async () => {
    const cancelled = setup(false)
    const first = await begin(cancelled.storage)
    await cancelled.storage.puzzles.save(first.id, played(first.game), null)
    await cancelled.start.newGame('easy')
    expect(await cancelled.storage.history.list(null)).toEqual([])
    const confirmed = createPuzzleStart({
      puzzles: cancelled.storage.puzzles,
      owner: null,
      confirmReplace: async () => true,
    })
    await confirmed.newGame('easy')
    expect(await cancelled.storage.history.list(null)).toEqual([
      expect.objectContaining({ id: first.id, result: 'abandoned', mistakes: 1 }),
    ])
  })

  it('calls opened while the write still runs', async () => {
    const { storage, start } = setup()
    const real = storage.puzzles.start
    const held = deferred<void>()
    jest.spyOn(storage.puzzles, 'start').mockImplementation(async (input) => {
      const started = real(input)
      await held.promise
      return started
    })
    const order: string[] = []
    const starting = start.newGame('easy', () => order.push(`opened, peek ${storage.puzzles.peek()?.level}`))
    await settle()
    expect(order).toEqual(['opened, peek easy'])
    held.resolve()
    await starting
  })

  it('a failed opened() does not fail the start', async () => {
    const { storage, start } = setup()
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const started = await start.newGame('easy', () => {
      throw new Error('no route')
    })
    expect(started).toMatchObject({ level: 'easy' })
    expect(await storage.puzzles.current()).toEqual(started)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('The game screen does not open'))
    warn.mockRestore()
  })

  it('a second call while a start runs does nothing', async () => {
    const { storage, start } = setup()
    const spy = spyStart(storage)
    const results = await Promise.all([start.newGame('easy'), start.newGame('hard')])
    expect(results[0]).toMatchObject({ level: 'easy' })
    expect(results[1]).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not run two starts while the first waits for the answer', async () => {
    const storage = createMemoryStorage()
    await begin(storage)
    const answer = deferred<boolean>()
    const confirmReplace = jest.fn(() => answer.promise)
    const start = createPuzzleStart({ puzzles: storage.puzzles, owner: null, confirmReplace })
    const first = start.newGame('easy')
    await settle()
    await expect(start.newGame('hard')).resolves.toBeNull()
    expect(confirmReplace).toHaveBeenCalledTimes(1)
    answer.resolve(false)
    await first
  })

  it('takes the next start after a cancel', async () => {
    const storage = createMemoryStorage()
    await begin(storage)
    const answers = [false, true]
    const start = createPuzzleStart({
      puzzles: storage.puzzles,
      owner: null,
      confirmReplace: async () => answers.shift() ?? true,
    })
    await expect(start.newGame('easy')).resolves.toBeNull()
    await expect(start.newGame('hard')).resolves.toMatchObject({ level: 'hard' })
  })

  it('gives null after a failed start, keeps the game in progress, and takes the next start', async () => {
    const { storage, start } = setup()
    const first = await begin(storage)
    jest.spyOn(storage.puzzles, 'start').mockRejectedValueOnce(new Error('disk full'))
    await expect(start.newGame('hard')).resolves.toBeNull()
    expect(await storage.puzzles.current()).toEqual(first)
    await expect(start.newGame('hard')).resolves.toMatchObject({ level: 'hard' })
  })
})

describe('playScan', () => {
  const { givens, solution } = generate('hard', 4)
  const open = givens.findIndex((digit) => digit === 0)
  const entries = givens.map((_, cell) => (cell === open ? ((solution[open] ?? 0) % 9) + 1 : 0))

  it('starts the grid as a scanned game at the level of its givens, without a seed', async () => {
    const { storage, start } = setup(true, OWNER)
    const spy = spyStart(storage)
    const started = await start.playScan({ givens, solution, entries })
    expect(started).toMatchObject({ level: levelOf(givens), source: 'scanned', seed: null })
    expect(started?.game.givens).toEqual(givens)
    expect(started?.game.entries[open]).toBe(entries[open])
    expect(started?.game.mistakes).toBe(0)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ owner: OWNER }))
  })

  it('asks before it replaces a game in progress', async () => {
    const { storage, confirmReplace, start } = setup(false)
    await begin(storage)
    await expect(start.playScan({ givens, solution, entries })).resolves.toBeNull()
    expect(confirmReplace).toHaveBeenCalledTimes(1)
    expect(await storage.puzzles.current()).toMatchObject({ source: 'generated' })
  })

  it('calls opened when the start runs', async () => {
    const { start } = setup()
    const opened = jest.fn()
    await start.playScan({ givens, solution, entries }, opened)
    expect(opened).toHaveBeenCalledTimes(1)
  })
})

async function lost(storage: GameStorage): Promise<SavedProgress> {
  const first = await begin(storage, 'medium')
  const over: Game = { ...first.game, status: 'lost', mistakes: 3, playedMs: 61_000 }
  await storage.puzzles.save(first.id, over, null)
  return { ...first, game: over }
}

describe('after a game is over', () => {
  it('retry starts the same puzzle again as a new game in progress with the same seed', async () => {
    const { storage, confirmReplace, start } = setup()
    const over = await lost(storage)
    const started = await start.retry(over)
    expect(started).toMatchObject({ level: 'medium', source: 'generated', seed: 9 })
    expect(started?.id).not.toBe(over.id)
    expect(started?.game).toEqual(createGame({ givens: over.game.givens, solution: over.game.solution }))
    expect(confirmReplace).not.toHaveBeenCalled()
    expect(await storage.puzzles.current()).toEqual(started)
    expect(await storage.history.list(null)).toEqual([expect.objectContaining({ id: over.id, result: 'lost' })])
  })

  it('retry of a scanned puzzle starts from the entries that the scan loaded', async () => {
    const { storage, start } = setup()
    const { givens, solution } = generate('hard', 4)
    const open = givens.findIndex((digit) => digit === 0)
    const entries = givens.map((_, cell) => (cell === open ? ((solution[open] ?? 0) % 9) + 1 : 0))
    const scanned = await storage.puzzles.start({
      level: 'hard',
      source: 'scanned',
      game: createGame({ givens, solution, entries }),
      owner: null,
    })
    const started = await start.retry({ ...scanned, game: { ...scanned.game, status: 'lost' } })
    expect(started).toMatchObject({ source: 'scanned', seed: null })
    expect(started?.game.entries).toEqual(entries)
  })

  it('newPuzzle starts a generated puzzle at the same level, without a question', async () => {
    const { storage, confirmReplace, start } = setup()
    const over = await lost(storage)
    const started = await start.newPuzzle(over)
    expect(started).toMatchObject({ level: 'medium', source: 'generated', seed: 500_000 })
    expect(confirmReplace).not.toHaveBeenCalled()
  })

  it('a retry and a new puzzle at once start one game', async () => {
    const { storage, start } = setup()
    const over = await lost(storage)
    const spy = spyStart(storage)
    await Promise.all([start.retry(over), start.newPuzzle(over)])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('gives null after a failed retry and takes the next one', async () => {
    const { storage, start } = setup()
    const over = await lost(storage)
    jest.spyOn(storage.puzzles, 'start').mockRejectedValueOnce(new Error('disk full'))
    await expect(start.retry(over)).resolves.toBeNull()
    await expect(start.retry(over)).resolves.toMatchObject({ seed: 9 })
  })
})
