import { renderHook } from '@testing-library/react-native'
import { SensorType, useAnimatedReaction } from 'react-native-reanimated'
import { GLARE_REST, MAX_ROTATE_X, SPOT_PARALLAX } from '@/game/constants/tilt.constants'
import { useCardTilt } from './useCardTilt'

const reanimated = jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated')

afterEach(() => jest.restoreAllMocks())

it('reads the rotation sensor', () => {
  const sensor = jest.spyOn(reanimated, 'useAnimatedSensor')
  renderHook(() => useCardTilt(135))
  expect(sensor).toHaveBeenCalledWith(SensorType.ROTATION, { interval: 'auto' })
})

it('does not tilt before the rest position is known', () => {
  const { result } = renderHook(() => useCardTilt(135))
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: '0.00deg' }, { rotateY: '0.00deg' }],
  })
})

it('tilts by the change from the first real reading', () => {
  const { result, rerender } = renderHook(() => useCardTilt(135))
  // The mock sensor stays at pitch 0. A rest position 0.35 rad higher is a full tilt down.
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[1]
  react?.({ pitch: 0.35, roll: 0, qw: 1, qx: 0, qy: 0, qz: 0 } as never, null)
  rerender({})
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: `${MAX_ROTATE_X.toFixed(2)}deg` }, { rotateY: '0.00deg' }],
  })
})

it('ignores the zero reading before the first value', () => {
  const { result, rerender } = renderHook(() => useCardTilt(135))
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[1]
  react?.({ pitch: 0.35, roll: 0, qw: 0, qx: 0, qy: 0, qz: 0 } as never, null)
  rerender({})
  expect(result.current.cardStyle).toMatchObject({
    transform: [{ perspective: 900 }, { rotateX: '0.00deg' }, { rotateY: '0.00deg' }],
  })
})

it('moves the glare spot further than the shine, and brightens the glare with the tilt', () => {
  const { result, rerender } = renderHook(() => useCardTilt(100))
  expect(result.current.shineStyle).toMatchObject({ opacity: GLARE_REST })
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)?.[1]
  react?.({ pitch: 0.35, roll: 0, qw: 1, qx: 0, qy: 0, qz: 0 } as never, null)
  rerender({})
  expect(result.current.shineStyle).toMatchObject({ opacity: 1, transform: [{ translateX: 0 }, { translateY: -100 }] })
  expect(result.current.spotStyle).toMatchObject({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: -100 * SPOT_PARALLAX }],
  })
})
