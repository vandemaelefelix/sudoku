import { TARGET_PULSE_SCALE } from '@/game/constants/hint.constants'
import { targetPulseScale } from './hint.utils'

it('pulses the target outline once: still at both ends, smallest halfway', () => {
  expect(targetPulseScale(0)).toBe(1)
  expect(targetPulseScale(0.5)).toBeCloseTo(TARGET_PULSE_SCALE)
  expect(targetPulseScale(1)).toBe(1)
  expect(targetPulseScale(2)).toBe(1)
})
