import { render, screen } from '@testing-library/react-native'
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
