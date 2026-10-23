import { place, select, type Digit, type Game } from '@sudoku/core'
import { createSaveQueue } from './saveQueue.utils'
import { OPEN, sampleGame as fresh } from '@/game/sample.testkit'

/** Three wrong numbers end the game. */
const lostGame = () => [1, 2, 3].reduce((game, digit) => place(game, digit as Digit).game, select(fresh(), OPEN))

function deferredWrites() {
  const writes: { game: Game; finish: () => void; fail: (error: Error) => void }[] = []
  const write = jest.fn(
    (game: Game) =>
      new Promise<void>((resolve, reject) => {
        writes.push({ game, finish: resolve, fail: reject })
      }),
  )
  return { writes, write }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
const report = () => ({ saved: jest.fn(), failed: jest.fn() })

describe('createSaveQueue', () => {
  it('writes a game at once when no write runs', () => {
    const { write } = deferredWrites()
    const save = createSaveQueue(write, report())
    const game = fresh()
    save(game)
    expect(write).toHaveBeenCalledWith(game)
  })

  it('keeps only the newest game while a write runs', async () => {
    const { writes, write } = deferredWrites()
    const save = createSaveQueue(write, report())
    const [first, second, third] = [fresh(), fresh(), fresh()]
    save(first)
    save(second)
    save(third)
    expect(write).toHaveBeenCalledTimes(1)
    writes[0]?.finish()
    await flush()
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith(third)
  })

  it('hands a finished game to the write at once, behind the running write but before any later start', () => {
    const { write } = deferredWrites()
    const save = createSaveQueue(write, report())
    const finished = lostGame()
    expect(finished.status).toBe('lost')
    save(fresh())
    save(place(select(fresh(), OPEN), 5).game)
    save(finished)
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith(finished)
  })

  it('writes nothing more after a finished game, and reports its failure', async () => {
    const { writes, write } = deferredWrites()
    const reporter = report()
    const save = createSaveQueue(write, reporter)
    save(fresh())
    save(lostGame())
    writes[0]?.finish()
    writes[1]?.fail(new Error('disk full'))
    await flush()
    expect(write).toHaveBeenCalledTimes(2)
    expect(reporter.failed).toHaveBeenCalledWith(new Error('disk full'))
  })

  it('returns before the write ends', () => {
    const save = createSaveQueue(() => new Promise<void>(() => undefined), report())
    expect(save(fresh())).toBeUndefined()
  })

  it('reports the duration of each write', async () => {
    const { writes, write } = deferredWrites()
    const times = [10, 13.5]
    const reporter = report()
    const save = createSaveQueue(write, reporter, () => times.shift() ?? 0)
    const game = fresh()
    save(game)
    writes[0]?.finish()
    await flush()
    expect(reporter.saved).toHaveBeenCalledWith(game, 3.5)
  })

  it('reports a failed write and goes on with the next game', async () => {
    const { writes, write } = deferredWrites()
    const reporter = report()
    const save = createSaveQueue(write, reporter)
    const next = fresh()
    save(fresh())
    save(next)
    writes[0]?.fail(new Error('disk full'))
    await flush()
    expect(reporter.failed).toHaveBeenCalledWith(new Error('disk full'))
    expect(write).toHaveBeenLastCalledWith(next)
  })
})
