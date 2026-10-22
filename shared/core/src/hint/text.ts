import { capitalised, cellName } from './names'
import { HINT_TECHNIQUES } from './techniques'
import type { HintPlan, HintRung } from './types'

/**
 * The card text of one rung of one step: at most two short sentences. A mistake plan and a
 * fallback plan have one card each, so they ignore `stepIndex` and `rung`.
 * Throws a RangeError when the plan has no step at `stepIndex`.
 */
export function hintText(plan: HintPlan, stepIndex: number, rung: HintRung): string {
  switch (plan.kind) {
    case 'mistake':
      return `${capitalised(cellName(plan.cell))} holds a wrong digit. Erase it first.`
    case 'fallback':
      return (
        'No hint technique fits this board. ' +
        `Put ${plan.answer.digit} in ${cellName(plan.answer.cell)}, the cell with the fewest possible digits.`
      )
    case 'steps':
      break
  }
  const step = plan.steps[stepIndex]
  if (step === undefined) throw new RangeError(`The plan has no step ${stepIndex}`)
  // The planner uses only the techniques of HINT_TECHNIQUES.
  const technique = HINT_TECHNIQUES[step.technique]!
  switch (rung) {
    case 1:
      return technique.look(step)
    case 2:
      return `${technique.name}: ${technique.definition}`
    case 3:
      return technique.why(step, stepIndex > 0)
    case 4:
      return technique.answer(step)
  }
}
