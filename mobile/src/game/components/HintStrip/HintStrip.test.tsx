import { createGame, hintText, planHint, type HintPlan } from '@sudoku/core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { GameActionsContext } from '@/game/hooks/useGameActions'
import { GameStateContext, type GameState } from '@/game/hooks/useGameState'
import type { GameActions } from '@/game/utils/gameSession.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import type { OpenHint } from '@/game/utils/session.utils'
import { NICE_MS } from './HintStrip.constants'
import { HintStrip } from './HintStrip'

const board = createGame(sampleStart())
const plan = planHint(board) as HintPlan

const renderStrip = (hint: OpenHint | null) => {
  const hintCard = jest.fn()
  const state: GameState = { board, notesMode: false, move: null, hint }
  render(
    <GameActionsContext value={{ hintCard } as unknown as GameActions}>
      <GameStateContext value={state}>
        <HintStrip />
      </GameStateContext>
    </GameActionsContext>,
  )
  return hintCard
}

afterEach(() => jest.useRealTimers())

it('shows nothing while no hint is open, or while the card shows', () => {
  renderStrip(null)
  expect(screen.queryByTestId('hint-strip')).toBeNull()
  renderStrip({ plan, step: 0, rung: 1, view: 'card' })
  expect(screen.queryByTestId('hint-strip')).toBeNull()
})

it('shows the text of the rung on one line, and opens the card on a tap', () => {
  const hintCard = renderStrip({ plan, step: 0, rung: 2, view: 'strip' })
  const text = screen.getByText(hintText(plan, 0, 2))
  expect(text.props.numberOfLines).toBe(1)
  fireEvent.press(screen.getByRole('button', { name: `Hint: ${hintText(plan, 0, 2)}` }))
  expect(hintCard).toHaveBeenCalledWith('hintOpen')
})

it('ends the hint with its close button', () => {
  const hintCard = renderStrip({ plan, step: 0, rung: 2, view: 'strip' })
  fireEvent.press(screen.getByLabelText('Close the hint'))
  expect(hintCard).toHaveBeenCalledWith('hintClose')
})

it('says "Nice." for a moment when the player placed the target', () => {
  jest.useFakeTimers()
  const hintCard = renderStrip({ plan, step: 0, rung: 4, view: 'nice' })
  expect(screen.getByText('Nice.')).toBeTruthy()
  expect(hintCard).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(NICE_MS))
  expect(hintCard).toHaveBeenCalledWith('hintClose')
})
