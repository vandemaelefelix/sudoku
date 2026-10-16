import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { reduceSession, startSession } from '@/game/utils/session.utils'
import { sampleStart } from '@/game/utils/sample.utils'
import { DisplayGameProvider } from './DisplayGameProvider'

const board = reduceSession(startSession(sampleStart()), { type: 'select', cell: 40 }).game
const wrapper = ({ children }: { children: ReactNode }) => (
  <DisplayGameProvider board={board}>{children}</DisplayGameProvider>
)

it('gives the board with no move and no notes mode', () => {
  const { result } = renderHook(() => useGameState(), { wrapper })
  expect(result.current).toEqual({ board, notesMode: false, move: null })
})

it('ignores every action, so the board never changes', () => {
  const { result } = renderHook(() => ({ state: useGameState(), actions: useGameActions() }), { wrapper })
  act(() => {
    result.current.actions.select(0)
    result.current.actions.digit(5)
    result.current.actions.hint()
  })
  expect(result.current.state.board).toBe(board)
})
