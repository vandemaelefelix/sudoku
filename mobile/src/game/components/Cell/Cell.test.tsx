import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { useReducedMotion, type SharedValue } from 'react-native-reanimated'
import { HINT_EDGE, TARGET_PULSE_MS } from '@/game/constants/hint.constants'
import { NO_PULSE, POP_PEAK_AT, WAVE_PEAK_AT } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { pulseLook } from '@/game/utils/pulse.utils'
import { cobalt, cobaltColour } from '@/theme/themes/cobalt'
import { forest } from '@/theme/themes/forest'
import { Cell } from './Cell'

// Forest, not the Cobalt of the Unistyles mock: the strengths must come from the pulse, not from the styles.
const look = pulseLook(forest)

// A fixed stand-in for a shared value. The Reanimated mock runs each animated style once, at render.
const fixed = <T,>(value: T) => ({ value, get: () => value, set: jest.fn() }) as unknown as SharedValue<T>
const pulseAt = (elapsed: number, delays: readonly number[] = Array(81).fill(NO_PULSE)): Pulse => ({
  delays: fixed(delays),
  elapsed: fixed(elapsed),
  look: fixed(look),
})
const inPulse = Array.from({ length: 81 }, (_, cell) => (cell === 2 ? 0 : NO_PULSE))

const base = {
  cell: 2,
  digit: 0,
  digitStyle: 'entry',
  notes: '',
  fill: 'plain',
  ring: false,
  hintEdges: 0,
  hintPattern: false,
  hintSupport: false,
  hintStruck: '',
  hintTarget: 0,
  label: 'cell',
  pulse: pulseAt(0),
} as const

it('reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015)', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles')
  render(<Cell {...base} onSelect={jest.fn()} />)
  expect(theming).not.toHaveBeenCalled()
  theming.mockRestore()
})

it('draws a wrong entry in the conflict colours', () => {
  render(<Cell {...base} digit={6} digitStyle="wrong" fill="conflict" onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    backgroundColor: cobalt.components.cell.conflictFill,
  })
  expect(StyleSheet.flatten(screen.getByText('6').props.style)).toMatchObject({
    color: cobalt.components.cell.conflict,
  })
})

it('draws the notes at 11 pt or more, each in its own place of a 3 × 3 set', () => {
  render(<Cell {...base} notes="39" onSelect={jest.fn()} />)
  const three = StyleSheet.flatten(screen.getByText('3').props.style)
  expect(three.fontSize).toBeGreaterThanOrEqual(11)
  expect(screen.getAllByTestId(/^note-slot-/)).toHaveLength(9)
})

it('selects its cell when tapped', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} onSelect={onSelect} />)
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})

it('draws a ring when the selected-cell assist is off', () => {
  render(<Cell {...base} ring onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
    borderColor: cobalt.components.cell.ring,
  })
})

it('draws the wave in the accent colour at the peak opacity of the theme', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const wave = StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style)
  expect(wave.backgroundColor).toBe(cobalt.colors.accent)
  expect(wave.opacity).toBeCloseTo(forest.components.pulse.waveOpacity)
})

it('pops the digit to the peak scale of the theme', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.popMs * POP_PEAK_AT, inPulse)} onSelect={jest.fn()} />)
  const digit = StyleSheet.flatten(screen.getByText('4').props.style)
  expect(digit.transform).toEqual([{ scale: expect.closeTo(forest.components.pulse.popScale) }])
})

it('shows no wave and no pop outside a pulse', () => {
  render(<Cell {...base} digit={4} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT)} onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).opacity).toBe(0)
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('draws a still cell without a pulse, for a grid outside a game', () => {
  const { pulse: _none, ...still } = base
  render(<Cell {...still} digit={4} onSelect={jest.fn()} />)
  expect(screen.queryByTestId('cell-2-wave')).toBeNull()
  expect(StyleSheet.flatten(screen.getByText('4').props.style).transform).toEqual([{ scale: 1 }])
})

it('lets a tap through the wave', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} pulse={pulseAt(look.waveMs * WAVE_PEAK_AT, inPulse)} onSelect={onSelect} />)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-wave').props.style).pointerEvents).toBe('none')
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).toHaveBeenCalledWith(2)
})

it('shows the board without a button when it is not interactive', () => {
  const onSelect = jest.fn()
  render(<Cell {...base} digit={5} digitStyle="given" interactive={false} onSelect={onSelect} />)
  expect(screen.queryByRole('button', { includeHiddenElements: true })).toBeNull()
  fireEvent.press(screen.getByTestId('cell-2'))
  expect(onSelect).not.toHaveBeenCalled()
  expect(screen.getByText('5')).toBeTruthy()
})

it('draws small digits at the note size', () => {
  render(<Cell {...base} digit={5} digitStyle="given" digitSize="small" onSelect={jest.fn()} />)
  expect(StyleSheet.flatten(screen.getByText('5').props.style).fontSize).toBe(cobalt.type.note.scale)
})

it('draws no notes in a small cell', () => {
  render(<Cell {...base} notes="39" digitSize="small" onSelect={jest.fn()} />)
  expect(screen.queryAllByTestId(/^note-slot-/)).toHaveLength(0)
})

it('stays a button with full-size digits by default', () => {
  render(<Cell {...base} digit={5} digitStyle="given" onSelect={jest.fn()} />)
  expect(screen.getByRole('button')).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByText('5').props.style).fontSize).toBe(cobalt.type.given.scale)
})

describe('the selected cell ring (ADR-026)', () => {
  it('rings the selected cell with the ring colour and the width of the theme', () => {
    render(<Cell {...base} digit={5} digitStyle="given" fill="selected" onSelect={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByTestId('cell-2').props.style)).toMatchObject({
      backgroundColor: cobalt.components.cell.selected,
      borderWidth: cobalt.components.cell.selectedRingWidth,
      borderColor: cobalt.components.cell.ring,
    })
  })

  it('keeps the digit colours of the cell on the selected fill', () => {
    render(<Cell {...base} digit={5} digitStyle="entry" fill="selected" onSelect={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByText('5').props.style).color).toBe(cobalt.components.cell.entry)
  })
})

describe('the conflict hatch (ADR-026)', () => {
  it('draws no hatch in Light, where the conflict fill marks the cell', () => {
    render(<Cell {...base} digit={6} digitStyle="wrong" fill="conflict" onSelect={jest.fn()} />)
    expect(screen.queryByTestId('conflict-hatch')).toBeNull()
  })

  it('draws the hatch only in a conflict cell, in Colour', () => {
    const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    jest
      .spyOn(unistyles, 'useUnistyles')
      .mockReturnValue({ theme: cobaltColour, rt: unistyles.UnistylesRuntime } as never)
    render(
      <>
        <Cell {...base} cell={1} digit={6} digitStyle="wrong" fill="conflict" onSelect={jest.fn()} />
        <Cell {...base} cell={2} digit={6} digitStyle="entry" fill="plain" onSelect={jest.fn()} />
      </>,
    )
    expect(screen.getAllByTestId('conflict-hatch')).toHaveLength(1)
    jest.restoreAllMocks()
  })
})

const fillOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor

it('crossfades a display fill: the old fill stays under the new one, which starts clear', () => {
  const colours = cobalt.components.cell
  const view = render(<Cell {...base} interactive={false} fill="plain" onSelect={jest.fn()} />)
  view.rerender(<Cell {...base} interactive={false} fill="peer" onSelect={jest.fn()} />)
  expect(fillOf('cell-2-fill-under')).toBe(colours.fill)
  expect(fillOf('cell-2-fill')).toBe(colours.peer)
  expect(StyleSheet.flatten(screen.getByTestId('cell-2-fill-fade').props.style)).toMatchObject({ opacity: 0 })
})

it('takes the colours of a display fill from the theme hook, not from the cell styles', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme: forest } as never)
  render(<Cell {...base} interactive={false} fill="peer" onSelect={jest.fn()} />)
  expect(fillOf('cell-2-fill')).toBe(forest.components.cell.peer)
  theming.mockRestore()
})

const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

describe('the hint roles (ADR-032)', () => {
  const colours = cobalt.components.cell

  afterEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false)
    jest.restoreAllMocks()
  })

  it('tints a focus unit and outlines only the sides where the unit ends', () => {
    render(<Cell {...base} fill="focus" hintEdges={HINT_EDGE.top | HINT_EDGE.left} onSelect={jest.fn()} />)
    expect(styleOf('cell-2')).toMatchObject({ backgroundColor: colours.hintFocus })
    expect(styleOf('cell-2-hint-edges')).toMatchObject({
      borderColor: colours.hintFocusLine,
      borderTopWidth: colours.hintLineWidth,
      borderLeftWidth: colours.hintLineWidth,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    })
  })

  it('draws no outline inside a focus unit', () => {
    render(<Cell {...base} fill="focus" onSelect={jest.fn()} />)
    expect(screen.queryByTestId('cell-2-hint-edges')).toBeNull()
  })

  it('marks a pattern cell with an inner outline and a corner dot', () => {
    render(<Cell {...base} hintPattern onSelect={jest.fn()} />)
    expect(styleOf('cell-2-hint-pattern')).toMatchObject({
      borderColor: colours.hintPattern,
      borderWidth: colours.hintLineWidth,
    })
    expect(styleOf('cell-2-hint-dot')).toMatchObject({ backgroundColor: colours.hintPattern })
  })

  it('rings a support digit', () => {
    render(<Cell {...base} digit={7} digitStyle="given" hintSupport onSelect={jest.fn()} />)
    expect(styleOf('cell-2-hint-support')).toMatchObject({
      borderColor: colours.hintSupport,
      borderWidth: colours.hintLineWidth,
    })
    expect(screen.getByText('7')).toBeTruthy()
  })

  it('strikes only the struck notes, in the danger tone', () => {
    render(<Cell {...base} notes="39" hintStruck="3" onSelect={jest.fn()} />)
    expect(styleOf('note-strike-3')).toMatchObject({ backgroundColor: colours.hintStrike })
    expect(screen.queryByTestId('note-strike-9')).toBeNull()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('outlines the target cell and shows its digit as a ghost', () => {
    render(<Cell {...base} hintTarget={4} onSelect={jest.fn()} />)
    expect(styleOf('cell-2-hint-target')).toMatchObject({
      borderColor: colours.hintTarget,
      borderWidth: colours.hintTargetWidth,
      transform: [{ scale: 1 }],
    })
    expect(StyleSheet.flatten(screen.getByText('4').props.style)).toMatchObject({
      color: colours.hintGhost,
      opacity: colours.hintGhostOpacity,
    })
  })

  it('draws no ghost in a small cell, as it draws no notes', () => {
    render(<Cell {...base} hintTarget={4} digitSize="small" onSelect={jest.fn()} />)
    expect(screen.queryByTestId('cell-2-hint-target')).toBeNull()
    expect(screen.queryByText('4')).toBeNull()
  })

  it('pulses the target outline once', () => {
    const timing = jest.spyOn(Reanimated, 'withTiming')
    render(<Cell {...base} hintTarget={4} onSelect={jest.fn()} />)
    expect(timing).toHaveBeenCalledTimes(1)
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: TARGET_PULSE_MS }))
  })

  it('keeps the target outline still with Reduce Motion', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true)
    const timing = jest.spyOn(Reanimated, 'withTiming')
    render(<Cell {...base} hintTarget={4} onSelect={jest.fn()} />)
    expect(timing).not.toHaveBeenCalled()
    expect(styleOf('cell-2-hint-target')).toMatchObject({ transform: [{ scale: 1 }] })
  })

  it('draws every role without a theme hook', () => {
    const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    const theming = jest.spyOn(unistyles, 'useUnistyles')
    render(
      <>
        <Cell {...base} cell={1} fill="focus" hintEdges={HINT_EDGE.top} hintPattern onSelect={jest.fn()} />
        <Cell {...base} cell={2} digit={5} digitStyle="given" hintSupport onSelect={jest.fn()} />
        <Cell {...base} cell={3} notes="12" hintStruck="1" onSelect={jest.fn()} />
        <Cell {...base} cell={4} hintTarget={8} onSelect={jest.fn()} />
      </>,
    )
    expect(theming).not.toHaveBeenCalled()
  })
})
