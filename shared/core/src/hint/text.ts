import { cell, type HintMessage, message } from './message'
import { HINT_TECHNIQUES } from './techniques'
import type { HintPlan, HintRung } from './types'

/**
 * The card message of one rung of one step: at most two short sentences in every language. A mistake plan and a
 * fallback plan have one card each, so they ignore `stepIndex` and `rung`. The app formats the message (ADR-033).
 * Throws a RangeError when the plan has no step at `stepIndex`.
 */
export function hintMessage(plan: HintPlan, stepIndex: number, rung: HintRung): HintMessage {
  switch (plan.kind) {
    case 'mistake':
      return message('hint.mistake', { cell: cell(plan.cell) })
    case 'fallback':
      return message('hint.fallback', { digit: plan.answer.digit, cell: cell(plan.answer.cell) })
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
      return { ...message('hint.technique'), technique: step.technique }
    case 3:
      return technique.why(step, stepIndex > 0)
    case 4:
      return technique.answer(step)
  }
}
