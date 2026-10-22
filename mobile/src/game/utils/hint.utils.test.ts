import { createGame, HINT_TECHNIQUES, hintText, planHint, type HintPlan, type HintRung } from '@sudoku/core'
import { TARGET_PULSE_SCALE } from '@/game/constants/hint.constants'
import { pointingStart, sampleStart, stuckStart } from './sample.utils'
import type { OpenHint } from './session.utils'
import { hintCardView, hintHighlight, targetPulseScale } from './hint.utils'

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
const at = (step: number, rung: HintRung, view: OpenHint['view'] = 'card'): OpenHint => ({
  plan: pointing,
  step,
  rung,
  view,
})

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

  it('stays on the strip and goes with "Nice."', () => {
    expect(hintHighlight(at(0, 2, 'strip'))).toEqual(hintHighlight(at(0, 2)))
    expect(hintHighlight(at(1, 4, 'nice'))).toBeNull()
    expect(hintHighlight(null)).toBeNull()
  })

  it('marks the wrong cell of a mistake and the target of a fallback', () => {
    const mistake: OpenHint = { plan: { kind: 'mistake', cell: 7 }, step: 0, rung: 1, view: 'card' }
    expect(hintHighlight(mistake)).toMatchObject({ pattern: [7], placements: [] })
    const fallback = planOf(stuckStart())
    if (fallback.kind !== 'fallback') throw new Error('expected a fallback')
    expect(hintHighlight({ plan: fallback, step: 0, rung: 1, view: 'card' })).toEqual({
      units: [],
      pattern: [],
      support: [],
      eliminations: [],
      placements: [fallback.answer],
    })
  })
})

const labels = (hint: OpenHint) => hintCardView(hint).buttons.map((button) => button.label)

describe('the hint card view', () => {
  it('names the technique from rung 2 on, with the rung and the step', () => {
    expect(hintCardView(at(0, 1))).toMatchObject({ title: 'Hint', rung: 1, stepLabel: 'Step 1 of 2' })
    expect(hintCardView(at(0, 2)).title).toBe(HINT_TECHNIQUES[elimination.technique]?.name)
    expect(hintCardView(at(1, 3)).text).toBe(hintText(pointing, 1, 3))
  })

  it('has no step label for a plan of one step', () => {
    const plan = planOf(sampleStart())
    expect(plan.kind === 'steps' && plan.steps).toHaveLength(1)
    expect(hintCardView({ plan, step: 0, rung: 1, view: 'card' }).stepLabel).toBeNull()
  })

  it('offers the buttons of each rung', () => {
    expect(labels(at(0, 1))).toEqual(['More help', 'Show answer', 'Try it'])
    expect(labels(at(0, 3))).toEqual(['More help', 'Show answer', 'Try it'])
    expect(labels(at(0, 4))).toEqual(['Next step'])
    expect(labels(at(1, 4))).toEqual(['Fill it', "I'll do it"])
  })

  it('has one card for a mistake and one for a fallback, without rungs', () => {
    const mistake = hintCardView({ plan: { kind: 'mistake', cell: 7 }, step: 0, rung: 1, view: 'card' })
    expect(mistake).toMatchObject({ rung: null, stepLabel: null })
    expect(mistake.buttons.map((button) => button.action)).toEqual(['hintErase'])
    const fallback = planOf(stuckStart())
    const card = hintCardView({ plan: fallback, step: 0, rung: 1, view: 'card' })
    expect(card).toMatchObject({ rung: null, text: hintText(fallback, 0, 1) })
    expect(card.buttons.map((button) => button.action)).toEqual(['hintFill', 'hintTry'])
  })

  it('says "Nice." on the strip once the player placed the target', () => {
    expect(hintCardView(at(1, 4, 'nice')).text).toBe('Nice.')
  })
})
