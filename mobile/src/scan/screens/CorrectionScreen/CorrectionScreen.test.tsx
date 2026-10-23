import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { StyleSheet } from 'react-native'
import { type SharedValue, useAnimatedReaction, useReducedMotion } from 'react-native-reanimated'
import { IntlProvider } from 'react-intl'
import { generate } from '@sudoku/core'
import { CATALOGUES } from '@/i18n/messages'
import type { CellResult } from '@/scanner'
import type { CaptureOk, CaptureResult } from '@/scan/utils/captureResult.utils'
import * as playUtils from '@/scan/utils/play.utils'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { createPicture, Skia } from '@shopify/react-native-skia'
import type { Theme } from '@/theme/theme.types'
import { cobalt } from '@/theme/themes/cobalt'
import { forest } from '@/theme/themes/forest'
import { bordeaux } from '@/theme/themes/bordeaux'
import { capturing, okResult, review } from '@/scan/scanTestKit'
import { CorrectionScreen } from './CorrectionScreen'
import { digitAlpha, panelAt, ringsAt } from '@/scan/utils/transition.utils'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'

jest.mock('@/scan/components/ScanInspector', () => {
  const { View } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return {
    ...jest.requireActual('@/scan/components/ScanInspector/ScanTabs'),
    ScanInspector: ({ view, threshold }: { view: string; threshold: number }) =>
      createElement(View, { testID: `inspector-${view}`, threshold }),
  }
})

const layout = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 })
const given = { digit: 5, kind: 'printed', confidence: 1 } as const
const entry = { digit: 7, kind: 'handwritten', confidence: 1 } as const
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)
const clock = (value: number) => ({ value }) as SharedValue<number>
/** The entering animation of the nearest element, the node itself or above it, that takes one. */
const entering = (node: ReturnType<typeof screen.getByTestId> | null): unknown => {
  for (let at = node; at; at = at.parent) if ('entering' in at.props) return at.props.entering
  return undefined
}

describe('CorrectionScreen in review', () => {
  it('styles the digits as given, entry and empty from the tokens', () => {
    render(<CorrectionScreen session={review(okResult({ 0: given, 1: entry }))} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('5')
    expect(style('correction-cell-0')).toMatchObject({
      color: cobalt.components.cell.given,
      fontFamily: cobalt.type.given.family,
      fontWeight: cobalt.type.given.weight,
    })
    expect(screen.getByTestId('correction-cell-1')).toHaveTextContent('7')
    expect(style('correction-cell-1')).toMatchObject({
      color: cobalt.components.cell.entry,
      fontFamily: cobalt.type.entry.family,
      fontWeight: cobalt.type.entry.weight,
    })
    expect(screen.getByTestId('correction-cell-2')).toHaveTextContent('')
  })

  it('draws a dashed ring only on the uncertain cells', () => {
    render(
      <CorrectionScreen
        session={review(okResult({ 0: { ...given, confidence: 0.5 }, 1: entry, 2: { validPair: false } }))}
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
      borderColor: cobalt.colors.warning,
      borderRadius: cobalt.shape.radius.pill,
    })
    expect(cobalt.components.checkRing.color).toBe(cobalt.colors.warning)
  })

  it('shows the count of cells to check', () => {
    render(
      <CorrectionScreen
        session={review(okResult({ 0: { confidence: 0.1 }, 1: { confidence: 0.1 } }))}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.getByText('2 cells to check')).toBeTruthy()
  })

  it('shows the title, no level and a disabled Play button', () => {
    render(<CorrectionScreen session={review(okResult())} layout={layout} onRetake={jest.fn()} />)
    expect(screen.getByText('Check the scan')).toBeTruthy()
    expect(screen.getByTestId('correction-level').props.children).toBe('')
    expect(screen.getByTestId('play').props.accessibilityState).toMatchObject({ disabled: true })
    expect(style('play-fade').opacity).toBe(cobalt.opacity.disabled)
  })

  it('calls onRetake', () => {
    const onRetake = jest.fn()
    render(<CorrectionScreen session={review(okResult())} layout={layout} onRetake={onRetake} />)
    fireEvent.press(screen.getByTestId('retake'))
    expect(onRetake).toHaveBeenCalledTimes(1)
  })

  it('takes the panel colour from the theme styles, not from an inline object', () => {
    render(<CorrectionScreen session={review(okResult())} layout={layout} onRetake={jest.fn()} />)
    const own = screen.getByTestId('correction-panel').props.style.flat(Infinity)
    expect(own).toContainEqual(
      expect.objectContaining({
        backgroundColor: cobalt.components.panel.fill,
        borderTopLeftRadius: cobalt.components.panel.radius,
        boxShadow: cobalt.elevation.panel,
      }),
    )
  })

  it('fills the board with the cell fill token, the same token as the transition canvas', () => {
    // A theme whose cell fill differs from its surface, so the test sees which token the board reads.
    const theme: Theme = {
      ...cobalt,
      components: { ...cobalt.components, cell: { ...cobalt.components.cell, fill: forest.colors.accent } },
    }
    const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    const theming = jest
      .spyOn(unistyles, 'useUnistyles')
      .mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
    const paint = jest.spyOn(Skia, 'Paint')
    render(<CorrectionScreen session={review(okResult())} layout={layout} onRetake={jest.fn()} />)
    for (const [record] of jest.mocked(createPicture).mock.calls.slice(-2)) {
      record({ drawRect: jest.fn(), drawLine: jest.fn() } as never)
    }
    const colours = paint.mock.results.flatMap((r) =>
      jest.mocked(r.value.setColor).mock.calls.map((c: unknown[]) => c[0]),
    )
    expect(colours).toContain(forest.colors.accent)
    expect(colours).not.toContain(cobalt.colors.surface)
    paint.mockRestore()
    theming.mockRestore()
  })

  it('draws the grid lines over the cells, so the fill of an open cell never covers a line', () => {
    render(<CorrectionScreen session={review(okResult({ 0: given }))} layout={layout} onRetake={jest.fn()} />)
    const order = screen
      .getByTestId('correction-screen')
      .props.children.flat(Infinity)
      .filter(Boolean)
      .map(
        (child: { props?: { testID?: string; n?: number } }) =>
          child.props?.testID ?? (child.props?.n === 0 ? 'cell-0' : null),
      )
    expect(order.indexOf('correction-board')).toBeLessThan(order.indexOf('cell-0'))
    expect(order.indexOf('cell-0')).toBeLessThan(order.indexOf('correction-lines'))
    expect(screen.getByTestId('correction-lines').props.pointerEvents).toBe('none')
  })

  it('draws the background and the board', () => {
    render(<CorrectionScreen session={review(okResult())} layout={layout} onRetake={jest.fn()} />)
    expect(style('correction-screen').backgroundColor).toBe(cobalt.colors.background)
    expect(style('correction-board').opacity).toBe(1)
    expect(style('correction-lines').opacity).toBe(1)
  })

  it('shows the failure and Retake, without digits', () => {
    const onRetake = jest.fn()
    render(<CorrectionScreen session={review({ ok: false, reason: 'no grid' })} layout={layout} onRetake={onRetake} />)
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    // A reason that the screen does not know reads as a plain failure. The log keeps the reason.
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.queryByTestId('correction-cell-0')).toBeNull()
    fireEvent.press(screen.getByTestId('retake'))
    fireEvent.press(screen.getByTestId('retake-failure'))
    expect(onRetake).toHaveBeenCalledTimes(2)
  })

  it('offers another image when an import has no grid', () => {
    const onRetake = jest.fn()
    const onChooseImage = jest.fn()
    render(
      <CorrectionScreen
        session={review({ ok: false, reason: 'no grid in the photo' }, 'library')}
        layout={layout}
        onRetake={onRetake}
        onChooseImage={onChooseImage}
      />,
    )
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/No sudoku found/)
    expect(screen.getByText('Choose an image that shows the whole grid.')).toBeTruthy()
    expect(screen.queryByTestId('retake-failure')).toBeNull()
    fireEvent.press(screen.getByTestId('choose-another'))
    expect(onChooseImage).toHaveBeenCalledTimes(1)
    expect(onRetake).not.toHaveBeenCalled()
  })

  it('tells the player to hold the phone over the grid when the photo has no grid', () => {
    render(
      <CorrectionScreen
        session={review({ ok: false, reason: 'no grid in the photo' })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.getByText('No grid in the photo. Hold the phone over the whole grid.')).toBeTruthy()
  })

  it('shows the failure in Dutch', () => {
    render(
      <IntlProvider locale="nl-BE" messages={CATALOGUES.nl}>
        <CorrectionScreen
          session={review({ ok: false, reason: 'no grid in the photo' })}
          layout={layout}
          onRetake={jest.fn()}
        />
      </IntlProvider>,
    )
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/De scan is mislukt/)
    expect(screen.getByText('Geen rooster op de foto. Houd de telefoon boven het hele rooster.')).toBeTruthy()
    expect(screen.getAllByText('Opnieuw')).toHaveLength(2)
  })

  it('offers another image when an import fails for another reason', () => {
    render(
      <CorrectionScreen
        session={review({ ok: false, reason: 'the file is not an image' }, 'library')}
        layout={layout}
        onRetake={jest.fn()}
        onChooseImage={jest.fn()}
      />,
    )
    expect(screen.getByTestId('correction-failure')).toHaveTextContent(/The scan failed/)
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
    expect(screen.getByTestId('choose-another')).toBeTruthy()
    expect(screen.queryByTestId('retake-failure')).toBeNull()
  })

  it('shows a spinner while it waits for the result', () => {
    render(
      <CorrectionScreen
        session={capturing(null, { waiting: { value: true } as SharedValue<boolean> })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(style('correction-waiting').opacity).toBe(1)
    expect(screen.queryByTestId('correction-panel')).toBeNull()
  })

  it('hides the spinner when it does not wait', () => {
    render(
      <CorrectionScreen
        session={capturing(null, { waiting: { value: false } as SharedValue<boolean> })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(style('correction-waiting').opacity).toBe(0)
  })
})

const failureUi = (shared: SharedValue<number>, reduceMotion = false) => (
  <CorrectionScreen
    session={capturing({ ok: false, reason: 'x' }, { clock: shared, crossFade: reduceMotion })}
    layout={layout}
    onRetake={jest.fn()}
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
  it('draws no background, and mounts the board and the lines hidden, so they have drawn when the transition ends', () => {
    render(
      <CorrectionScreen
        session={capturing(okResult({ 0: given }), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(style('correction-screen').backgroundColor).toBeUndefined()
    expect(style('correction-board').opacity).toBe(0)
    expect(style('correction-lines').opacity).toBe(0)
  })

  it('shows everything at the end of the transition', () => {
    render(
      <CorrectionScreen
        session={capturing(okResult({ 0: { ...given, confidence: 0.2 }, 80: entry }), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
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
        session={capturing(okResult({ 0: { ...given, confidence: 0.2 } }), { clock: clock(0) })}
        layout={layout}
        onRetake={jest.fn()}
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
      <CorrectionScreen
        session={capturing({ ok: false, reason: 'x' }, { clock: clock(0.5) })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(style('correction-panel').transform).toEqual([{ translateY: HIDDEN }])
  })

  it('raises each digit 3 pt while it fades in', () => {
    const result = okResult({ 0: given })
    const { rerender } = render(
      <CorrectionScreen session={capturing(result, { clock: clock(0) })} layout={layout} onRetake={jest.fn()} />,
    )
    expect(style('correction-cell-0').transform).toEqual([{ translateY: 3 }])
    const alpha = digitAlpha(0.6, 0, 0, false)
    rerender(
      <CorrectionScreen session={capturing(result, { clock: clock(0.6) })} layout={layout} onRetake={jest.fn()} />,
    )
    expect(style('correction-cell-0').transform[0].translateY).toBeCloseTo((1 - alpha) * 3, 12)
    rerender(
      <CorrectionScreen session={capturing(result, { clock: clock(1.5) })} layout={layout} onRetake={jest.fn()} />,
    )
    expect(style('correction-cell-0').transform).toEqual([{ translateY: 0 }])
  })
})

const late = (t: number, at: number) => (
  <CorrectionScreen
    session={capturing(okResult({ 0: { ...given, confidence: 0.2 } }), { clock: clock(t), resultsAt: clock(at) })}
    layout={layout}
    onRetake={jest.fn()}
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
const ui = (result: CaptureResult) => <CorrectionScreen session={review(result)} layout={layout} onRetake={jest.fn()} />
const shaky = (digit: number, confidence: number, second = 1) =>
  ({ digit, kind: 'printed', confidence, second }) as const

// Three cells to check, in reading order: 3, 40 and 70.
const flowScan = () => okResult({ 0: given, 3: shaky(4, 0.5, 9), 40: shaky(2, 0.6), 70: { confidence: 0.4 } })

describe('CorrectionScreen check flow', () => {
  it('opens the first cell to check from the summary, with the progress and the question', () => {
    render(ui(flowScan()))
    expect(screen.getByText('3 cells to check')).toBeTruthy()
    press('start-check')
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this a 4?')
    expect(screen.getByText('Row 1, column 4')).toBeTruthy()
    expect(screen.getByLabelText('0 of 3 cells checked')).toBeTruthy()
    expect(screen.getByTestId('correction-yes')).toHaveTextContent('Yes, 4')
    expect(screen.getByTestId('cell-crop')).toBeTruthy()
    expect(style('correction-fill-3')).toMatchObject({ backgroundColor: cobalt.colors.warningSurface })
  })

  it('ticks for Yes', () => {
    render(ui(flowScan()))
    press('start-check')
    jest.mocked(Haptics.selectionAsync).mockClear()
    press('correction-yes')
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)
  })

  it('moves to the next cell after Yes and removes the ring', () => {
    render(ui(flowScan()))
    press('start-check')
    press('correction-yes')
    expect(screen.queryByTestId('correction-ring-3')).toBeNull()
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this a 2?')
    expect(screen.getByLabelText('1 of 3 cells checked')).toBeTruthy()
  })

  it('shows the keypad after No, with the second guess ringed, and a digit fixes the cell and moves on', () => {
    render(ui(flowScan()))
    press('start-check')
    press('correction-no')
    expect(screen.getByTestId('correction-question')).toHaveTextContent('What is it?')
    expect(screen.getByTestId('correction-key-9')).toContainElement(screen.getByTestId('correction-hint'))
    press('correction-key-9')
    expect(screen.getByTestId('correction-cell-3')).toHaveTextContent('9')
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this a 2?')
  })

  it('goes back to the summary after the last cell, ready to check the givens', () => {
    render(ui(flowScan()))
    press('start-check')
    press('correction-yes')
    press('correction-yes')
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Is this empty?')
    press('correction-yes')
    expect(screen.queryByTestId('correction-check')).toBeNull()
    expect(screen.getByTestId('correction-summary')).toBeTruthy()
    expect(screen.queryByText(/to check/)).toBeNull()
  })

  it('closes the check at any time, and the count follows the answers', () => {
    render(ui(flowScan()))
    press('start-check')
    press('correction-yes')
    press('correction-close')
    expect(screen.getByTestId('correction-summary')).toBeTruthy()
    expect(screen.getByText('2 cells to check')).toBeTruthy()
  })

  it('opens a sure cell on the keypad, and an edit goes back to the summary', () => {
    render(ui(flowScan()))
    press('correction-press-0')
    expect(screen.getByTestId('correction-question')).toHaveTextContent('Change this 5')
    expect(screen.queryByTestId('correction-progress')).toBeNull()
    // The tile lies on the square of cell 0, in the tile colour, under the cell.
    const cell = style('correction-press-0')
    expect(style('correction-tile')).toMatchObject({
      left: cell.left,
      top: cell.top,
      width: cell.width,
      backgroundColor: cobalt.components.cell.selectedTile,
    })
    expect(screen.queryByTestId('correction-fill-0')).toBeNull()
    press('correction-key-6')
    expect(screen.queryByTestId('correction-tile')).toBeNull()
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('6')
    expect(screen.getByTestId('correction-summary')).toBeTruthy()
  })

  it('plays the swap when the panel changes state, and grows the panel to the keypad', () => {
    render(ui(flowScan()))
    expect(entering(screen.getByTestId('correction-summary'))).toBeDefined()
    expect(screen.getByTestId('correction-panel').props.layout).toBeDefined()
    press('start-check')
    expect(entering(screen.getByTestId('correction-check'))).toBeDefined()
  })

  it('keeps the panel content for the next cell, and fades in only the new text', () => {
    render(ui(flowScan()))
    press('start-check')
    const check = screen.getByTestId('correction-check')
    press('correction-yes')
    expect(screen.getByTestId('correction-check')).toBe(check)
    expect(entering(screen.getByTestId('correction-question'))).toBeDefined()
    expect(entering(screen.getByText('Yes, 2'))).toBeDefined()
  })

  it('plays no swap and no resize with Reduce Motion', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    render(ui(flowScan()))
    press('start-check')
    expect(entering(screen.getByTestId('correction-check'))).toBeUndefined()
    expect(screen.getByTestId('correction-panel').props.layout).toBeUndefined()
    expect(entering(screen.getByTestId('correction-question'))).toBeUndefined()
    jest.mocked(useReducedMotion).mockReturnValue(false)
  })

  it('makes a digit typed into an empty cell a given', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-key-4')
    expect(style('correction-cell-2')).toMatchObject({ color: cobalt.components.cell.given })
  })

  it('closes the open cell with a second tap on it', () => {
    render(ui(okResult()))
    press('correction-press-2')
    press('correction-press-2')
    expect(screen.queryByTestId('correction-check')).toBeNull()
  })

  it('empties a cell with Empty', () => {
    render(ui(okResult({ 0: given })))
    press('correction-press-0')
    press('correction-clear')
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('')
  })

  it('marks two givens with the same digit, and the mark goes when one is fixed', () => {
    render(ui(okResult({ 0: given, 8: given })))
    expect(style('correction-fill-0')).toMatchObject({ backgroundColor: cobalt.components.cell.conflictFill })
    expect(style('correction-fill-8')).toMatchObject({ backgroundColor: cobalt.components.cell.conflictFill })
    expect(screen.getByText('2 givens clash')).toBeTruthy()
    press('correction-press-8')
    press('correction-key-4')
    expect(screen.queryByTestId('correction-fill-0')).toBeNull()
    expect(screen.queryByText(/clash/)).toBeNull()
  })

  it('keeps the cells inert during the transition', () => {
    render(
      <CorrectionScreen
        session={capturing(okResult({ 0: given }), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.getByTestId('correction-press-0').props.accessibilityState).toMatchObject({ disabled: true })
    press('correction-press-0')
    expect(screen.queryByTestId('correction-check')).toBeNull()
  })

  it('shows no conflict mark during the transition', () => {
    render(
      <CorrectionScreen
        session={capturing(okResult({ 0: given, 8: given }), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
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
    const result = flowScan()
    const before = JSON.parse(JSON.stringify(result))
    render(ui(result))
    press('start-check')
    press('correction-no')
    press('correction-key-2')
    expect(result).toEqual(before)
  })
})

const puzzle = generate('hard', 5)
const firstOpen = puzzle.givens.findIndex((digit) => digit === 0)
const wrongDigit = ((puzzle.solution[firstOpen] ?? 0) % 9) + 1

/** A recognised result with every given of `givens` printed, and `over` on top. */
function scanOf(givens: readonly number[], over: { [n: number]: Partial<CellResult> } = {}): CaptureResult {
  const printed: { [n: number]: Partial<CellResult> } = {}
  givens.forEach((digit, n) => {
    if (digit !== 0) printed[n] = { digit, kind: 'printed', confidence: 1 }
  })
  return okResult({ ...printed, ...over })
}

const playUi = (result: CaptureResult, onPlay = jest.fn<void, [ScannedStart]>()) => {
  render(<CorrectionScreen session={review(result)} layout={layout} onRetake={jest.fn()} onPlay={onPlay} />)
  return onPlay
}
const playOn = () => screen.getByTestId('play').props.accessibilityState.disabled === false

describe('CorrectionScreen play gate', () => {
  const checkSpy = jest.spyOn(playUtils, 'checkPlay')
  beforeEach(() => checkSpy.mockClear())
  afterAll(() => checkSpy.mockRestore())

  it('turns Play on for givens with one solution, and hands over the plain grid', () => {
    const onPlay = playUi(
      scanOf(puzzle.givens, { [firstOpen]: { digit: wrongDigit, kind: 'handwritten', confidence: 1 } }),
    )
    expect(playOn()).toBe(true)
    expect(style('play').opacity).toBeUndefined()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
    jest.mocked(Haptics.impactAsync).mockClear()
    press('play')
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
    const start = onPlay.mock.calls[0]![0]
    expect(start.givens).toEqual(puzzle.givens)
    expect(start.solution).toEqual(puzzle.solution)
    expect(start.entries[firstOpen]).toBe(wrongDigit)
  })

  it('keeps Play on with uncertain cells', () => {
    const unsure = puzzle.givens.findIndex((digit) => digit !== 0)
    playUi(scanOf(puzzle.givens, { [unsure]: { digit: puzzle.givens[unsure] ?? 0, kind: 'printed', confidence: 0.2 } }))
    expect(screen.getByText('1 cell to check')).toBeTruthy()
    expect(playOn()).toBe(true)
  })

  it('blocks two givens in conflict, and the status line says why', () => {
    playUi(okResult({ 0: given, 8: given }))
    expect(playOn()).toBe(false)
    expect(screen.getByText('2 givens clash')).toBeTruthy()
    expect(screen.queryByTestId('play-blocked')).toBeNull()
  })

  it('blocks givens with no solution and says so', () => {
    const givens = puzzle.givens.map((_, cell) => (cell < 8 ? cell + 1 : cell === 17 ? 9 : 0))
    playUi(scanOf(givens))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('This puzzle has no solution. Check the marked cells.')
    expect(style('play-blocked')).toMatchObject({ color: cobalt.colors.danger })
  })

  it('blocks givens with several solutions and says so', () => {
    const onPlay = playUi(scanOf(puzzle.givens.map((digit, cell) => (cell < 40 ? 0 : digit))))
    expect(playOn()).toBe(false)
    expect(screen.getByTestId('play-blocked')).toHaveTextContent('A given is missing or wrong.')
    expect(screen.getByTestId('play').props.accessibilityHint).toBe('A given is missing or wrong.')
    press('play')
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('follows an edit: a fixed conflict turns Play on', () => {
    // A misread gives the second given of row 1 the digit of the first.
    const row = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => puzzle.givens[cell] !== 0)
    const [first, second] = row as [number, number]
    playUi(scanOf(puzzle.givens, { [second]: { digit: puzzle.givens[first] ?? 0, kind: 'printed', confidence: 1 } }))
    expect(playOn()).toBe(false)
    press(`correction-press-${second}`)
    press(`correction-key-${puzzle.givens[second]}`)
    expect(playOn()).toBe(true)
  })

  it('keeps Play off without onPlay', () => {
    render(<CorrectionScreen session={review(scanOf(puzzle.givens))} layout={layout} onRetake={jest.fn()} />)
    expect(playOn()).toBe(false)
  })

  it('does not check the givens during the transition', () => {
    render(
      <CorrectionScreen
        session={capturing(scanOf(puzzle.givens), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
        onPlay={jest.fn()}
      />,
    )
    expect(playOn()).toBe(false)
    expect(screen.queryByTestId('play-blocked')).toBeNull()
    expect(checkSpy).not.toHaveBeenCalled()
  })

  it('checks the givens when the summary shows, not while a cell is open', () => {
    playUi(scanOf(puzzle.givens))
    expect(checkSpy).toHaveBeenCalledTimes(1)
    press(`correction-press-${firstOpen}`)
    expect(checkSpy).toHaveBeenCalledTimes(1)
    press(`correction-key-${wrongDigit}`)
    expect(checkSpy).toHaveBeenCalledTimes(2)
  })

  it('shows the solution in muted digits with Solve, and hides it with a second tap', () => {
    playUi(scanOf(puzzle.givens))
    expect(screen.queryByTestId(`correction-solution-${firstOpen}`)).toBeNull()
    press('solve')
    expect(screen.getByTestId(`correction-solution-${firstOpen}`)).toHaveTextContent(String(puzzle.solution[firstOpen]))
    expect(screen.getByTestId('solve')).toHaveTextContent('Hide')
    press('solve')
    expect(screen.queryByTestId(`correction-solution-${firstOpen}`)).toBeNull()
  })

  it('keeps Solve off while the play gate blocks', () => {
    playUi(okResult({ 0: given, 8: given }))
    expect(screen.getByTestId('solve').props.accessibilityState).toMatchObject({ disabled: true })
  })
})

const withPhoto = (): CaptureResult => ({
  ...(okResult({ 0: given, 1: shaky(3, 0.85) }) as CaptureOk),
  photoPath: '/tmp/photo.jpg',
})

const devUi = (onSave?: (looks: readonly unknown[]) => Promise<boolean>, result = withPhoto()) => {
  const onPlay = jest.fn()
  render(
    <CorrectionScreen
      session={review(result)}
      layout={layout}
      onRetake={jest.fn()}
      onPlay={onPlay}
      {...(onSave ? { onSave } : {})}
    />,
  )
  press('dev-open')
  return onPlay
}

describe('CorrectionScreen dev menu', () => {
  it('opens from the wrench and closes again', () => {
    devUi()
    expect(screen.getByTestId('dev-menu')).toBeTruthy()
    press('dev-close')
    expect(screen.queryByTestId('dev-menu')).toBeNull()
  })

  it('has no wrench during the transition', () => {
    render(
      <CorrectionScreen session={capturing(withPhoto(), { clock: clock(1.5) })} layout={layout} onRetake={jest.fn()} />,
    )
    expect(screen.queryByTestId('dev-open')).toBeNull()
  })

  it('shows the four tabs and swaps the inspector view', () => {
    devUi()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByTestId('inspector-photo')).toBeTruthy()
    press('tab-cells')
    expect(screen.getByTestId('inspector-cells')).toBeTruthy()
    expect(screen.getByTestId('correction-cell-0')).toBeTruthy()
  })

  it('saves the final looks, while Play still works', async () => {
    const onSave = jest.fn(async (_looks: readonly unknown[]) => true)
    devUi(onSave)
    expect(screen.getByTestId('play')).toBeTruthy()
    expect(screen.getByTestId('save')).toHaveTextContent('Save corrections')
    press('save')
    await waitFor(() => expect(screen.getByTestId('save')).toHaveTextContent('Saved ✓'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0]).toHaveLength(81)
  })

  it('says when the save failed, and lets the developer try again', async () => {
    devUi(jest.fn(async () => false))
    press('save')
    await waitFor(() => expect(screen.getByTestId('save')).toHaveTextContent('Not saved. Try again'))
    expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(false)
  })

  it('has no Save without the photo file', () => {
    devUi(jest.fn(), okResult())
    expect(screen.queryByTestId('save')).toBeNull()
  })

  it('moves the rings at once with the threshold slider', () => {
    devUi()
    expect(screen.queryByTestId('correction-ring-1')).toBeNull()
    fireEvent(screen.getByTestId('threshold-slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(screen.queryByTestId('correction-ring-1')).toBeNull()
    for (let step = 0; step < 9; step++) {
      fireEvent(screen.getByTestId('threshold-slider'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
    }
    expect(screen.getByTestId('correction-ring-1')).toBeTruthy()
    expect(screen.getByTestId('inspector-photo').props.threshold).toBeCloseTo(0.9, 6)
  })

  it('shows the kind and the confidence in each cell', () => {
    devUi()
    fireEvent.press(screen.getByTestId('switch-Show confidence'))
    expect(screen.getByTestId('correction-confidence-1')).toHaveTextContent('85')
    expect(screen.getByTestId('correction-confidence-0')).toHaveTextContent('100')
  })

  it('labels the kind of an open cell when Label kinds is on', () => {
    devUi()
    fireEvent.press(screen.getByTestId('switch-Label kinds'))
    press('dev-close')
    press('correction-press-0')
    press('correction-kind-entry')
    expect(style('correction-cell-0')).toMatchObject({ color: cobalt.components.cell.entry })
    press('correction-kind-notes')
    expect(screen.getByTestId('correction-cell-0')).toHaveTextContent('')
    expect(screen.getByTestId('correction-check')).toBeTruthy()
  })

  it('shows no kind labels without the switch', () => {
    devUi()
    press('dev-close')
    press('correction-press-0')
    expect(screen.queryByTestId('correction-kinds')).toBeNull()
  })
})

function inTheme(theme: Theme) {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  return jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: unistyles.UnistylesRuntime } as never)
}

describe('CorrectionScreen in the colourways', () => {
  afterEach(() => jest.restoreAllMocks())

  it('shows the large title and the panel edge of Bordeaux', () => {
    inTheme(bordeaux)
    const big = correctionLayout({ width: 402, height: 874 }, { top: 62, bottom: 34, left: 0, right: 0 }, 60, 34)
    render(<CorrectionScreen session={review(okResult())} layout={big} onRetake={jest.fn()} />)
    expect(screen.getByTestId('decoration-opart-waves')).toBeTruthy()
    expect(screen.getAllByText('Check the scan')).toHaveLength(1)
  })

  it('sizes the digits from the type scale of the theme: the serif given larger than the sans entry', () => {
    inTheme(bordeaux)
    render(<CorrectionScreen session={review(okResult({ 0: given, 1: entry }))} layout={layout} onRetake={jest.fn()} />)
    const givenSize = style('correction-cell-0').fontSize
    const entrySize = style('correction-cell-1').fontSize
    expect(givenSize / entrySize).toBeCloseTo(bordeaux.type.given.scale / bordeaux.type.entry.scale, 6)
  })
})

const fullScan = (wrong?: { cell: number; digit: number }) => {
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

describe('CorrectionScreen with a full grid', () => {
  it('offers Check, and no Play or Solve', () => {
    render(<CorrectionScreen session={review(fullScan())} layout={layout} onRetake={jest.fn()} onPlay={jest.fn()} />)
    expect(screen.getByText('Grid is full')).toBeTruthy()
    expect(screen.getByTestId('verify')).toBeTruthy()
    expect(screen.queryByTestId('play')).toBeNull()
    expect(screen.queryByTestId('solve')).toBeNull()
  })

  it('shows Solved, the wave and the buttons when the grid is right', () => {
    render(<CorrectionScreen session={review(fullScan())} layout={layout} onRetake={jest.fn()} onHome={jest.fn()} />)
    fireEvent.press(screen.getByTestId('verify'))
    expect(screen.getByText('Solved')).toBeTruthy()
    expect(screen.getByTestId('scan-another')).toBeTruthy()
    expect(screen.getByTestId('correction-wave-0')).toBeTruthy()
  })

  it('marks a wrong entry with the fill and the hint, and keeps its digit', () => {
    render(
      <CorrectionScreen
        session={review(fullScan({ cell: firstOpen, digit: wrongDigit }))}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByTestId('verify'))
    expect(screen.getByText('1 cell differs')).toBeTruthy()
    expect(screen.getByTestId(`correction-hint-${firstOpen}`)).toHaveTextContent(String(puzzle.solution[firstOpen]))
    expect(screen.getByTestId(`correction-cell-${firstOpen}`)).toHaveTextContent(String(wrongDigit))
    expect(screen.getByTestId(`correction-fill-${firstOpen}`)).toBeTruthy()
  })

  it('marks no cell before the player taps Check', () => {
    render(
      <CorrectionScreen
        session={review(fullScan({ cell: firstOpen, digit: wrongDigit }))}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    expect(screen.queryByTestId(`correction-hint-${firstOpen}`)).toBeNull()
    expect(screen.queryByTestId(`correction-fill-${firstOpen}`)).toBeNull()
  })

  it('keeps the marks while the player opens a wrong cell, and solves when the player fixes it', () => {
    render(
      <CorrectionScreen
        session={review(fullScan({ cell: firstOpen, digit: wrongDigit }))}
        layout={layout}
        onRetake={jest.fn()}
      />,
    )
    fireEvent.press(screen.getByTestId('verify'))
    press(`correction-press-${firstOpen}`)
    expect(screen.getByTestId(`correction-hint-${firstOpen}`)).toBeTruthy()
    press(`correction-key-${puzzle.solution[firstOpen]}`)
    expect(screen.queryByTestId(`correction-hint-${firstOpen}`)).toBeNull()
  })

  it('plays the success haptic once when the grid turns solved', async () => {
    render(<CorrectionScreen session={review(fullScan())} layout={layout} onRetake={jest.fn()} />)
    jest.mocked(Haptics.notificationAsync).mockClear()
    fireEvent.press(screen.getByTestId('verify'))
    await waitFor(() =>
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success),
    )
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  })

  it('does not replay the success haptic when the player opens and closes a cell of a solved grid', async () => {
    render(<CorrectionScreen session={review(fullScan())} layout={layout} onRetake={jest.fn()} />)
    jest.mocked(Haptics.notificationAsync).mockClear()
    fireEvent.press(screen.getByTestId('verify'))
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1))
    press(`correction-press-${firstOpen}`)
    press(`correction-press-${firstOpen}`)
    expect(screen.getByText('Solved')).toBeTruthy()
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  })

  it('brings Play and Solve back when an edit empties a cell', () => {
    render(<CorrectionScreen session={review(fullScan())} layout={layout} onRetake={jest.fn()} onPlay={jest.fn()} />)
    fireEvent.press(screen.getByTestId('verify'))
    press(`correction-press-${firstOpen}`)
    press('correction-clear')
    expect(screen.queryByTestId('verify')).toBeNull()
    expect(screen.getByTestId('play')).toBeTruthy()
  })

  it('starts no game, no home, no save and no exit during the transition, although the parent gives them', () => {
    const actions = { onPlay: jest.fn(), onHome: jest.fn(), onSave: jest.fn(), onExit: jest.fn() }
    const view = render(
      <CorrectionScreen
        session={capturing(fullScan(), { clock: clock(1.5) })}
        layout={layout}
        onRetake={jest.fn()}
        {...actions}
      />,
    )
    fireEvent.press(screen.getByTestId('play'))
    expect(screen.queryByTestId('verify')).toBeNull()
    expect(screen.queryByTestId('scan-another')).toBeNull()
    expect(screen.queryByTestId('dev-open')).toBeNull()
    view.unmount()
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
  })

  it('offers no Check for a grid that is not full', () => {
    render(<CorrectionScreen session={review(okResult({ 0: given }))} layout={layout} onRetake={jest.fn()} />)
    expect(screen.queryByTestId('verify')).toBeNull()
  })
})
