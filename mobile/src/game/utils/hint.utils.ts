import { HINT_TECHNIQUES, hintText, type Step, type TechniqueId } from '@sudoku/core'
import { HINT_LABELS, HINT_NICE, HINT_TITLE, TARGET_PULSE_SCALE } from '@/game/constants/hint.constants'
import type { HintHighlight } from './cell.utils'
import type { HintCardAction, OpenHint } from './session.utils'

/** The scale of the target outline at progress 0 to 1 of its pulse: 1 at both ends, TARGET_PULSE_SCALE halfway. */
export function targetPulseScale(progress: number): number {
  'worklet'
  if (progress <= 0 || progress >= 1) return 1
  return 1 - (1 - TARGET_PULSE_SCALE) * Math.sin(Math.PI * progress)
}

const NOTHING: HintHighlight = { units: [], pattern: [], support: [], eliminations: [], placements: [] }

/**
 * The cells that the grid marks for an open hint. The roles grow with the rungs: the focus unit on rung 1, every unit
 * and the pattern on rung 2, the support digits and the struck candidates on rung 3, the target on rung 4.
 * The candidates that earlier steps struck stay struck. null: nothing to mark.
 */
export function hintHighlight(hint: OpenHint | null): HintHighlight | null {
  if (hint === null || hint.view === 'nice') return null
  const { plan, step: index, rung } = hint
  switch (plan.kind) {
    case 'mistake':
      return { ...NOTHING, pattern: [plan.cell] }
    case 'fallback':
      return { ...NOTHING, placements: [plan.answer] }
    case 'steps':
      break
  }
  const step: Step | undefined = plan.steps[index]
  if (step === undefined) return null
  const earlier = plan.steps.slice(0, index).flatMap((before) => before.eliminations)
  return {
    units: rung === 1 ? step.units.slice(0, 1) : step.units,
    pattern: rung >= 2 ? step.pattern : [],
    support: rung >= 3 ? step.support : [],
    eliminations: rung >= 3 ? [...earlier, ...step.eliminations] : earlier,
    placements: rung === 4 ? step.placements : [],
  }
}

export type HintButton = { action: HintCardAction; label: string }

/**
 * What the hint card and the strip show. rung: the filled rung dots, null for the one card of a mistake or a fallback.
 * stepLabel: "Step 1 of 2", null for a plan of one step. The first button is the main one.
 * technique: the technique of "Learn more", from rung 2 on. Null before the card names it.
 */
export type HintCardView = {
  title: string
  text: string
  rung: number | null
  stepLabel: string | null
  buttons: readonly HintButton[]
  technique: TechniqueId | null
}

const FILL: readonly HintButton[] = [
  { action: 'hintFill', label: HINT_LABELS.hintFill },
  { action: 'hintTry', label: HINT_LABELS.hintDoIt },
]

const HELP: readonly HintButton[] = [
  { action: 'hintMore', label: HINT_LABELS.hintMore },
  { action: 'hintAnswer', label: HINT_LABELS.hintAnswer },
  { action: 'hintTry', label: HINT_LABELS.hintTry },
]

export function hintCardView(hint: OpenHint): HintCardView {
  const { plan, step, rung } = hint
  const text = hint.view === 'nice' ? HINT_NICE : hintText(plan, step, rung)
  switch (plan.kind) {
    case 'mistake':
      return {
        title: HINT_TITLE,
        text,
        rung: null,
        stepLabel: null,
        buttons: [{ action: 'hintErase', label: HINT_LABELS.hintErase }],
        technique: null,
      }
    case 'fallback':
      return { title: HINT_TITLE, text, rung: null, stepLabel: null, buttons: FILL, technique: null }
    case 'steps':
      break
  }
  const last = step === plan.steps.length - 1
  const technique = plan.steps[step]?.technique
  const name = technique === undefined ? undefined : HINT_TECHNIQUES[technique]?.name
  let buttons = HELP
  if (rung === 4) buttons = last ? FILL : [{ action: 'hintNext', label: HINT_LABELS.hintNext }]
  return {
    title: rung >= 2 && name !== undefined ? name : HINT_TITLE,
    text,
    rung,
    stepLabel: plan.steps.length > 1 ? `Step ${step + 1} of ${plan.steps.length}` : null,
    buttons,
    technique: rung >= 2 && name !== undefined ? (technique ?? null) : null,
  }
}
