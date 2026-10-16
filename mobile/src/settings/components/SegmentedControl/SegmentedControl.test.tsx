import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as reanimated from 'react-native-reanimated'
import { cobalt } from '@/theme/themes/cobalt'
import { INDICATOR_MS } from './SegmentedControl.constants'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'a', label: 'One' },
  { value: 'b', label: 'Two' },
  { value: 'c', label: 'Three' },
] as const

const control = (value: 'a' | 'b' | 'c' = 'a', kind: 'buttons' | 'tabs' = 'buttons') => (
  <SegmentedControl options={options} value={value} onChange={jest.fn()} indicatorTestID="indicator" kind={kind} />
)

/** The cells view has the inner box of the frame. A layout event gives it its width, like the device does. */
function layOut(width: number) {
  fireEvent(screen.getByTestId('indicator-cells'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } },
  })
}

/** The Reanimated mock reads a shared value at render, and the control sets it in an effect. So render once more. */
function settle(value: 'a' | 'b' | 'c') {
  screen.rerender(control(value))
}

const flat = (node: { props: { style?: unknown } }): Record<string, unknown> =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>

describe('the look of a row of grid cells (ADR-026)', () => {
  it('has square corners and a frame of the weight of the grid lines, with no filled track', () => {
    const { toJSON } = render(control())
    const frame = flat(toJSON() as never)
    expect(frame).toMatchObject({
      borderWidth: cobalt.components.button.outlineWidth,
      borderColor: cobalt.components.grid.frame,
      backgroundColor: cobalt.colors.surface,
    })
    expect(frame.borderRadius).toBeUndefined()
  })

  it('divides the cells by lines of the box-line weight, centred on the edges between the cells, and draws none before layout', () => {
    const { UNSAFE_queryAllByProps } = render(control())
    expect(
      UNSAFE_queryAllByProps({ pointerEvents: 'none' }).filter((node) => typeof node.type === 'string'),
    ).toHaveLength(1)
    layOut(300)
    const lines = screen
      .UNSAFE_queryAllByProps({ pointerEvents: 'none' })
      .filter((node) => typeof node.type === 'string' && flat(node).width === cobalt.components.button.outlineWidth)
    expect(lines.map((node) => flat(node).left)).toEqual([100 - 0.75, 200 - 0.75])
    expect(flat(lines[0]!)).toMatchObject({ backgroundColor: cobalt.components.grid.boxLine, top: 0, bottom: 0 })
  })

  it('draws the selected cell with the fill and the ring of the selected grid cell', () => {
    render(control())
    expect(flat(screen.getByTestId('indicator'))).toMatchObject({
      backgroundColor: cobalt.components.cell.selected,
      borderWidth: cobalt.shape.stroke.ring,
      borderColor: cobalt.components.cell.ring,
    })
    expect(flat(screen.getByTestId('indicator')).borderRadius).toBeUndefined()
  })

  it('writes the selected label in the accent and the other labels in muted text', () => {
    render(control('b'))
    expect(flat(screen.getByText('Two')).color).toBe(cobalt.colors.accent)
    expect(flat(screen.getByText('One')).color).toBe(cobalt.colors.textMuted)
  })

  it('gives each cell a 44 pt touch target: the row is 44 pt high and the cells fill it', () => {
    render(control())
    expect(flat(screen.getByTestId('indicator-cells')).minHeight).toBeGreaterThanOrEqual(44)
    for (const name of ['One', 'Two', 'Three']) {
      expect(flat(screen.getByRole('button', { name })).flex).toBe(1)
    }
  })
})

it('reports the value of the cell that is tapped', () => {
  const onChange = jest.fn()
  render(<SegmentedControl options={options} value="a" onChange={onChange} indicatorTestID="indicator" />)
  fireEvent.press(screen.getByRole('button', { name: 'Three' }))
  expect(onChange).toHaveBeenCalledWith('c')
})

it('is a tab bar for VoiceOver when asked', () => {
  render(control('a', 'tabs'))
  expect(screen.getByRole('tab', { name: 'One', selected: true })).toBeTruthy()
  expect(screen.getAllByRole('tab')).toHaveLength(3)
})

const frame = () => {
  const style = flat(screen.getByTestId('indicator')) as { width: number; transform: [{ translateX: number }] }
  return { x: style.transform[0].translateX, width: style.width }
}

describe('the indicator is exactly the selected cell', () => {
  it.each([
    ['first', 'a', 0],
    ['middle', 'b', 100],
    ['last', 'c', 200],
  ] as const)('is the %s cell, flush with the edges of the frame, for a content box of 300 pt', (_name, value, x) => {
    render(control(value))
    layOut(300)
    settle(value)
    expect(frame()).toEqual({ x, width: 100 })
    // Top, bottom and left come from the same box as the cells: the ring is inside the cell, never outside it.
    expect(flat(screen.getByTestId('indicator'))).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0 })
  })

  it('uses equal cell widths that fill the content box with a width that is not a whole number', () => {
    render(control('c'))
    layOut(301)
    settle('c')
    const { x, width } = frame()
    expect(width).toBeCloseTo(301 / 3, 10)
    expect(x + width).toBeCloseTo(301, 10)
  })

  it('shows nothing before the first layout', () => {
    render(control())
    expect(flat(screen.getByTestId('indicator')).opacity).toBe(0)
  })

  it('places the indicator at once on the first layout, with no timing', () => {
    const timing = jest.spyOn(reanimated, 'withTiming')
    render(control('b'))
    layOut(300)
    settle('b')
    expect(frame()).toEqual({ x: 100, width: 100 })
    expect(timing).not.toHaveBeenCalled()
    timing.mockRestore()
  })

  it('slides from the previous cell to the new one with one timing of INDICATOR_MS, x and width together', () => {
    const timing = jest.spyOn(reanimated, 'withTiming')
    render(control('a'))
    layOut(300)
    settle('a')
    timing.mockClear()
    settle('c')
    expect(timing).toHaveBeenCalledTimes(1)
    expect(timing).toHaveBeenCalledWith(200, expect.objectContaining({ duration: INDICATOR_MS }))
    // The width of the indicator is one cell before and after, so the move is only the translation.
    expect(frame().width).toBe(100)
    timing.mockRestore()
  })

  it('places the indicator at once again when the width of the control changes, for example on a rotation', () => {
    const timing = jest.spyOn(reanimated, 'withTiming')
    render(control('b'))
    layOut(300)
    settle('b')
    layOut(450)
    settle('b')
    expect(frame()).toEqual({ x: 150, width: 150 })
    expect(timing).not.toHaveBeenCalled()
    timing.mockRestore()
  })
})
