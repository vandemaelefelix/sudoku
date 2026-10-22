import { HINT_TECHNIQUES, hintMessage, type HintTechniqueId, type Step, type TechniqueId } from '@sudoku/core'
import { hintText, techniqueName } from '@/utils/hintText.utils'
import type { MessageId } from '@/i18n/messages'
import type { Formatter } from '@/i18n/utils/intl.utils'
import type { HintHighlight } from './cell.utils'
import type { HintCardAction, OpenHint } from './session.utils'

const NOTHING: HintHighlight = { units: [], pattern: [], support: [], eliminations: [], placements: [] }

/**
 * The cells that the grid marks for an open hint. The roles grow with the rungs: the focus unit on rung 1, every unit
 * and the pattern on rung 2, the support digits and the struck candidates on rung 3, the target on rung 4.
 * The candidates that earlier steps struck stay struck. null: nothing to mark.
 */
export function hintHighlight(hint: OpenHint | null): HintHighlight | null {
  if (hint === null) return null
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
 * What the hint card shows. rung: the filled rung dots, null for the one card of a mistake or a fallback.
 * stepLabel: "Step 1 of 2", null for a plan of one step. The first button is the main one, the others are text buttons.
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

type ButtonId = { action: HintCardAction; label: MessageId }

const FILL: readonly ButtonId[] = [{ action: 'hintFill', label: 'hint.button.fill' }]

const HELP: readonly ButtonId[] = [
  { action: 'hintMore', label: 'hint.button.more' },
  { action: 'hintAnswer', label: 'hint.button.answer' },
]

export function hintCardView(intl: Formatter, hint: OpenHint): HintCardView {
  const { plan, step, rung } = hint
  const label = (buttons: readonly ButtonId[]): HintButton[] =>
    buttons.map((button) => ({ action: button.action, label: intl.formatMessage({ id: button.label }) }))
  const hintTitle = intl.formatMessage({ id: 'hint.title' })
  const text = hintText(intl, hintMessage(plan, step, rung))
  switch (plan.kind) {
    case 'mistake':
      return {
        title: hintTitle,
        text,
        rung: null,
        stepLabel: null,
        buttons: label([{ action: 'hintErase', label: 'hint.button.erase' }]),
        technique: null,
      }
    case 'fallback':
      return { title: hintTitle, text, rung: null, stepLabel: null, buttons: label(FILL), technique: null }
    case 'steps':
      break
  }
  const last = step === plan.steps.length - 1
  const technique = plan.steps[step]?.technique
  // The planner uses only the techniques of HINT_TECHNIQUES, so a technique there has a name in the catalogue.
  const name =
    technique === undefined || HINT_TECHNIQUES[technique] === undefined
      ? undefined
      : techniqueName(intl, technique as HintTechniqueId)
  let buttons = HELP
  if (rung === 4) buttons = last ? FILL : [{ action: 'hintNext', label: 'hint.button.next' }]
  return {
    title: rung >= 2 && name !== undefined ? name : hintTitle,
    text,
    rung,
    stepLabel:
      plan.steps.length > 1
        ? intl.formatMessage({ id: 'hint.step' }, { step: step + 1, total: plan.steps.length })
        : null,
    buttons: label(buttons),
    technique: rung >= 2 && name !== undefined ? (technique ?? null) : null,
  }
}
