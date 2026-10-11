import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import type { CellResult, RecogniseResult } from '../../scanner'
import { LIGHT } from '../../theme/colors'
import { CorrectionScreen } from './CorrectionScreen'
import { GATE_RESULTS, digitAlpha, panelAt, ringsAt } from '../transition/timeline'
import { correctionLayout } from './layout'

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
    expect(style('correction-cell-0')).toMatchObject({ color: LIGHT.text, fontWeight: '600' })
    expect(screen.getByTestId('correction-cell-1')).toHaveTextContent('7')
    expect(style('correction-cell-1')).toMatchObject({ color: LIGHT.accent, fontWeight: '500' })
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
      borderColor: LIGHT.warning,
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
    expect(screen.getByText('Tap a digit to fix it')).toBeTruthy()
    expect(screen.getByTestId('play').props.accessibilityState).toMatchObject({ disabled: true })
    expect(style('play').opacity).toBe(0.5)
  })

  it('calls onRetake', () => {
    const onRetake = jest.fn()
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={onRetake} />)
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('draws the background and the board', () => {
    render(<CorrectionScreen result={okResult()} layout={layout} onRetake={jest.fn()} />)
    expect(style('correction-screen').backgroundColor).toBe(LIGHT.background)
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
