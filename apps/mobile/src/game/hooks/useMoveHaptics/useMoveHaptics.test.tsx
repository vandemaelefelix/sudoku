import { renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from 'react-native-reanimated'
import { NOTHING_COMPLETED, type Completion } from '@sudoku/core'
import type { Move, MoveKind } from '@/game/utils/session.utils'
import { useMoveHaptics } from './useMoveHaptics'

// The shared mock in jest.setup.ts has only impactAsync and the Light style.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}))

const move = (id: number, kind: MoveKind, completed: Partial<Completion> = {}): Move => ({
  id,
  kind,
  cell: 2,
  completed: { ...NOTHING_COMPLETED, ...completed },
  mistake: false,
})

function play(...moves: Move[]) {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last), {
    initialProps: { last: null },
  })
  for (const last of moves) rerender({ last })
}

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

it('gives a light tap for each placed number', () => {
  play(move(1, 'number'), move(2, 'number'))
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('gives no tap for a note, a clear, an undo or a hint that completes nothing', () => {
  play(move(1, 'note'), move(2, 'clear'), move(3, 'undo'), move(4, 'hint'))
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
  expect(Haptics.notificationAsync).not.toHaveBeenCalled()
})

it('gives one medium tap, not the light one, for a completed row, column, box or number', () => {
  play(
    move(1, 'number', { rows: [0] }),
    move(2, 'number', { columns: [2], boxes: [0] }),
    move(3, 'number', { digits: [4] }),
  )
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3)
  expect(jest.mocked(Haptics.impactAsync).mock.calls).toEqual([['medium'], ['medium'], ['medium']])
})

it('gives the completion tap for a hint that completes a box', () => {
  play(move(1, 'hint', { boxes: [4] }))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})

it('gives only the success haptic for the solved grid', () => {
  play(move(1, 'number', { rows: [0], columns: [2], boxes: [0], digits: [4], grid: true }))
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
  expect(Haptics.impactAsync).not.toHaveBeenCalled()
})

it('keeps the haptics with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  play(move(1, 'number', { rows: [0] }))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})
