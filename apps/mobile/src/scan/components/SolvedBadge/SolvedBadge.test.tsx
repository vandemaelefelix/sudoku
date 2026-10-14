import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { daylight } from '@/theme/themes/daylight'
import { SolvedBadge } from './SolvedBadge'

it('is a square in the accent colour, hidden from VoiceOver because the title says Solved', () => {
  render(<SolvedBadge />)
  const badge = screen.getByTestId('solved-badge', { includeHiddenElements: true })
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ backgroundColor: daylight.colors.accent })
  expect(badge.props.accessibilityElementsHidden).toBe(true)
})
