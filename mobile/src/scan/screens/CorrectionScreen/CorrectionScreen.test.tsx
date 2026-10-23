import { render, screen } from '@testing-library/react-native'
import { fireEvent } from '@testing-library/react-native'
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated'
import { createPicture, Skia } from '@shopify/react-native-skia'
import { capturing, okResult, review } from '@/scan/scanTestKit'
import { fullScan } from '@/scan/puzzleTestKit'
import type { Theme } from '@/theme/theme.types'
import { cobalt } from '@/theme/themes/cobalt'
import { forest } from '@/theme/themes/forest'
import { bordeaux } from '@/theme/themes/bordeaux'
import { digitAlpha, panelAt, ringsAt } from '@/scan/utils/transition.utils'
import { correctionLayout } from '@/scan/utils/correction.utils'
import { GATE_RESULTS } from '@/scan/constants/transition.constants'
import { CorrectionScreen } from './CorrectionScreen'
import { clock, entry, flowScan, given, layout, press, style, ui } from './CorrectionScreen.testKit'

const HIDDEN = layout.panel.height * 1.4

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

const failing = (t: number) => (
  <CorrectionScreen
    session={capturing({ ok: false, reason: 'x' }, { clock: clock(t) })}
    layout={layout}
    onRetake={jest.fn()}
  />
)

describe('CorrectionScreen with a failed result and a clock', () => {
  it('passes the failure to the motion: the panel waits for the failure slide, not for the clock ramp', () => {
    // At the end of the clock ramp a result that is not a failure shows the panel in place. The failure keeps it down.
    render(failing(1.5))
    expect(screen.getByTestId('correction-failure')).toBeTruthy()
    expect(style('correction-panel').transform).toEqual([{ translateY: HIDDEN }])
  })

  it('opens the failure slide at the results gate', () => {
    render(failing(GATE_RESULTS))
    const [prepare] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)! as unknown as [() => boolean]
    expect(prepare()).toBe(true)
  })
})

describe('CorrectionScreen cells and the transition', () => {
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
