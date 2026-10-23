import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from 'react-native-reanimated'
import type { CaptureResult } from '@/scan/utils/captureResult.utils'
import { okResult, review } from '@/scan/scan.testkit'
import { firstOpen, fullScan, puzzle, scanOf, wrongDigit } from '@/scan/puzzle.testkit'
import * as playUtils from '@/scan/utils/play.utils'
import type { ScannedStart } from '@/scan/utils/play.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { CorrectionScreen } from './CorrectionScreen'
import { capturing } from '@/scan/scan.testkit'
import { clock, entering, flowScan, given, layout, press, style, ui } from './CorrectionScreen.testkit'

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
})

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

  it('offers no Check for a grid that is not full', () => {
    render(<CorrectionScreen session={review(okResult({ 0: given }))} layout={layout} onRetake={jest.fn()} />)
    expect(screen.queryByTestId('verify')).toBeNull()
  })
})
