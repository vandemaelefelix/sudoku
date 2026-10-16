import type { EffectFamily } from '@/scan/effects/types'

/** The settings key of the saved effect id. */
export const EFFECT_KEY = 'lab.effect'

/** The families in the order of the dev list. */
export const FAMILIES: { family: EffectFamily; title: string }[] = [
  { family: 'simulation', title: 'Simulation' },
  { family: 'path', title: 'Path' },
  { family: 'shader', title: 'Shader' },
  { family: 'screen', title: 'Screen' },
]
