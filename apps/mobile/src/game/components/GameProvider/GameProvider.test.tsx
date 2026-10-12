import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useGameTime } from '@/game/hooks/useGameTime'
import { sampleStart } from '@/game/utils/sample.utils'
import { GameProvider } from './GameProvider'

function Probe() {
  const { board } = useGameState()
  const playedMs = useGameTime()
  const actions = useGameActions()
  return <Text>{`${board.status} ${playedMs} ${typeof actions.select}`}</Text>
}

it('shares the state, the time and the actions with the parts of the screen', () => {
  render(
    <GameProvider start={sampleStart()}>
      <Probe />
    </GameProvider>,
  )
  expect(screen.getByText('playing 0 function')).toBeTruthy()
})

it.each([
  ['useGameState', () => useGameState()],
  ['useGameTime', () => useGameTime()],
  ['useGameActions', () => useGameActions()],
])('refuses %s outside the provider', (name, read) => {
  function Outside() {
    read()
    return null
  }
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  expect(() => render(<Outside />)).toThrow(`${name} needs a GameProvider`)
  error.mockRestore()
})
