import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { StyleSheet } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { sampleStart } from '@/game/utils/sample.utils'
import { Header } from './Header'

const renderInGame = (ui: ReactElement) => render(<GameProvider start={sampleStart()}>{ui}</GameProvider>)

it('has a back button of 44 pt that calls onBack', () => {
  const onBack = jest.fn()
  renderInGame(<Header onBack={onBack} />)
  const back = screen.getByLabelText('Back to home')
  fireEvent.press(back)
  expect(onBack).toHaveBeenCalled()
  expect(StyleSheet.flatten(back.props.style)).toEqual(expect.objectContaining({ width: 44, height: 44 }))
})

it('shows the timer pill and the mistake dots', () => {
  renderInGame(<Header onBack={jest.fn()} />)
  expect(screen.getByText('00:00')).toBeTruthy()
  expect(screen.getAllByTestId(/^mistake-dot-/)).toHaveLength(3)
})
