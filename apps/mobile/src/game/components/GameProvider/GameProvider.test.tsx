import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGame } from '@/game/hooks/useGame'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameProvider } from './GameProvider'

function Probe() {
  const { game } = useGame()
  return <Text>{game.status}</Text>
}

it('shares one game session with the parts of the screen', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Probe />
    </GameProvider>,
  )
  expect(screen.getByText('playing')).toBeTruthy()
})

it('refuses a part of the screen outside the provider', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Probe />)).toThrow('useGame needs a GameProvider')
  error.mockRestore()
})
