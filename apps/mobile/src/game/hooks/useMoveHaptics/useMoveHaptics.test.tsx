import { renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { NOTHING_COMPLETED } from '@sudoku/core'
import type { Move, MoveKind } from '@/game/utils/session.utils'
import { useMoveHaptics } from './useMoveHaptics'

const move = (id: number, kind: MoveKind): Move => ({ id, kind, cell: 2, completed: NOTHING_COMPLETED, mistake: false })

beforeEach(() => jest.mocked(Haptics.impactAsync).mockClear())

it('gives a light tap for each placed number', () => {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: null },
  })
  rerender({ last: move(1, 'number') })
  rerender({ last: move(2, 'number') })
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('gives no tap for a note, a clear or an undo', () => {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: move(1, 'note') },
  })
  rerender({ last: move(2, 'clear') })
  rerender({ last: move(3, 'undo') })
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
})
