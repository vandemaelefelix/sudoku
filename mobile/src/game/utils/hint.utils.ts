import { HINT_TECHNIQUES, hintMessage, UNITS, type HintTechniqueId, type Step, type TechniqueId } from '@sudoku/core'
import {
  FOCUS_FADE_MS,
  FOCUS_PULSE_PEAK,
  GHOST_FADE_MS,
  NO_FOCUS_PULSE,
  ROLE_POP_FROM,
  ROLE_POP_MS,
  ROLE_STEP_MS,
  STRIKE_DRAW_MS,
  TARGET_PULSE_SCALE,
} from '@/game/constants/hint.constants'
import { hintText, techniqueName } from '@/utils/hintText.utils'
import type { MessageId } from '@/i18n/messages'
import type { Formatter } from '@/i18n/utils/intl.utils'
import type { HintHighlight } from './cell.utils'
import type { HintCardAction, OpenHint } from './session.utils'

/** The scale of the target outline at progress 0 to 1 of its pulse: 1 at both ends, TARGET_PULSE_SCALE halfway. */
export function targetPulseScale(progress: number): number {
  'worklet'
  if (progress <= 0 || progress >= 1) return 1
  return 1 - (1 - TARGET_PULSE_SCALE) * Math.sin(Math.PI * progress)
}

/** The scale of a pattern cell or a support ring at progress 0 to 1 of its pop: from ROLE_POP_FROM, a small overshoot, then 1. */
export function rolePopScale(progress: number): number {
  'worklet'
  if (progress >= 1) return 1
  const t = Math.max(0, progress) - 1
  // An ease-out-back curve: it passes 1 near the end and settles back on it.
  const overshoot = 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2
  return ROLE_POP_FROM + (1 - ROLE_POP_FROM) * overshoot
}

/** The opacity of the glow of the focus pulse at progress 0 to 1: 0 at both ends, FOCUS_PULSE_PEAK halfway. */
export function focusPulseOpacity(progress: number): number {
  'worklet'
  if (progress <= 0 || progress >= 1) return 0
  return FOCUS_PULSE_PEAK * Math.sin(Math.PI * progress)
}

export type HintRole = 'focus' | 'pattern' | 'support' | 'strike' | 'ghost'

/**
 * When the roles of one highlight change start, in ms after the change, one value per cell. Only the roles that the
 * change adds play: the others are on the grid already. pulseAt: the start of the one pulse of the new focus cells, or
 * NO_FOCUS_PULSE. reduced: Reduce Motion is on, so every role starts at once and only fades.
 */
export type HintTimings = Readonly<Record<HintRole, readonly number[]>> & { pulseAt: number; reduced: boolean }

const STILL = Array.from({ length: 81 }, () => 0)

/** The timings of no change. */
export const NO_HINT_TIMINGS: HintTimings = {
  focus: STILL,
  pattern: STILL,
  support: STILL,
  strike: STILL,
  ghost: STILL,
  pulseAt: NO_FOCUS_PULSE,
  reduced: false,
}

/** Each cell once, in reading order. */
const inOrder = (cells: readonly number[]): number[] => [...new Set(cells)].toSorted((a, b) => a - b)

const focusOf = (highlight: HintHighlight | null): number[] =>
  inOrder(highlight?.units.flatMap((unit) => UNITS[unit] ?? []) ?? [])

/** The cells of after that before does not have, in reading order. */
const added = (before: readonly number[], after: readonly number[]): number[] =>
  inOrder(after.filter((cell) => !before.includes(cell)))

/** The cells of each role that a change can add, apart from the strikes, which count per digit. */
const cellsOf = (highlight: HintHighlight | null) => ({
  focus: focusOf(highlight),
  pattern: highlight?.pattern ?? [],
  support: highlight?.support ?? [],
  ghost: highlight?.placements.map((placement) => placement.cell) ?? [],
})

const struckKey = ({ cell, digit }: { cell: number; digit: number }) => `${cell}:${digit}`

/** Starts the cells at start, ROLE_STEP_MS apart. Returns the end of the last cell, or start for no cells. */
function sweep(delays: number[], cells: readonly number[], start: number, durationMs: number): number {
  cells.forEach((cell, index) => {
    delays[cell] = start + index * ROLE_STEP_MS
  })
  return cells.length === 0 ? start : start + (cells.length - 1) * ROLE_STEP_MS + durationMs
}

/**
 * The timings of the change from before to after: the focus sweep, then the pattern pops, then the support rings and
 * the strikes together, then the ghost of the target. A role that has no new cell takes no time.
 */
export function hintTimings(before: HintHighlight | null, after: HintHighlight | null, reduced: boolean): HintTimings {
  const old = cellsOf(before)
  const now = cellsOf(after)
  // A note that an earlier rung struck keeps its line. A cell with a new struck digit draws only the new line.
  const struckBefore = new Set(before?.eliminations.map(struckKey))
  const newStrikes = inOrder(
    (after?.eliminations ?? []).filter((struck) => !struckBefore.has(struckKey(struck))).map((struck) => struck.cell),
  )
  const timings = {
    focus: [...STILL],
    pattern: [...STILL],
    support: [...STILL],
    strike: [...STILL],
    ghost: [...STILL],
  }
  if (reduced) return { ...timings, pulseAt: NO_FOCUS_PULSE, reduced }
  const newFocus = added(old.focus, now.focus)
  const sweptAt = sweep(timings.focus, newFocus, 0, FOCUS_FADE_MS)
  const poppedAt = sweep(timings.pattern, added(old.pattern, now.pattern), sweptAt, ROLE_POP_MS)
  const ringedAt = sweep(timings.support, added(old.support, now.support), poppedAt, ROLE_POP_MS)
  const struckAt = sweep(timings.strike, newStrikes, poppedAt, STRIKE_DRAW_MS)
  sweep(timings.ghost, added(old.ghost, now.ghost), Math.max(ringedAt, struckAt), GHOST_FADE_MS)
  return { ...timings, pulseAt: newFocus.length === 0 ? NO_FOCUS_PULSE : sweptAt, reduced }
}

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
