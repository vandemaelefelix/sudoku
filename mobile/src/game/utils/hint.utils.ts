import { TARGET_PULSE_SCALE } from '@/game/constants/hint.constants'

/** The scale of the target outline at progress 0 to 1 of its pulse: 1 at both ends, TARGET_PULSE_SCALE halfway. */
export function targetPulseScale(progress: number): number {
  'worklet'
  if (progress <= 0 || progress >= 1) return 1
  return 1 - (1 - TARGET_PULSE_SCALE) * Math.sin(Math.PI * progress)
}
