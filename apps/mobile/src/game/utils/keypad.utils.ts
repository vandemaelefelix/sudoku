import { KEY_DONE } from '@/game/constants/keypad.constants'

export type KeyLook = { opacity: number; scale: number }

// CSS applies ease-out to each keyframe segment, not to the whole animation.
function easeOut(t: number): number {
  'worklet'
  return 1 - (1 - t) * (1 - t)
}

function fadeTo(doneOpacity: number, t: number): number {
  'worklet'
  return 1 - (1 - doneOpacity) * t
}

/** progress: 0 (open key) to 1 (complete key), linear in time. Reduce Motion keeps the scale at 1. */
export function keyDoneLook(progress: number, reduceMotion: boolean, doneOpacity: number): KeyLook {
  'worklet'
  const p = Math.min(1, Math.max(0, progress))
  if (reduceMotion) return { opacity: fadeTo(doneOpacity, easeOut(p)), scale: 1 }
  if (p <= KEY_DONE.peakAt) {
    return { opacity: 1, scale: 1 + (KEY_DONE.scale - 1) * easeOut(p / KEY_DONE.peakAt) }
  }
  const t = easeOut((p - KEY_DONE.peakAt) / (1 - KEY_DONE.peakAt))
  return { opacity: fadeTo(doneOpacity, t), scale: KEY_DONE.scale - (KEY_DONE.scale - 1) * t }
}
