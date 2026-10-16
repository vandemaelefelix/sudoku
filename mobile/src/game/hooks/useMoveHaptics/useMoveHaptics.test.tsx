import { renderHook } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { useReducedMotion } from 'react-native-reanimated'
import { NOTHING_COMPLETED, type Completion } from '@sudoku/core'
import type { Move, MoveKind } from '@/game/utils/session.utils'
import { hapticOf, useMoveHaptics } from './useMoveHaptics'

const move = (id: number, kind: MoveKind, completed: Partial<Completion> = {}): Move => ({
  id,
  kind,
  cell: 2,
  completed: { ...NOTHING_COMPLETED, ...completed },
  mistake: false,
})

function play(...moves: Move[]) {
  const { rerender } = renderHook(({ last }: { last: Move | null }) => useMoveHaptics(last, false), {
    initialProps: { last: null },
  })
  for (const last of moves) rerender({ last })
}

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.mocked(useReducedMotion).mockReturnValue(false))

describe('hapticOf', () => {
  it('gives a warning for a wrong number, and an error for the one that ends the game', () => {
    expect(hapticOf({ ...move(1, 'number'), mistake: true }, false)).toBe('warning')
    expect(hapticOf({ ...move(1, 'number'), mistake: true }, true)).toBe('error')
  })

  it.each([
    ['number', 'tap'],
    ['hint', 'soft'],
    ['note', 'tick'],
    ['clear', 'tick'],
    ['erase', 'tick'],
    ['undo', 'tick'],
  ] as const)('gives %s the %s haptic', (kind, haptic) => {
    expect(hapticOf(move(1, kind), false)).toBe(haptic)
  })

  it('gives thud, not tap or soft, for a completed row, column, box or number', () => {
    expect(hapticOf(move(1, 'number', { rows: [0] }), false)).toBe('thud')
    expect(hapticOf(move(1, 'hint', { boxes: [4] }), false)).toBe('thud')
    expect(hapticOf(move(1, 'number', { digits: [4] }), false)).toBe('thud')
  })

  it('gives only success for the solved grid', () => {
    expect(hapticOf(move(1, 'hint', { rows: [0], boxes: [0], grid: true }), false)).toBe('success')
  })

  it('gives nothing without a move', () => {
    expect(hapticOf(null, false)).toBeNull()
  })
})

it('plays one haptic for each move', () => {
  play(move(1, 'number'), move(2, 'number'))
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2)
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
})

it('keeps the haptics with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  play(move(1, 'number', { rows: [0] }))
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
})
