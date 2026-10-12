import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { daylight } from '@/theme/themes/daylight'
import { MistakeDots } from './MistakeDots'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

it('draws three empty dots and reads the mistakes for VoiceOver', () => {
  renderInGame(<MistakeDots />)
  const dots = screen.getAllByTestId(/^mistake-dot-/)
  expect(dots).toHaveLength(3)
  expect(StyleSheet.flatten(dots[0]?.props.style)).toMatchObject({ borderColor: daylight.colors.textMuted })
  expect(screen.getByLabelText('0 of 3 mistakes')).toBeTruthy()
})
