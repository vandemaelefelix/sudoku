import { gatheringDots } from './gathering-dots'
import { gridLattice } from './grid-lattice'
import { spotlightBrackets } from './spotlight-brackets'
import type { AnyEffect } from './types'

// To add an effect, add its folder and one line here. The dev list keeps this order within a family.
export const EFFECTS: readonly AnyEffect[] = [gatheringDots, spotlightBrackets, gridLattice]

/** A release build runs only this effect. */
export const DEFAULT_INDEX = 0
export const DEFAULT_EFFECT = EFFECTS[DEFAULT_INDEX]

export function effectAt(index: number): AnyEffect {
  'worklet'
  return Number.isInteger(index) && index >= 0 && index < EFFECTS.length ? EFFECTS[index] : DEFAULT_EFFECT
}

/** DEFAULT_INDEX for an unknown id, for example the saved id of a deleted effect. */
export function effectIndex(id: string | null): number {
  const index = EFFECTS.findIndex((effect) => effect.id === id)
  return index < 0 ? DEFAULT_INDEX : index
}

export function findEffect(id: string | null): AnyEffect {
  return EFFECTS[effectIndex(id)]
}
