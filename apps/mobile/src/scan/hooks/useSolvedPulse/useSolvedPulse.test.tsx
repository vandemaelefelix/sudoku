import { renderHook } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import { pulseLook } from '@/game/utils/pulse.utils'
import { cobalt } from '@/theme/themes/cobalt'
import { solvedDelays } from '@/scan/utils/solvedPulse.utils'
import { useSolvedPulse } from './useSolvedPulse'

const STEP = pulseLook(cobalt).stepMs

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => false)
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation(
      () => ({ remove: jest.fn() }) as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>,
    )
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(useReducedMotion).mockReturnValue(false)
})

it('stays still while inactive', () => {
  const { result } = renderHook(() => useSolvedPulse(false))
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
})

it('pulses out from the centre when it becomes active', () => {
  const { result, rerender } = renderHook(({ active }: { active: boolean }) => useSolvedPulse(active), {
    initialProps: { active: false },
  })
  rerender({ active: true })
  expect(result.current.delays.get()).toEqual(solvedDelays(STEP))
})

it('does not pulse with Reduce Motion', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => true)
  const { result, rerender } = renderHook(({ active }: { active: boolean }) => useSolvedPulse(active), {
    initialProps: { active: false },
  })
  rerender({ active: true })
  expect(result.current.delays.get().every((delay) => delay === NO_PULSE)).toBe(true)
})
