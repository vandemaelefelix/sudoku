import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { CorrectionCell } from './CorrectionCell'
import { daylight } from '@/theme/themes/daylight'

const look = { digit: '7', style: 'entry', uncertain: true } as const

it('reads no theme hook, so a theme switch does not re-render the 81 cells (ADR-015)', () => {
  const unistyles = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
  const theming = jest.spyOn(unistyles, 'useUnistyles')
  render(<CorrectionCell n={0} look={look} size={40} left={0} top={0} reduceMotion={false} />)
  expect(theming).not.toHaveBeenCalled()
  theming.mockRestore()
})

it('draws the ring of an uncertain cell in the warning colour of the theme', () => {
  render(<CorrectionCell n={0} look={look} size={40} left={0} top={0} reduceMotion={false} />)
  expect(StyleSheet.flatten(screen.getByTestId('correction-ring-0').props.style)).toMatchObject({
    borderColor: daylight.colors.warning,
  })
})

const given = { digit: '5', style: 'given', uncertain: false } as const
const fill = (n: number) => StyleSheet.flatten(screen.getByTestId(`correction-fill-${n}`).props.style)
const at = { size: 40, left: 0, top: 0, reduceMotion: false } as const

it('fills the selected cell with the selected token, with and without its ring', () => {
  render(
    <>
      <CorrectionCell n={0} look={look} selected {...at} />
      <CorrectionCell n={1} look={given} selected {...at} />
    </>,
  )
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  expect(screen.getByTestId('correction-ring-0')).toBeTruthy()
  expect(fill(1)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
  expect(screen.queryByTestId('correction-ring-1')).toBeNull()
})

it('draws no fill on a plain cell', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  expect(screen.queryByTestId('correction-fill-0')).toBeNull()
})

it('marks a conflict with the conflict fill and the conflict colour', () => {
  render(<CorrectionCell n={0} look={given} conflict {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.conflictFill })
  expect(StyleSheet.flatten(screen.getByTestId('correction-cell-0').props.style)).toMatchObject({
    color: daylight.components.cell.conflict,
    fontWeight: daylight.type.given.weight,
  })
})

it('shows the selected fill over the conflict fill', () => {
  render(<CorrectionCell n={0} look={given} conflict selected {...at} />)
  expect(fill(0)).toMatchObject({ backgroundColor: daylight.components.cell.selected })
})

it('calls onSelect with its index', () => {
  const onSelect = jest.fn()
  render(<CorrectionCell n={12} look={given} onSelect={onSelect} {...at} />)
  fireEvent.press(screen.getByTestId('correction-press-12'))
  expect(onSelect).toHaveBeenCalledWith(12)
})

it('is not pressable without onSelect, as during the transition', () => {
  render(<CorrectionCell n={0} look={given} {...at} />)
  const press = screen.getByTestId('correction-press-0')
  expect(press.props.accessibilityState).toMatchObject({ disabled: true })
  expect(press.props.accessible).toBe(false)
})

it('gives VoiceOver the place, the kind, the digit and the selection', () => {
  render(<CorrectionCell n={0} look={look} selected onSelect={jest.fn()} {...at} />)
  const cell = screen.getByLabelText('Row 1, column 1, entry 7, check this cell')
  expect(cell.props.accessibilityState).toMatchObject({ selected: true, disabled: false })
})
