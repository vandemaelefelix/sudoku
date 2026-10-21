import { createGame, type Game } from '@sudoku/core'
import { sampleStart } from '@/game/utils/sample.utils'
import { finishView, formatPuzzleNumber, type FinishInfo } from './finish.utils'

// 09:00 UTC is 12 October in every time zone from UTC-9 to UTC+14.
const FINISHED_AT = new Date(Date.UTC(2026, 9, 12, 9, 0, 0))
const GENERATED: FinishInfo = { level: 'medium', source: 'generated', seed: 412_077, bestBeforeMs: 810_000 }

const board = (changes: Partial<Game> = {}): Game => ({ ...createGame(sampleStart()), ...changes })

describe('formatPuzzleNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1 000'],
    [412_077, '412 077'],
    [999_999, '999 999'],
  ])('%i is %s', (seed, text) => {
    expect(formatPuzzleNumber(seed)).toBe(text)
  })
})

describe('finishView', () => {
  it('shows a faster generated game as a new best', () => {
    expect(finishView(board({ mistakes: 1 }), 741_000, GENERATED, FINISHED_AT)).toEqual({
      title: 'Solved · Medium',
      newBest: true,
      time: '12:21',
      mistakes: '1/3',
      hints: '0',
      best: '12:21',
      source: 'Puzzle 412 077',
      fromPaper: false,
      date: '12 Oct 2026',
      label: 'Solved · Medium. New best. Time 12:21. 1 of 3 mistakes. 0 hints. Best 12:21. Puzzle 412 077. 12 Oct 2026',
    })
  })

  it('keeps the stored best time for a slower game', () => {
    expect(finishView(board(), 900_000, GENERATED, FINISHED_AT)).toMatchObject({ newBest: false, best: '13:30' })
  })

  it('does not count a time equal to the best time as a new best', () => {
    expect(finishView(board(), 810_000, GENERATED, FINISHED_AT)).toMatchObject({ newBest: false, best: '13:30' })
  })

  it('shows the first counted win at a level as a new best', () => {
    const info = { ...GENERATED, bestBeforeMs: null }
    expect(finishView(board(), 741_000, info, FINISHED_AT)).toMatchObject({ newBest: true, best: '12:21' })
  })

  it('never shows a game with a hint as a new best', () => {
    expect(finishView(board({ hintsUsed: 1 }), 1_000, GENERATED, FINISHED_AT)).toMatchObject({
      newBest: false,
      hints: '1',
      best: '13:30',
    })
    const first = { ...GENERATED, bestBeforeMs: null }
    expect(finishView(board({ hintsUsed: 1 }), 1_000, first, FINISHED_AT)).toMatchObject({ newBest: false, best: '–' })
  })

  it('shows a scanned game as scanned from paper, never as a new best', () => {
    const scanned: FinishInfo = { level: 'easy', source: 'scanned', seed: null, bestBeforeMs: null }
    expect(finishView(board(), 1_000, scanned, FINISHED_AT)).toMatchObject({
      title: 'Solved · Easy',
      newBest: false,
      best: '–',
      source: 'Scanned from paper',
      fromPaper: true,
    })
  })

  it('names a generated game without a seed', () => {
    const old = { ...GENERATED, seed: null }
    expect(finishView(board(), 900_000, old, FINISHED_AT).source).toBe('Generated puzzle')
  })

  it.each([
    [0, '00:00'],
    [59_600, '00:59'],
    [59_999, '00:59'],
    [60_000, '01:00'],
    [6_000_000, '100:00'],
  ])('writes %i ms as %s, like the stats screen', (playedMs, text) => {
    const first = { ...GENERATED, bestBeforeMs: null }
    expect(finishView(board(), playedMs, first, FINISHED_AT)).toMatchObject({ time: text, best: text })
  })
})
