import { createGame, hintMessage, planHint, UNITS, type HintPlan, type HintRung } from '@sudoku/core'
import { createAppIntl } from '@/i18n/utils/intl.utils'
import { hintText } from '@/utils/hintText.utils'
import {
  FOCUS_FADE_MS,
  FOCUS_PULSE_PEAK,
  NO_FOCUS_PULSE,
  ROLE_POP_FROM,
  ROLE_STEP_MS,
  TARGET_PULSE_SCALE,
} from '@/game/constants/hint.constants'
import { pointingStart, sampleStart, stuckStart } from './sample.utils'
import type { OpenHint } from './session.utils'
import type { HintHighlight } from './cell.utils'
import {
  focusPulseOpacity,
  hintCardView,
  hintHighlight,
  hintTimings,
  rolePopScale,
  targetPulseScale,
} from './hint.utils'

const en = createAppIntl('en')
/** The English card text of a rung, as the app writes it. */
const textOf = (plan: HintPlan, step: number, rung: HintRung): string => hintText(en, hintMessage(plan, step, rung))

it('pulses the target outline once: still at both ends, smallest halfway', () => {
  expect(targetPulseScale(0)).toBe(1)
  expect(targetPulseScale(0.5)).toBeCloseTo(TARGET_PULSE_SCALE)
  expect(targetPulseScale(1)).toBe(1)
  expect(targetPulseScale(2)).toBe(1)
})

function planOf(start: ReturnType<typeof sampleStart>): HintPlan {
  const plan = planHint(createGame(start))
  if (plan === null) throw new Error('expected a plan')
  return plan
}

const pointing = planOf(pointingStart())
if (pointing.kind !== 'steps') throw new Error('expected a steps plan')
const [elimination, single] = pointing.steps as [(typeof pointing.steps)[0], (typeof pointing.steps)[0]]
const at = (step: number, rung: HintRung): OpenHint => ({ plan: pointing, step, rung })

describe('the highlight of each rung', () => {
  it('shows the focus unit on the look rung', () => {
    expect(hintHighlight(at(0, 1))).toEqual({
      units: [elimination.units[0]],
      pattern: [],
      support: [],
      eliminations: [],
      placements: [],
    })
  })

  it('adds every unit and the pattern on the technique rung', () => {
    expect(hintHighlight(at(0, 2))).toMatchObject({ units: elimination.units, pattern: elimination.pattern })
  })

  it('adds the support digits and the struck candidates on the why rung', () => {
    expect(hintHighlight(at(0, 3))).toMatchObject({
      support: elimination.support,
      eliminations: elimination.eliminations,
      placements: [],
    })
  })

  it('adds the target on the answer rung', () => {
    expect(hintHighlight(at(1, 4))).toMatchObject({ placements: single.placements })
  })

  it('keeps the candidates that earlier steps struck', () => {
    expect(hintHighlight(at(1, 1))?.eliminations).toEqual(elimination.eliminations)
  })

  it('marks nothing without an open hint', () => {
    expect(hintHighlight(null)).toBeNull()
  })

  it('marks the wrong cell of a mistake and the target of a fallback', () => {
    const mistake: OpenHint = { plan: { kind: 'mistake', cell: 7 }, step: 0, rung: 1 }
    expect(hintHighlight(mistake)).toMatchObject({ pattern: [7], placements: [] })
    const fallback = planOf(stuckStart())
    if (fallback.kind !== 'fallback') throw new Error('expected a fallback')
    expect(hintHighlight({ plan: fallback, step: 0, rung: 1 })).toEqual({
      units: [],
      pattern: [],
      support: [],
      eliminations: [],
      placements: [fallback.answer],
    })
  })
})

const labels = (hint: OpenHint) => hintCardView(en, hint).buttons.map((button) => button.label)

describe('the hint card view', () => {
  it('names the technique from rung 2 on, with the rung and the step', () => {
    expect(hintCardView(en, at(0, 1))).toMatchObject({ title: 'Hint', rung: 1, stepLabel: 'Step 1 of 2' })
    expect(elimination.technique).toBe('pointing')
    expect(hintCardView(en, at(0, 2)).title).toBe('Pointing')
    expect(hintCardView(en, at(1, 3)).text).toBe(textOf(pointing, 1, 3))
  })

  it('has no step label for a plan of one step', () => {
    const plan = planOf(sampleStart())
    expect(plan.kind === 'steps' && plan.steps).toHaveLength(1)
    expect(hintCardView(en, { plan, step: 0, rung: 1 }).stepLabel).toBeNull()
  })

  it('offers the buttons of each rung', () => {
    expect(labels(at(0, 1))).toEqual(['More help', 'Show answer'])
    expect(labels(at(0, 3))).toEqual(['More help', 'Show answer'])
    expect(labels(at(0, 4))).toEqual(['Next step'])
    expect(labels(at(1, 4))).toEqual(['Fill it'])
  })

  it('has one card for a mistake and one for a fallback, without rungs', () => {
    const mistake = hintCardView(en, { plan: { kind: 'mistake', cell: 7 }, step: 0, rung: 1 })
    expect(mistake).toMatchObject({ rung: null, stepLabel: null })
    expect(mistake.buttons.map((button) => button.action)).toEqual(['hintErase'])
    const fallback = planOf(stuckStart())
    const card = hintCardView(en, { plan: fallback, step: 0, rung: 1 })
    expect(card).toMatchObject({ rung: null, text: textOf(fallback, 0, 1) })
    expect(card.buttons.map((button) => button.action)).toEqual(['hintFill'])
  })

  it('offers the technique page from rung 2 on', () => {
    expect(hintCardView(en, at(0, 1)).technique).toBeNull()
    expect(hintCardView(en, at(0, 2)).technique).toBe(elimination.technique)
    expect(hintCardView(en, at(1, 4)).technique).toBe(single.technique)
    expect(hintCardView(en, { plan: { kind: 'mistake', cell: 7 }, step: 0, rung: 1 }).technique).toBeNull()
  })
})

describe('the curves of the role entrance', () => {
  it('pops from ROLE_POP_FROM past 1 and settles on 1', () => {
    expect(rolePopScale(0)).toBeCloseTo(ROLE_POP_FROM)
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(rolePopScale))).toBeGreaterThan(1)
    expect(rolePopScale(1)).toBe(1)
  })

  it('pulses the focus glow once: dark at both ends, strongest halfway', () => {
    expect(focusPulseOpacity(0)).toBe(0)
    expect(focusPulseOpacity(0.5)).toBeCloseTo(FOCUS_PULSE_PEAK)
    expect(focusPulseOpacity(1)).toBe(0)
  })
})

const highlight = (step: number, rung: HintRung) => hintHighlight(at(step, rung)) as HintHighlight
const unitCells = (unit: number | undefined) => [...(UNITS[unit ?? -1] ?? [])].toSorted((a, b) => a - b)

describe('the timings of a highlight change', () => {
  it('sweeps the focus unit in reading order, ROLE_STEP_MS apart, then pulses it once', () => {
    const timings = hintTimings(null, highlight(0, 1), false)
    const cells = unitCells(elimination.units[0])
    expect(cells.map((cell) => timings.focus[cell])).toEqual(cells.map((_, index) => index * ROLE_STEP_MS))
    expect(timings.pulseAt).toBe((cells.length - 1) * ROLE_STEP_MS + FOCUS_FADE_MS)
  })

  it('pops the pattern cells after the sweep of the new focus cells', () => {
    const before = highlight(0, 1)
    const timings = hintTimings(before, highlight(0, 2), false)
    const oldFocus = unitCells(elimination.units[0])
    const newFocus = [...new Set(elimination.units.flatMap(unitCells))].filter((cell) => !oldFocus.includes(cell))
    expect(newFocus.length).toBeGreaterThan(0)
    for (const cell of oldFocus) expect(timings.focus[cell]).toBe(0)
    const sweptAt = (newFocus.length - 1) * ROLE_STEP_MS + FOCUS_FADE_MS
    const pattern = [...elimination.pattern].toSorted((a, b) => a - b)
    expect(pattern.map((cell) => timings.pattern[cell])).toEqual(
      pattern.map((_, index) => sweptAt + index * ROLE_STEP_MS),
    )
  })

  it('plays only the roles that the rung adds: the strikes start at once on the why rung', () => {
    const timings = hintTimings(highlight(0, 2), highlight(0, 3), false)
    expect(timings.pulseAt).toBe(NO_FOCUS_PULSE)
    expect(timings.focus.every((delay) => delay === 0)).toBe(true)
    expect(timings.pattern.every((delay) => delay === 0)).toBe(true)
    const struck = [...new Set(elimination.eliminations.map((s) => s.cell))].toSorted((a, b) => a - b)
    expect(struck.map((cell) => timings.strike[cell])).toEqual(struck.map((_, index) => index * ROLE_STEP_MS))
  })

  it('shows the ghost after the pattern of its step', () => {
    const before = highlight(1, 3)
    const after = highlight(1, 4)
    const target = single.placements[0]?.cell ?? -1
    expect(hintTimings(before, after, false).ghost[target]).toBe(0)
    const fromLook = hintTimings(null, after, false)
    expect(fromLook.ghost[target]).toBeGreaterThan(fromLook.pulseAt)
  })

  it('starts every role at once, without a pulse, with Reduce Motion', () => {
    const timings = hintTimings(null, highlight(0, 3), true)
    expect(timings.reduced).toBe(true)
    expect(timings.pulseAt).toBe(NO_FOCUS_PULSE)
    for (const role of ['focus', 'pattern', 'support', 'strike', 'ghost'] as const) {
      expect(timings[role].every((delay) => delay === 0)).toBe(true)
    }
  })

  it('draws a new struck digit in a cell that already has a strike, and leaves the old one', () => {
    const none: HintHighlight = { units: [], pattern: [], support: [], eliminations: [], placements: [] }
    const before: HintHighlight = {
      ...none,
      eliminations: [
        { cell: 5, digit: 3 },
        { cell: 7, digit: 1 },
      ],
    }
    const after: HintHighlight = {
      ...none,
      eliminations: [...before.eliminations, { cell: 5, digit: 8 }, { cell: 9, digit: 2 }],
    }
    const timings = hintTimings(before, after, false)
    // Cell 5 counts as new, so cell 9 comes one step after it. Cell 7 has nothing new.
    expect(timings.strike[5]).toBe(0)
    expect(timings.strike[9]).toBe(ROLE_STEP_MS)
  })
})
