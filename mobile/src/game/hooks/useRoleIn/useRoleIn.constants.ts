import { FOCUS_FADE_MS, GHOST_FADE_MS, ROLE_POP_MS, STRIKE_DRAW_MS } from '@/game/constants/hint.constants'
import type { HintRole } from '@/game/utils/hint.utils'

/** Milliseconds of the entrance of each role. Reduce Motion uses ROLE_FADE_MS for all of them. */
export const ROLE_MS: Readonly<Record<HintRole, number>> = {
  focus: FOCUS_FADE_MS,
  pattern: ROLE_POP_MS,
  support: ROLE_POP_MS,
  strike: STRIKE_DRAW_MS,
  ghost: GHOST_FADE_MS,
}
