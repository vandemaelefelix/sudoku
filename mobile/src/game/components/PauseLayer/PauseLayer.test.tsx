import { fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable } from 'react-native'
import { GameProvider } from '@/game/components/GameProvider'
import { Keypad } from '@/game/components/Keypad'
import { Tools } from '@/game/components/Tools'
import { useGameActions } from '@/game/hooks/useGameActions'
import { sampleStart } from '@/game/utils/sample.utils'
import { PauseLayer } from './PauseLayer'

function PauseButton() {
  const { pause } = useGameActions()
  return <Pressable testID="pause" onPress={pause} />
}

function renderGame() {
  render(
    <GameProvider start={sampleStart()}>
      <PauseLayer />
      <PauseButton />
      <Tools />
      <Keypad />
    </GameProvider>,
  )
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('shows nothing while the game is playing', () => {
  renderGame()
  expect(screen.queryByText('Paused')).toBeNull()
})

it('says the game is paused and resumes it on a tap', () => {
  renderGame()
  fireEvent.press(screen.getByTestId('pause'))
  expect(screen.getByText('Paused')).toBeTruthy()
  expect(screen.getByText('Tap to resume')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Paused, tap to resume' }))
  expect(screen.queryByText('Paused')).toBeNull()
})

it('hides the grid from VoiceOver while it covers it', () => {
  renderGame()
  fireEvent.press(screen.getByTestId('pause'))
  expect(screen.getByRole('button', { name: 'Paused, tap to resume' }).props.accessibilityViewIsModal).toBe(true)
})

it('leaves the tools and the keys disabled during a pause', () => {
  renderGame()
  fireEvent.press(screen.getByTestId('pause'))
  expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Notes' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Enter 5' })).toBeDisabled()
})
