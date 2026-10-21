import { act, renderHook, waitFor } from '@testing-library/react-native'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import { type Digit, generate } from '@sudoku/core'
import type { CellResult } from '@/scanner'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import type { CaptureOk, CaptureResult } from '@/scan/utils/captureResult.utils'
import * as playUtils from '@/scan/utils/play.utils'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { type CorrectionExits, useCorrectionSession } from './useCorrectionSession'

const mockPlay = jest.fn()
jest.mock('@/settings/hooks/useHaptics', () => ({
  useHaptics: () => ({ on: true, setOn: jest.fn(), play: mockPlay }),
}))

const empty = (): CellResult => ({ digit: 0, kind: 'none', confidence: 1, validPair: true, second: 1 })
const printed = (digit: number, confidence = 1): Partial<CellResult> => ({ digit, kind: 'printed', confidence })

function okResult(over: { [n: number]: Partial<CellResult> } = {}, extra: Partial<CaptureOk> = {}): CaptureResult {
  const cells = Array.from({ length: 81 }, (_, n) => ({ ...empty(), ...over[n] }))
  return {
    ok: true,
    cells,
    quad: [] as never,
    corners: 'detected' as never,
    cornerOffset: null,
    timings: {} as never,
    ...extra,
  }
}

const shared = <T,>(value: T) => ({ value }) as SharedValue<T>
const review = (result: CaptureResult | null) => ({
  phase: 'review' as const,
  result,
  crossFade: false,
  clock: shared(0),
  resultsAt: shared(0),
})
const capturing = (result: CaptureResult | null, clock = 0.4, resultsAt = -1, crossFade = false) => ({
  phase: 'capturing' as const,
  result,
  crossFade,
  clock: shared(clock),
  resultsAt: shared(resultsAt),
})
type Capture = ReturnType<typeof review> | ReturnType<typeof capturing>

function session(capture: Capture, exits: Partial<CorrectionExits> = {}) {
  const all: CorrectionExits = { onRetake: jest.fn(), ...exits }
  return {
    ...renderHook((props: { capture: Capture }) => useCorrectionSession(props.capture, all), {
      initialProps: { capture },
    }),
    exits: all,
  }
}

const puzzle = generate('hard', 5)
const firstOpen = puzzle.givens.findIndex((digit) => digit === 0)
const wrongDigit = (((puzzle.solution[firstOpen] ?? 0) % 9) + 1) as Digit

/** A recognised result with every given of `givens` printed, and `over` on top. */
function scanOf(givens: readonly number[], over: { [n: number]: Partial<CellResult> } = {}): CaptureResult {
  const cells: { [n: number]: Partial<CellResult> } = {}
  givens.forEach((digit, n) => {
    if (digit !== 0) cells[n] = printed(digit)
  })
  return okResult({ ...cells, ...over })
}

function fullScan(wrong?: { cell: number; digit: number }): CaptureResult {
  const over: { [n: number]: Partial<CellResult> } = {}
  puzzle.solution.forEach((digit, n) => {
    over[n] = {
      digit: wrong?.cell === n ? wrong.digit : digit,
      kind: puzzle.givens[n] === 0 ? 'handwritten' : 'printed',
      confidence: 1,
    }
  })
  return okResult(over)
}

// Cells 3, 40 and 70 need a check.
const flowScan = () =>
  okResult({
    0: printed(5),
    3: { digit: 4, kind: 'handwritten', confidence: 0.5, second: 9 },
    40: { digit: 2, kind: 'handwritten', confidence: 0.6 },
    70: { confidence: 0.4 },
  })

beforeEach(() => mockPlay.mockClear())

describe('the panel state', () => {
  it('has no panel before the result arrives', () => {
    expect(session(capturing(null)).result.current.panel).toBeNull()
  })

  it('shows the failure panel for a failed scan, and nothing to edit', () => {
    const { result } = session(review({ ok: false, reason: 'no grid' }))
    expect(result.current.panel).toBe('failure')
    expect(result.current.editable).toBe(false)
    expect(result.current.looks).toEqual([])
  })

  it('walks the summary, check and pick states', () => {
    const { result } = session(review(flowScan()))
    expect(result.current.panel).toBe('summary')
    expect(result.current.toCheck).toBe(3)
    act(() => result.current.actions.startCheck())
    expect(result.current.panel).toBe('check')
    expect(result.current.openCell).toMatchObject({ cell: 3, look: { digit: '4', uncertain: true } })
    expect(result.current.hint).toBe(9)
    expect(result.current.flow).toEqual([3, 40, 70])
    act(() => result.current.actions.no())
    expect(result.current.panel).toBe('pick')
    act(() => result.current.actions.setDigit(9))
    expect(result.current.panel).toBe('check')
    expect(result.current.openCell?.cell).toBe(40)
    expect(result.current.looks[3]).toMatchObject({ digit: '9', style: 'entry', uncertain: false })
    act(() => result.current.actions.yes())
    act(() => result.current.actions.yes())
    expect(result.current.panel).toBe('summary')
    expect(result.current.toCheck).toBe(0)
  })

  it('opens a sure cell on the keypad, and closes it with a second tap', () => {
    const { result } = session(review(flowScan()))
    act(() => result.current.actions.select(0))
    expect(result.current.panel).toBe('pick')
    act(() => result.current.actions.select(0))
    expect(result.current.panel).toBe('summary')
  })

  it('keeps the cells inert during the transition', () => {
    const { result } = session(capturing(flowScan(), 1.5))
    expect(result.current.editable).toBe(false)
    act(() => result.current.actions.select(0))
    expect(result.current.openCell).toBeNull()
    expect(result.current.panel).toBe('summary')
    expect(result.current.conflictCount).toBe(0)
  })

  it('moves the rings with the ring threshold and keeps the edits', () => {
    const scan = okResult({ 0: printed(5, 0.85), 1: printed(6, 0.85) })
    const { result } = session(review(scan))
    expect(result.current.toCheck).toBe(0)
    act(() => result.current.setThreshold(0.9))
    expect(result.current.toCheck).toBe(2)
  })
})

describe('the given conflicts', () => {
  it('marks two givens with the same digit, and the mark goes when one is fixed', () => {
    const { result } = session(review(okResult({ 0: printed(5), 1: printed(5) })))
    expect(result.current.conflictCount).toBe(2)
    expect([...result.current.conflictCells]).toEqual([0, 1])
    act(() => result.current.actions.select(1))
    act(() => result.current.actions.setDigit(6))
    expect(result.current.conflictCount).toBe(0)
    expect(result.current.conflictCells.size).toBe(0)
  })
})

describe('the play gate', () => {
  const checkSpy = jest.spyOn(playUtils, 'checkPlay')
  beforeEach(() => checkSpy.mockClear())
  afterAll(() => checkSpy.mockRestore())

  it('opens for givens with one solution, and hands the plain grid to onPlay with a thud', () => {
    const onPlay = jest.fn()
    const { result } = session(
      review(scanOf(puzzle.givens, { [firstOpen]: { digit: wrongDigit, kind: 'handwritten', confidence: 1 } })),
      { onPlay },
    )
    expect(result.current.block).toBeNull()
    expect(result.current.canPlay).toBe(true)
    expect(result.current.canSolve).toBe(true)
    expect(result.current.level).toBe('hard')
    act(() => result.current.actions.play())
    expect(mockPlay).toHaveBeenCalledWith('thud')
    expect(onPlay).toHaveBeenCalledTimes(1)
    const start = onPlay.mock.calls[0]![0]
    expect(start.givens).toEqual(puzzle.givens)
    expect(start.solution).toEqual(puzzle.solution)
    expect(start.entries[firstOpen]).toBe(wrongDigit)
  })

  it('stays open with uncertain cells', () => {
    const scan = scanOf(puzzle.givens, { [firstOpen]: { digit: wrongDigit, kind: 'handwritten', confidence: 0.3 } })
    expect(session(review(scan), { onPlay: jest.fn() }).result.current.canPlay).toBe(true)
  })

  it('blocks givens in conflict, with no solution and with several solutions', () => {
    const conflict = okResult({ 0: printed(5), 1: printed(5) })
    expect(session(review(conflict), { onPlay: jest.fn() }).result.current).toMatchObject({
      block: 'conflict',
      canPlay: false,
      canSolve: false,
    })
    // 1 to 8 in a row, then a 9 in the same column as the last given of the row: no digit fits cell 8.
    const none = okResult({
      0: printed(1),
      1: printed(2),
      2: printed(3),
      3: printed(4),
      4: printed(5),
      5: printed(6),
      6: printed(7),
      7: printed(8),
      17: printed(9),
    })
    expect(session(review(none)).result.current.block).toBe('none')
    expect(session(review(okResult({ 0: printed(1) }))).result.current.block).toBe('several')
  })

  it('keeps Play off without onPlay, and play() does nothing', () => {
    const { result } = session(review(scanOf(puzzle.givens)))
    expect(result.current.canPlay).toBe(false)
    act(() => result.current.actions.play())
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('does not check the givens during the transition', () => {
    session(capturing(scanOf(puzzle.givens), 1.5))
    expect(checkSpy).not.toHaveBeenCalled()
  })

  it('checks the givens when the summary shows, not while a cell is open', () => {
    const { result } = session(review(scanOf(puzzle.givens)))
    expect(checkSpy).toHaveBeenCalledTimes(1)
    act(() => result.current.actions.select(firstOpen))
    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(result.current.block).toBeNull()
    expect(result.current.canPlay).toBe(false)
    act(() => result.current.actions.setDigit(wrongDigit))
    expect(checkSpy).toHaveBeenCalledTimes(2)
  })

  it('follows an edit: a fixed conflict opens the gate', () => {
    const scan = scanOf(puzzle.givens, { [firstOpen]: { digit: 1, kind: 'printed', confidence: 1 } })
    const { result } = session(review(scan), { onPlay: jest.fn() })
    const clash = puzzle.givens.findIndex((digit, n) => n !== firstOpen && digit === 1)
    expect(clash).toBeGreaterThanOrEqual(0)
    expect(result.current.block).not.toBeNull()
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.clear())
    expect(result.current.canPlay).toBe(true)
  })

  it('shows the solution with Solve, and hides it with a second call, and at the next edit', () => {
    const { result } = session(review(scanOf(puzzle.givens)), { onPlay: jest.fn() })
    expect(result.current.solution).toBeNull()
    act(() => result.current.actions.toggleSolution())
    expect(result.current.solution).toEqual(puzzle.solution)
    act(() => result.current.actions.toggleSolution())
    expect(result.current.solution).toBeNull()
    act(() => result.current.actions.toggleSolution())
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.setDigit(wrongDigit))
    expect(result.current.solution).toBeNull()
  })
})

describe('the full grid and the celebration', () => {
  it('offers Check for a full grid and no Play', () => {
    const { result } = session(review(fullScan()), { onPlay: jest.fn() })
    expect(result.current.fullGrid).toEqual({ phase: 'ready', count: 0 })
    expect(result.current.block).toBe('full')
    expect(result.current.canPlay).toBe(false)
    expect(session(review(okResult({ 0: printed(1) }))).result.current.fullGrid).toBeNull()
  })

  it('solves, and plays the success haptic once, also when the player opens and closes a cell', () => {
    const { result } = session(review(fullScan()))
    act(() => result.current.actions.verify())
    expect(result.current.fullGrid).toEqual({ phase: 'solved', count: 0 })
    expect(result.current.solved).toBe(true)
    expect(result.current.celebrated).toBe(true)
    expect(mockPlay.mock.calls.filter(([name]) => name === 'success')).toHaveLength(1)
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.select(firstOpen))
    expect(result.current.celebrated).toBe(true)
    expect(mockPlay.mock.calls.filter(([name]) => name === 'success')).toHaveLength(1)
  })

  it('marks the wrong entry after Check, and solves when the player fixes it', () => {
    const { result } = session(review(fullScan({ cell: firstOpen, digit: wrongDigit })))
    act(() => result.current.actions.verify())
    expect(result.current.fullGrid).toEqual({ phase: 'wrong', count: 1 })
    expect(result.current.hints).toEqual({ [firstOpen]: puzzle.solution[firstOpen] })
    expect([...result.current.conflictCells]).toEqual([firstOpen])
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.setDigit(puzzle.solution[firstOpen] as 1))
    expect(result.current.solved).toBe(true)
    expect(result.current.celebrated).toBe(true)
    expect(result.current.hints).toEqual({})
  })

  it('marks no cell before the player taps Check', () => {
    const { result } = session(review(fullScan({ cell: firstOpen, digit: wrongDigit })))
    expect(result.current.conflictCells.size).toBe(0)
    expect(result.current.hints).toEqual({})
  })

  it('brings Play back when an edit empties a cell', () => {
    const { result } = session(review(fullScan()), { onPlay: jest.fn() })
    act(() => result.current.actions.verify())
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.clear())
    expect(result.current.fullGrid).toBeNull()
    expect(result.current.canPlay).toBe(true)
  })
})

type Reaction = { prepare: () => boolean; react: (now: boolean, previous: boolean | null) => void }

/** The reaction whose handler plays `name`. The session does not name its reactions, so the test finds one by what it does. */
async function reactionPlaying(name: string): Promise<Reaction> {
  for (const [prepare, react] of jest.mocked(useAnimatedReaction).mock.calls) {
    mockPlay.mockClear()
    ;(react as Reaction['react'])(true, false)
    // oxlint-disable-next-line no-await-in-loop -- each probe must settle before the next one clears mockPlay
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (mockPlay.mock.calls.some(([played]) => played === name)) {
      mockPlay.mockClear()
      return { prepare, react } as unknown as Reaction
    }
  }
  throw new Error(`no reaction plays ${name}`)
}

describe('the haptic cues', () => {
  it('ticks for Yes and No, and taps for a digit and Empty', () => {
    const { result } = session(review(flowScan()))
    act(() => result.current.actions.startCheck())
    act(() => result.current.actions.yes())
    act(() => result.current.actions.no())
    act(() => result.current.actions.setDigit(2))
    expect(mockPlay.mock.calls.map(([name]) => name)).toEqual(['tick', 'tick', 'tap'])
    act(() => result.current.actions.select(0))
    act(() => result.current.actions.clear())
    expect(mockPlay.mock.calls.map(([name]) => name)).toEqual(['tick', 'tick', 'tap', 'tap'])
  })

  it('plays nothing for the moves that open and close a cell', () => {
    const { result } = session(review(flowScan()))
    act(() => result.current.actions.startCheck())
    act(() => result.current.actions.close())
    act(() => result.current.actions.select(0))
    act(() => result.current.actions.select(0))
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('plays success when the last check makes the puzzle playable, and not for the first summary', () => {
    const scan = scanOf(puzzle.givens, { [firstOpen]: { digit: 1, kind: 'printed', confidence: 1 } })
    const { result } = session(review(scan), { onPlay: jest.fn() })
    expect(mockPlay).not.toHaveBeenCalled()
    act(() => result.current.actions.select(firstOpen))
    act(() => result.current.actions.clear())
    expect(mockPlay.mock.calls.filter(([name]) => name === 'success')).toHaveLength(1)
  })

  it('plays no success for a scan that was playable from the start', () => {
    session(review(scanOf(puzzle.givens)), { onPlay: jest.fn() })
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('plays success when the results gate opens for a recognised grid, once', async () => {
    jest.mocked(useAnimatedReaction).mockClear()
    const resultsAt = shared(-1)
    const { result } = session({ ...capturing(okResult(), 0.6), resultsAt })
    expect(result.current.panel).toBe('summary')
    const { prepare, react } = await reactionPlaying('success')
    expect(prepare()).toBe(false)
    resultsAt.value = 0.7
    expect(prepare()).toBe(true)
    react(true, false)
    await waitFor(() => expect(mockPlay).toHaveBeenCalledWith('success'))
    react(true, true)
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('plays a warning when the failure panel starts to slide, from the results gate', async () => {
    jest.mocked(useAnimatedReaction).mockClear()
    const { result } = session(capturing({ ok: false, reason: 'x' }, 0.5))
    expect(result.current.panel).toBe('failure')
    const { prepare, react } = await reactionPlaying('warning')
    expect(prepare()).toBe(false)
    react(false, null)
    expect(mockPlay).not.toHaveBeenCalled()
    react(true, false)
    await waitFor(() => expect(mockPlay).toHaveBeenCalledWith('warning'))
    react(true, true)
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('opens the failure gate with Reduce Motion at any clock value, and at the results gate without it', async () => {
    jest.mocked(useAnimatedReaction).mockClear()
    session(capturing({ ok: false, reason: 'x' }, 0, -1, true))
    expect((await reactionPlaying('warning')).prepare()).toBe(true)
    jest.mocked(useAnimatedReaction).mockClear()
    session(capturing({ ok: false, reason: 'x' }, GATE_RESULTS))
    expect((await reactionPlaying('warning')).prepare()).toBe(true)
  })
})

describe('leaving the screen', () => {
  it('reports the final grid of the latest edits when an editable screen unmounts', () => {
    const onExit = jest.fn()
    const { result, unmount } = session(review(flowScan()), { onExit })
    act(() => result.current.actions.select(0))
    act(() => result.current.actions.setDigit(8))
    expect(onExit).not.toHaveBeenCalled()
    unmount()
    expect(onExit).toHaveBeenCalledTimes(1)
    const grid = onExit.mock.calls[0]![0]
    expect(grid).toHaveLength(81)
    expect(grid[0]).toEqual({ digit: 8, kind: 'printed', digitCorrected: true, kindCorrected: false })
    expect(grid[3]).toEqual({ digit: 4, kind: 'handwritten', digitCorrected: false, kindCorrected: false })
    expect(grid[1]).toEqual({ digit: 0, kind: 'none', digitCorrected: false, kindCorrected: false })
  })

  it('does not report after a retake, and onRetake runs after the mark', () => {
    const onExit = jest.fn()
    const { result, unmount, exits } = session(review(flowScan()), { onExit })
    jest.mocked(exits.onRetake).mockImplementation(() => unmount())
    act(() => result.current.actions.retake())
    expect(exits.onRetake).toHaveBeenCalledTimes(1)
    expect(onExit).not.toHaveBeenCalled()
  })

  it('reports after Scan another: the player accepted the scan', () => {
    const onExit = jest.fn()
    const { result, unmount, exits } = session(review(fullScan()), { onExit })
    act(() => result.current.actions.scanAnother())
    expect(exits.onRetake).toHaveBeenCalledTimes(1)
    unmount()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('does not report a screen that was never editable, such as a transition that ends early', () => {
    const onExit = jest.fn()
    session(capturing(okResult(), 1.5), { onExit }).unmount()
    session(review({ ok: false, reason: 'x' }), { onExit }).unmount()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('reports an exit after the transition ended', () => {
    const onExit = jest.fn()
    const result = okResult()
    const { rerender, unmount } = session(capturing(result, 1.5), { onExit })
    rerender({ capture: review(result) })
    unmount()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a callback', () => {
    expect(() => session(review(okResult())).unmount()).not.toThrow()
  })
})

const withPhoto = () => okResult({ 0: printed(5) }, { photoPath: '/tmp/photo.jpg' })

describe('Save', () => {
  it('is offered with the photo file and onSave only', () => {
    expect(session(review(withPhoto()), { onSave: jest.fn() }).result.current.canSave).toBe(true)
    expect(session(review(withPhoto())).result.current.canSave).toBe(false)
    expect(session(review(okResult()), { onSave: jest.fn() }).result.current.canSave).toBe(false)
  })

  it('hands the final grid to onSave and shows the status', async () => {
    const onSave = jest.fn(async (_grid: FinalGrid) => true)
    const { result } = session(review(withPhoto()), { onSave })
    expect(result.current.saveState).toBe('idle')
    act(() => result.current.actions.save())
    expect(result.current.saveState).toBe('saving')
    await waitFor(() => expect(result.current.saveState).toBe('saved'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0]).toHaveLength(81)
  })

  it('says when the save failed, and a new edit makes the saved copy old', async () => {
    const { result } = session(review(withPhoto()), { onSave: jest.fn(async () => false) })
    act(() => result.current.actions.save())
    await waitFor(() => expect(result.current.saveState).toBe('failed'))
    act(() => result.current.actions.select(1))
    act(() => result.current.actions.setDigit(2))
    expect(result.current.saveState).toBe('idle')
  })
})
