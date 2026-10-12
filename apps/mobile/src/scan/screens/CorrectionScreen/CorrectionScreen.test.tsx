import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import { generate } from '@sudoku/core'
import type { CellResult, RecogniseResult } from '@/scanner'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { createPicture, Skia } from '@shopify/react-native-skia'
import type { Theme } from '@/theme/theme.types'
import { daylight } from '@/theme/themes/daylight'
import { midnight } from '@/theme/themes/midnight'
import { CorrectionScreen } from './CorrectionScreen'
import { digitAlpha, panelAt, ringsAt } from '@/scan/utils/transition.utils'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'

const layout = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 })
const empty = (): CellResult => ({ digit: 0, kind: 'none', confidence: 1, validPair: true })

function okResult(over: { [n: number]: Partial<CellResult> } = {}): RecogniseResult {
  const cells = Array.from({ length: 81 }, (_, n) => ({ ...empty(), ...over[n] }))
  return { ok: true, cells, quad: [] as never, corners: 'detected' as never, cornerOffset: null, timings: {} as never }
}

const given = { digit: 5, kind: 'printed', confidence: 1 } as const
const entry = { digit: 7, kind: 'handwritten', confidence: 1 } as const
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)
const clock = (value: number) => ({ value }) as SharedValue<number>

describe('CorrectionScreen in review', () => {
  it('styles the digits as given, entry and empty from the tokens', () => {
    render(<CorrectionScreen result={okResult({ 0: given, 1: entry })} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('5')
    expect(style('correction-cell-0')).toMatchObject({
      color: daylight.components.cell.given,
      fontFamily: daylight.type.given.family,
      fontWeight: daylight.type.given.weight,
    })
    expect(screen.getByTestId('correction-cell-1')).toHaveTextContent('7')
    expect(style('correction-cell-1')).toMatchObject({
      color: daylight.components.cell.entry,
      fontFamily: daylight.type.entry.family,
      fontWeight: daylight.type.entry.weight,
    })
    expect(screen.getByTestId('correction-cell-2')).toHaveTextContent('')
  })

  it('draws a dashed ring only on the uncertain cells', () => {
    render(
      <CorrectionScreen
        result={okResult({ 0: { ...given, confidence: 0.5 }, 1: entry, 2: { validPair: false } })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.getByTestId('correction-ring-0')).toBeTruthy()
    expect(screen.getByTestId('correction-ring-2')).toBeTruthy()
    expect(screen.queryByTestId('correction-ring-1')).toBeNull()
    expect(style('correction-ring-0')).toMatchObject({
      borderStyle: 'dashed',
      borderWidth: 1.5,
      borderColor: daylight.colors.warning,
      borderRadius: 6,
    })
  })

  it('shows the count of cells to check', () => {
    render(
      <CorrectionScreen
        result={okResult({ 0: { confidence: 0.1 }, 1: { confidence: 0.1 } })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.getByText('● 2 cells to check')).toBeTruthy()
  })

  it('says all cells look sure when none needs a check', () => {
    render(<CorrectionScreen result={okResult({ 0: given })} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByText('All cells look sure')).toBeTruthy()
    expect(screen.queryByText(/to check/)).toBeNull()
  })

  it('shows the title and a disabled Play button', () => {
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByText('Check the scan')).toBeTruthy()
    expect(screen.getByText('Tap a cell to fix it')).toBeTruthy()
    expect(screen.getByTestId('play').props.accessibilityState).toMatchObject({ disabled: true })
    expect(style('play').opacity).toBe(0.5)
  })

  it('calls onRetake', () => {
    const onRetake = jest.fn()
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={onRetake} />)
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('takes the panel colour from the theme styles, not from an inline object', () => {
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    const own = screen.getByTestId('correction-panel').props.style.flat(Infinity)
    expect(own).toContainEqual(
      expect.objectContaining({
        backgroundColor: daylight.colors.surface,
        shadowColor: daylight.colors.shadow,
        borderRadius: 24,
      }),
    )
  })

  it('fills the board with the cell fill token, the same token as the transition canvas', () => {
    // A theme whose cell fill differs from its surface, so the test sees which token the board reads.
    const theme: Theme = {
      ...daylight,
      components: { ...daylight.components, cell: { ...daylight.components.cell, fill: midnight.colors.accent } },
    }
    const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    const theming = jest
      .spyOn(unistyles, 'useUnistyles')
      .mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
    const paint = jest.spyOn(Skia, 'Paint')
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    const record = jest.mocked(createPicture).mock.lastCall?.[0]
    record?.({ drawRect: jest.fn(), drawLine: jest.fn() } as never)
    const colours = paint.mock.results.flatMap((r) =>
      jest.mocked(r.value.setColor).mock.calls.map((c: unknown[]) => c[0]),
    )
    expect(colours).toContain(midnight.colors.accent)
    expect(colours).not.toContain(daylight.colors.surface)
    paint.mockRestore()
    theming.mockRestore()
  })

  it('draws the background and the board', () => {
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    expect(style('correction-screen').backgroundColor).toBe(daylight.colors.background)
    expect(screen.getByTestId('skia-canvas')).toBeTruthy()
  })

  it('shows the failure and Retake, without digits', () => {
    const onRetake = jest.fn()
    render(<CorrectionScreen result={{ ok: false, reason: 'no grid' }} layout={layout} onRetake={onRetake} />)
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    expect(screen.getByText('no grid')).toBeTruthy()
    expect(screen.queryByTestId('correction-cell-0')).toBeNull()
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('shows a spinner while it waits for the result', () => {
    render(
      <CorrectionScreen
        result={null}
        layout={layout}
        onRetake={jest.fn()}
        waiting={{ value: true } as SharedValue<boolean>}
      />,
    )
    expect(style('correction-waiting').opacity).toBe(1)
    expect(screen.queryByTestId('correction-panel')).toBeNull()
  })

  it('hides the spinner when it does not wait', () => {
    render(
      <CorrectionScreen
        result={null}
        layout={layout}
        onRetake={jest.fn()}
        waiting={{ value: false } as SharedValue<boolean>}
      />,
    )
    expect(style('correction-waiting').opacity).toBe(0)
  })
})

const failureUi = (shared: SharedValue<number>, reduceMotion = false) => (
  <CorrectionScreen
    result={{ ok: false, reason: 'x' }}
    layout={layout}
    onRetake={jest.fn()}
    clock={shared}
    reduceMotion={reduceMotion}
  />
)
const HIDDEN = layout.panel.height * 1.4

/** The failure slide reaction of the last render: its condition and its handler. The mock runs neither. */
function slideReaction() {
  const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)! as unknown as [
    () => boolean,
    (go: boolean, previous: boolean | null) => void,
  ]
  return { prepare, react }
}

describe('CorrectionScreen with a clock', () => {
  it('draws no background and no board', () => {
    render(<CorrectionScreen result={okResult({ 0: given })} layout={layout} onRetake={jest.fn()} clock={clock(1.5)} />)
    expect(style('correction-screen').backgroundColor).toBeUndefined()
    expect(screen.queryByTestId('skia-canvas')).toBeNull()
  })

  it('shows everything at the end of the transition', () => {
    render(
      <CorrectionScreen
        result={okResult({ 0: { ...given, confidence: 0.2 }, 80: entry })}
        layout={layout}
        onRetake={jest.fn()}
        clock={clock(1.5)}
      />,
    )
    expect(style('correction-cell-0').opacity).toBe(1)
    expect(style('correction-cell-80').opacity).toBe(1)
    expect(style('correction-ring-0').opacity).toBe(1)
    expect(style('correction-panel').transform).toEqual([{ translateY: 0 }])
  })

  it('hides everything at the start', () => {
    render(
      <CorrectionScreen
        result={okResult({ 0: { ...given, confidence: 0.2 } })}
        layout={layout}
        onRetake={jest.fn()}
        clock={clock(0)}
      />,
    )
    expect(style('correction-cell-0').opacity).toBe(0)
    expect(style('correction-ring-0').opacity).toBe(0)
    expect(style('correction-panel').transform).toEqual([{ translateY: layout.panel.height * 1.4 }])
  })

  it('starts the failure slide when the clock reaches the results gate, not when the failure comes', () => {
    const { rerender } = render(failureUi(clock(0.5)))
    expect(slideReaction().prepare()).toBe(false)
    expect(style('correction-panel').transform).toEqual([{ translateY: HIDDEN }])
    rerender(failureUi(clock(GATE_RESULTS)))
    const { prepare, react } = slideReaction()
    expect(prepare()).toBe(true)
    react(true, false)
    // The mock does not react to the shared value, so the next render reads the value that the reaction set.
    rerender(failureUi(clock(GATE_RESULTS)))
    expect(style('correction-panel').transform).toEqual([{ translateY: 0 }])
  })

  it('starts the failure slide with Reduce Motion and the clock held at 0', () => {
    const { rerender } = render(failureUi(clock(0), true))
    const { prepare, react } = slideReaction()
    expect(prepare()).toBe(true)
    react(true, null)
    rerender(failureUi(clock(0), true))
    expect(style('correction-panel').transform).toEqual([{ translateY: 0 }])
  })

  it('keeps the failure panel down before the results gate', () => {
    render(
      <CorrectionScreen result={{ ok: false, reason: 'x' }} layout={layout} onRetake={jest.fn()} clock={clock(0.5)} />,
    )
    expect(style('correction-panel').transform).toEqual([{ translateY: HIDDEN }])
  })

  it('raises each digit 3 pt while it fades in', () => {
    const result = okResult({ 0: given })
    const { rerender } = render(
      <CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} clock={clock(0)} />,
    )
    expect(style('correction-cell-0').transform).toEqual([{ translateY: 3 }])
    const alpha = digitAlpha(0.6, 0, 0, false)
    rerender(<CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} clock={clock(0.6)} />)
    expect(style('correction-cell-0').transform[0].translateY).toBeCloseTo((1 - alpha) * 3, 12)
    rerender(<CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} clock={clock(1.5)} />)
    expect(style('correction-cell-0').transform).toEqual([{ translateY: 0 }])
  })
})

const late = (t: number, at: number) => (
  <CorrectionScreen
    result={okResult({ 0: { ...given, confidence: 0.2 } })}
    layout={layout}
    onRetake={jest.fn()}
    clock={clock(t)}
    resultsAt={clock(at)}
  />
)

describe('CorrectionScreen with late results', () => {
  it('starts the digit sweep when the results came, so no digit pops in', () => {
    render(late(0.7, GATE_RESULTS))
    expect(style('correction-cell-0').opacity).toBe(0)
  })

  it('takes the clock as the arrival while the UI thread has not written resultsAt', () => {
    render(late(0.65, -1))
    expect(style('correction-cell-0').opacity).toBe(0)
  })

  it('moves the rings and the panel later by the same shift', () => {
    render(late(1.4, GATE_RESULTS))
    expect(style('correction-ring-0').opacity).toBeCloseTo(ringsAt(1.4, false, 0.15), 12)
    expect(style('correction-ring-0').opacity).toBeLessThan(1)
    expect(style('correction-panel').transform[0].translateY).toBeCloseTo((1 - panelAt(1.4, false, 0.15)) * HIDDEN, 9)
  })

  it('shows everything at the moved end', () => {
    render(late(1.65, GATE_RESULTS))
    expect(style('correction-cell-0').opacity).toBe(1)
    expect(style('correction-ring-0').opacity).toBe(1)
    expect(style('correction-panel').transform).toEqual([{ translateY: 0 }])
  })
})

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID))
const ui = (result: RecogniseResult) => <CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} />

describe('CorrectionScreen edits', () => {
  it('selects a cell on tap and shows the pad in place of Play and Retake', () => {
    render(ui(okResult({ 0: given })))
    expect(screen.queryByTestId('correction-pad')).toBeNull()
    press('correction-press-0')
    expect(screen.getByTestId('correction-pad')).toBeTruthy()
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.selected })
    expect(screen.queryByTestId('play')).toBeNull()
    expect(screen.queryByTestId('retake')).toBeNull()
  })

  it('sets a digit, and Done brings back Play and Retake', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-key-4')
    expect(screen.getByTestId('correction-cell-2')).toHaveTextContent('4')
    expect(style('correction-cell-2')).toMatchObject({ color: daylight.components.cell.given })
    press('correction-done')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
    expect(screen.queryByTestId('correction-fill-2')).toBeNull()
    expect(screen.getByTestId('play')).toBeTruthy()
    expect(screen.getByTestId('retake')).toBeTruthy()
  })

  it('closes the pad with a second tap on the selected cell', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-press-2')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
  })

  it('clears a cell', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-0')
    press('correction-clear')
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('')
  })

  it('switches a given to an entry, and the style follows at once', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-0')
    press('correction-kind-entry')
    expect(style('correction-cell-0')).toMatchObject({
      color: daylight.components.cell.entry,
      fontWeight: daylight.type.entry.weight,
    })
    press('correction-kind-given')
    expect(style('correction-cell-0')).toMatchObject({
      color: daylight.components.cell.given,
      fontWeight: daylight.type.given.weight,
    })
  })

  it('removes the ring of a changed cell, and the count follows', () => {
    render(ui(okResult({ 0: { ...given, confidence: 0.5 }, 1: { confidence: 0.1 } })))
    expect(screen.getByText('● 2 cells to check')).toBeTruthy()
    press('correction-press-0')
    press('correction-key-5')
    expect(screen.queryByTestId('correction-ring-0')).toBeNull()
    press('correction-done')
    expect(screen.getByText('● 1 cell to check')).toBeTruthy()
  })

  it('marks two givens with the same digit, and the mark goes when one becomes an entry', () => {
    render(ui(okResult({ 0: given, 8: given })))
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(style('correction-fill-8')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(screen.getByText('● 2 givens in conflict')).toBeTruthy()
    press('correction-press-8')
    press('correction-kind-entry')
    press('correction-done')
    expect(screen.queryByTestId('correction-fill-0')).toBeNull()
    expect(screen.queryByTestId('correction-fill-8')).toBeNull()
    expect(screen.queryByText(/in conflict/)).toBeNull()
  })

  it('makes a new conflict visible at once', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-1')
    press('correction-key-5')
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
    expect(style('correction-fill-1')).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  })

  it('does not say that all cells look sure while givens are in conflict', () => {
    render(ui(okResult({ 0: given, 8: given })))
    expect(screen.queryByText('All cells look sure')).toBeNull()
  })

  it('keeps the cells inert during the transition', () => {
    render(<CorrectionScreen result={okResult({ 0: given })} layout={layout} onRetake={jest.fn()} clock={clock(1.5)} />)
    expect(screen.getByTestId('correction-press-0').props.accessibilityState).toMatchObject({ disabled: true })
    press('correction-press-0')
    expect(screen.queryByTestId('correction-pad')).toBeNull()
  })

  it('shows no conflict mark during the transition', () => {
    render(
      <CorrectionScreen
        result={okResult({ 0: given, 8: given })}
        layout={layout}
        onRetake={jest.fn()}
        clock={clock(1.5)}
      />,
    )
    expect(screen.queryByTestId('correction-fill-0')).toBeNull()
    expect(screen.queryByTestId('correction-fill-8')).toBeNull()
  })

  it('labels each cell for VoiceOver', () => {
    render(ui(okResult({ 0: given, 1: entry })))
    expect(screen.getByLabelText('Row 1, column 1, given 5')).toBeTruthy()
    expect(screen.getByLabelText('Row 1, column 2, entry 7')).toBeTruthy()
  })

  it('does not change the result it got', () => {
    const result = okResult({ 0: given })
    const before = JSON.parse(JSON.stringify(result))
    render(ui(result))
    press('correction-press-0')
    press('correction-kind-entry')
    press('correction-key-2')
    expect(result).toEqual(before)
  })
})

const puzzle = generate('hard', 5)
const firstOpen = puzzle.givens.findIndex((digit) => digit === 0)
const wrongDigit = ((puzzle.solution[firstOpen] ?? 0) % 9) + 1

/** A recognised result with every given of `givens` printed, and `over` on top. */
function scanOf(givens: readonly number[], over: { [n: number]: Partial<CellResult> } = {}): RecogniseResult {
  const printed: { [n: number]: Partial<CellResult> } = {}
  givens.forEach((digit, n) => {
    if (digit !== 0) printed[n] = { digit, kind: 'printed', confidence: 1 }
  })
  return okResult({ ...printed, ...over })
}

const playUi = (result: RecogniseResult, onPlay = jest.fn<void, [ScannedStart]>()) => {
  render(<CorrectionScreen result={result} layout={layout} onRetake={jest.fn()} onPlay={onPlay} />)
  return onPlay
}
const playOn = () => screen.getByTestId('play').props.accessibilityState.disabled === false

describe('CorrectionScreen play gate', () => {
  it('turns Play on for givens with one solution, and hands over the plain grid', () => {
    const onPlay = playUi(
      scanOf(puzzle.givens, { [firstOpen]: { digit: wrongDigit, kind: 'handwritten', confidence: 1 } }),
    )
    expect(playOn()).toBe(true)
    expect(style('play').opacity).toBeUndefined()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
    press('play')
    expect(onPlay).toHaveBeenCalledTimes(1)
    const start = onPlay.mock.calls[0]![0]
    expect(start.level).toBe('hard')
    expect(start.puzzle.givens).toEqual(puzzle.givens)
    expect(start.puzzle.solution).toEqual(puzzle.solution)
    expect(start.puzzle.entries[firstOpen]).toBe(wrongDigit)
  })

  it('keeps Play on with uncertain cells', () => {
    const shaky = puzzle.givens.findIndex((digit) => digit !== 0)
    playUi(scanOf(puzzle.givens, { [shaky]: { digit: puzzle.givens[shaky] ?? 0, kind: 'printed', confidence: 0.2 } }))
    expect(screen.getByText('● 1 cell to check')).toBeTruthy()
    expect(playOn()).toBe(true)
  })

  it('blocks two givens in conflict, and the chip says why', () => {
    playUi(okResult({ 0: given, 8: given }))
    expect(playOn()).toBe(false)
    expect(screen.getByText('● 2 givens in conflict')).toBeTruthy()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
  })

  it('blocks givens with no solution and says so', () => {
    const givens = puzzle.givens.map((_, cell) => (cell < 8 ? cell + 1 : cell === 17 ? 9 : 0))
    playUi(scanOf(givens))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('This puzzle has no solution. Check the marked cells.')
    expect(style('play-blocked')).toMatchObject({ color: daylight.colors.danger })
  })

  it('blocks givens with several solutions and says so', () => {
    const onPlay = playUi(scanOf(puzzle.givens.map((digit, cell) => (cell < 40 ? 0 : digit))))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('A given is missing or wrong.')
    expect(screen.getByTestId('play').props.accessibilityHint).toBe('A given is missing or wrong.')
    press('play')
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('blocks a scan that is already solved', () => {
    const over: { [n: number]: Partial<CellResult> } = {}
    puzzle.solution.forEach((digit, n) => {
      if (puzzle.givens[n] === 0) over[n] = { digit, kind: 'handwritten', confidence: 1 }
    })
    playUi(scanOf(puzzle.givens, over))
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('This puzzle is already solved.')
  })

  it('follows an edit: a fixed conflict turns Play on', () => {
    // A misread gives the second given of row 1 the digit of the first.
    const row = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => puzzle.givens[cell] !== 0)
    const [first, second] = row as [number, number]
    playUi(scanOf(puzzle.givens, { [second]: { digit: puzzle.givens[first] ?? 0, kind: 'printed', confidence: 1 } }))
    expect(playOn()).toBe(false)
    press(`correction-press-${second}`)
    press(`correction-key-${puzzle.givens[second]}`)
    press('correction-done')
    expect(playOn()).toBe(true)
  })

  it('keeps Play off without onPlay', () => {
    render(<CorrectionScreen result={scanOf(puzzle.givens)} layout={layout} onRetake={jest.fn()} />)
    expect(playOn()).toBe(false)
  })

  it('does not check the givens during the transition', () => {
    render(
      <CorrectionScreen
        result={scanOf(puzzle.givens)}
        layout={layout}
        onRetake={jest.fn()}
        onPlay={jest.fn()}
        clock={clock(1.5)}
      />,
    )
    expect(playOn()).toBe(false)
    expect(screen.queryByTestId('play-blocked')).toBeNull()
  })
})
