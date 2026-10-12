import { fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { createGame, place, select, tick } from '@sudoku/core'
import { GameSaveContext } from '@/game/hooks/useGameSaver'
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

function Mover() {
  const actions = useGameActions()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Place 4 in cell 2"
      onPress={() => {
        actions.select(2)
        actions.digit(4)
      }}
    />
  )
}

it('saves the game after a move', () => {
  const save = jest.fn()
  render(
    <GameSaveContext value={save}>
      <GameProvider start={sampleStart()}>
        <Mover />
      </GameProvider>
    </GameSaveContext>,
  )
  fireEvent.press(screen.getByLabelText('Place 4 in cell 2'))
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.lastCall?.[0].entries[2]).toBe(4)
})

it('resumes a saved game with its time played', () => {
  const saved = tick(place(select(createGame(sampleStart()), 2), 4).game, 65_000)
  render(
    <GameProvider start={saved}>
      <Probe />
    </GameProvider>,
  )
  expect(screen.getByText('playing 65000 function')).toBeTruthy()
})
