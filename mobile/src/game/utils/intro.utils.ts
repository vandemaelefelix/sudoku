import {
  INTRO_FADE_MS,
  INTRO_LAST_DIAGONAL,
  INTRO_STEP_MS,
  INTRO_SWEEP_DELAY_MS,
} from '@/game/constants/intro.constants'
import type { Theme } from '@/theme/theme.types'
import { easeOut } from '@/utils/motion.utils'

/** The timing of one grid entrance. reduced: no sweep, every digit fades in over reducedMs. */
export type IntroLook = { reduced: boolean; reducedMs: number }

export function introLook({ motion }: Theme, reduced: boolean): IntroLook {
  return { reduced, reducedMs: motion.short }
}

function fadeIn(elapsed: number, start: number, duration: number): number {
  'worklet'
  return easeOut(Math.min(1, Math.max(0, (elapsed - start) / duration)))
}

/** 0..1: the opacity of the content of a cell at elapsed ms after the grid mounted. diagonal: row + column, 0 to 16. */
export function introCellAlpha(elapsed: number, diagonal: number, look: IntroLook): number {
  'worklet'
  if (look.reduced) return fadeIn(elapsed, 0, look.reducedMs)
  return fadeIn(elapsed, INTRO_SWEEP_DELAY_MS + diagonal * INTRO_STEP_MS, INTRO_FADE_MS)
}

/** Milliseconds from the mount of the grid to the end of the entrance. */
export function introDuration(look: IntroLook): number {
  if (look.reduced) return look.reducedMs
  return INTRO_SWEEP_DELAY_MS + INTRO_LAST_DIAGONAL * INTRO_STEP_MS + INTRO_FADE_MS
}
