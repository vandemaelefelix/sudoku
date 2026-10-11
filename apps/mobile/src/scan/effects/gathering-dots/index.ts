import type { Effect } from '../types'
import { drawField } from './draw'
import { createField, type FieldState, stepField } from './field'

/** The dot field of the scan experience design, stage 1. */
export const gatheringDots: Effect<FieldState> = {
  id: 'gathering-dots',
  name: 'Gathering dots',
  family: 'simulation',
  create: createField,
  step: stepField,
  draw: drawField,
}
