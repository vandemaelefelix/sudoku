import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { sampleGameAfter } from '@/game/sample.testkit'
import { DisplayGameProvider } from './DisplayGameProvider'

const board = sampleGameAfter({ type: 'select', cell: 40 })
const wrapper = ({ children }: { children: ReactNode }) => (
  <DisplayGameProvider board={board}>{children}</DisplayGameProvider>
)

it('gives the board with no move, no notes mode and no hint', () => {
  const { result } = renderHook(() => useGameState(), { wrapper })
  expect(result.current).toEqual({ board, notesMode: false, move: null, hint: null })
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
