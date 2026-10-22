import { describe, expect, it } from 'vitest'
import { bitCount } from '../bits'
import { valueAt } from '../game/completion'
import { createGame } from '../game/createGame'
import { SAMPLE_GIVENS, SAMPLE_SOLUTION, solvedExcept } from '../game/samplePuzzle'
import type { Digit, Game } from '../game/types'
import { select, toggleNote } from '../game/actions'
import { solve } from '../solver'
import { computeCandidates } from '../technique/candidates'
import { bitOf } from '../technique/masks'
import { TIER_1_ORDER } from '../technique/order'
import { nextSteps } from '../technique/nextSteps'
import { boardFromString } from '../technique/testKit'
import type { Candidates, Step } from '../technique/types'
import { BOX_OF, COL_OF, PEERS, ROW_OF, UNITS } from '../units'
import { unitName } from './names'
import { byChoice, MAX_HINT_STEPS, planHint } from './plan'
import { HINT_ORDER, HINT_TECHNIQUES } from './techniques'
import { hintText } from './text'

/** A game at `board`, a position of the puzzle `givens`. */
function gameAt(givens: string, board: string, selected: number | null = null): Game {
  const start = boardFromString(givens)
  const result = solve(start)
  if (result.count !== 1) throw new Error('A fixture has exactly one solution')
  const { solution } = result
  const entries = boardFromString(board).map((digit, cell) => (start[cell] === 0 ? digit : 0))
  const game = createGame({ givens: start, solution, entries })
  return selected === null ? game : select(game, selected)
}

const sample = (entries?: number[]): Game =>
  createGame({ givens: SAMPLE_GIVENS, solution: SAMPLE_SOLUTION, ...(entries ? { entries } : {}) })

const boardOf = (game: Game): number[] => game.givens.map((_, cell) => valueAt(game, cell))

function removed(candidates: Candidates, step: Step): Candidates {
  const next = new Uint16Array(candidates)
  for (const { cell, digit } of step.eliminations) next[cell]! &= ~bitOf(digit)
  return next
}

/** True when each step is still a step of its technique after the steps before it. */
function replays(steps: readonly Step[], board: readonly number[]): boolean {
  let candidates = computeCandidates(board)
  for (const step of steps) {
    const ranks = HINT_ORDER.filter((rank) => rank.technique === step.technique)
    const found = ranks.flatMap((rank) => nextSteps(candidates, board, [rank], { unique: true }))
    if (!found.some((other) => JSON.stringify(other) === JSON.stringify(step))) return false
    candidates = removed(candidates, step)
  }
  return true
}

// Positions of generated puzzles. Each pair is the givens, then the board of the position.
const POINTING_THEN_SINGLE = [
  '071000005006005903030000000000000438060000700493708000340016000009803000100497000',
  '971034005006175943534080017710000438060341700493708001347016000609803174100497306',
] as const
// The greedy search takes 6 steps here. Only 2 of them lead to the single.
const PRUNED = [
  '049002060000900400000840300010090002803006004900701000600000003008000501000020000',
  '049002060080960400060840309516090002873256194924701600600000203208600501400020906',
] as const
// No tier 1 technique applies. Tier 2 does.
const TIER_2_NEEDED = [
  '680000000004000070009000015090326000010070068002004700940600103000000904800209600',
  '680000092104090076309060015798326541413975268562004739940600123206000984831249657',
] as const
// No hint technique of tier 1 or tier 2 applies at all.
const STUCK = [
  '005400020009600000000003007050000006100000009700908400080170054000000700010050093',
  '005490320009600540001503967950042106100065209700918435080179654590830712017250893',
] as const
// The hint techniques reach a placement, but no plan of 6 steps or fewer is left.
const TOO_LONG = [
  '741089000080100000000030008058007090002400075900008602065913000070000000003000050',
  '741089000380100000520030008458007090632491875917358642065913000074000009093000050',
] as const

describe('planHint', () => {
  it('returns one placement step on an easy board', () => {
    const plan = planHint(sample())
    expect(plan?.kind).toBe('steps')
    if (plan?.kind !== 'steps') return
    expect(plan.steps).toHaveLength(1)
    expect(plan.answer).toEqual(plan.steps[0]!.placements[0])
    expect(plan.answer.digit).toBe(SAMPLE_SOLUTION[plan.answer.cell])
  })

  it('takes a full house before a hidden single', () => {
    const plan = planHint(sample(solvedExcept(2, 3, 40)))
    expect(plan?.kind === 'steps' && plan.steps[0]!.technique).toBe('fullHouse')
  })

  it('leads an elimination to the single that it unlocks', () => {
    const plan = planHint(gameAt(...POINTING_THEN_SINGLE))
    expect(plan?.kind).toBe('steps')
    if (plan?.kind !== 'steps') return
    expect(plan.steps.map((step) => step.technique)).toEqual(['pointing', 'hiddenSingle'])
    expect(plan.steps[0]!.placements).toEqual([])
    expect(plan.steps[0]!.eliminations.length).toBeGreaterThan(0)
  })

  it('gives a real pointing step the units that its text names: the box, then the line', () => {
    const plan = planHint(gameAt(...POINTING_THEN_SINGLE))
    if (plan?.kind !== 'steps') throw new Error('expected a steps plan')
    const [box, line] = plan.steps[0]!.units as [number, number]
    expect(UNITS[box]).toEqual(expect.arrayContaining([...plan.steps[0]!.pattern]))
    for (const { cell } of plan.steps[0]!.eliminations) {
      expect(UNITS[line]).toContain(cell)
      expect(UNITS[box]).not.toContain(cell)
    }
    expect(hintText(plan, 0, 4)).toBe(
      `Remove ${plan.steps[0]!.digits[0]} from ${unitName(line)}, outside ${unitName(box)}.`,
    )
    expect(box).toBeGreaterThanOrEqual(18)
  })

  it('keeps only the eliminations that the placement needs', () => {
    const game = gameAt(...PRUNED)
    const plan = planHint(game)
    expect(plan?.kind).toBe('steps')
    if (plan?.kind !== 'steps') return
    expect(plan.steps).toHaveLength(2)
    const board = boardOf(game)
    expect(replays(plan.steps, board)).toBe(true)
    for (let index = 0; index < plan.steps.length - 1; index++) {
      expect(
        replays(
          plan.steps.filter((_, other) => other !== index),
          board,
        ),
      ).toBe(false)
    }
  })

  it('gives every step of a plan: eliminations first, one placement last', () => {
    for (const [givens, board] of [POINTING_THEN_SINGLE, PRUNED]) {
      const plan = planHint(gameAt(givens, board))
      if (plan?.kind !== 'steps') throw new Error('expected a steps plan')
      expect(plan.steps.length).toBeLessThanOrEqual(MAX_HINT_STEPS)
      expect(plan.steps.slice(0, -1).every((step) => step.placements.length === 0)).toBe(true)
      expect(plan.steps.at(-1)!.placements).toHaveLength(1)
    }
  })

  it('names the empty cell with the fewest candidates when no hint technique applies', () => {
    const game = gameAt(...STUCK)
    const board = boardOf(game)
    const candidates = computeCandidates(board)
    expect(nextSteps(candidates, board, HINT_ORDER, { unique: true })).toEqual([])
    const plan = planHint(game)
    expect(plan?.kind).toBe('fallback')
    if (plan?.kind !== 'fallback') return
    const { cell, digit } = plan.answer
    const empty = board.flatMap((value, other) => (value === 0 ? [other] : []))
    const fewest = Math.min(...empty.map((other) => bitCount(candidates[other]!)))
    expect(bitCount(candidates[cell]!)).toBe(fewest)
    const filled = (other: number) => PEERS[other]!.filter((peer) => board[peer] !== 0).length
    const ties = empty.filter((other) => bitCount(candidates[other]!) === fewest)
    expect(filled(cell)).toBe(Math.max(...ties.map(filled)))
    expect(digit).toBe(game.solution[cell])
  })

  it('teaches a tier 2 technique where tier 1 alone gives the fallback', () => {
    const game = gameAt(...TIER_2_NEEDED)
    expect(planHint(game, TIER_1_ORDER)?.kind).toBe('fallback')
    const plan = planHint(game)
    if (plan?.kind !== 'steps') throw new Error('expected a steps plan')
    const tier1 = new Set(TIER_1_ORDER.map((rank) => rank.technique))
    expect(plan.steps.some((step) => !tier1.has(step.technique))).toBe(true)
  })

  it('takes the fallback when the placement needs more than six steps', () => {
    const game = gameAt(...TOO_LONG)
    const board = boardOf(game)
    expect(nextSteps(computeCandidates(board), board, HINT_ORDER, { unique: true })).not.toEqual([])
    expect(planHint(game)?.kind).toBe('fallback')
  })

  it('takes the fallback cell nearest the selected cell among equal cells', () => {
    const board = boardOf(gameAt(...STUCK))
    const candidates = computeCandidates(board)
    const filled = (cell: number) => PEERS[cell]!.filter((peer) => board[peer] !== 0).length
    const empty = board.flatMap((value, cell) => (value === 0 ? [cell] : []))
    const key = (cell: number) => bitCount(candidates[cell]!) * 100 - filled(cell)
    const best = Math.min(...empty.map(key))
    const ties = empty.filter((cell) => key(cell) === best)
    expect(ties.length).toBeGreaterThan(1)
    for (const cell of ties) {
      const plan = planHint(gameAt(...STUCK, cell))
      expect(plan?.kind === 'fallback' && plan.answer.cell).toBe(cell)
    }
  })

  it('names a wrong entry first, and teaches nothing', () => {
    const entries = solvedExcept(2, 3)
    entries[40] = 1
    expect(planHint(sample(entries))).toEqual({ kind: 'mistake', cell: 40 })
  })

  it('names the wrong entry nearest the selected cell', () => {
    const entries = solvedExcept(2, 3)
    entries[10] = SAMPLE_SOLUTION[10] === 1 ? 2 : 1
    entries[70] = SAMPLE_SOLUTION[70] === 1 ? 2 : 1
    expect(planHint(sample(entries))).toEqual({ kind: 'mistake', cell: 10 })
    expect(planHint(select(sample(entries), 80))).toEqual({ kind: 'mistake', cell: 70 })
  })

  it('returns null when the grid is solved', () => {
    expect(planHint(sample(solvedExcept()))).toBeNull()
  })

  it('takes the step nearest the selected cell', () => {
    for (const selected of [0, 40, 80]) {
      const game = select(sample(), selected)
      const plan = planHint(game)
      if (plan?.kind !== 'steps') throw new Error('expected a steps plan')
      const board = boardOf(game)
      const steps = nextSteps(computeCandidates(board), board, HINT_ORDER, { unique: true })
      const sameUnit = (cell: number) =>
        ROW_OF[cell] === ROW_OF[selected] || COL_OF[cell] === COL_OF[selected] || BOX_OF[cell] === BOX_OF[selected]
      expect(steps.some((step) => sameUnit(step.placements[0]!.cell))).toBe(true)
      expect(sameUnit(plan.answer.cell)).toBe(true)
    }
  })

  it('gives the same plan for the same board', () => {
    expect(planHint(gameAt(...PRUNED))).toEqual(planHint(gameAt(...PRUNED)))
  })

  it('never reads or changes the notes', () => {
    const game = select(sample(), 2)
    const noted = ([1, 2, 3] as Digit[]).reduce((current, digit) => toggleNote(current, digit).game, game)
    const copy = structuredClone(noted)
    expect(planHint(noted)).toEqual(planHint(game))
    expect(noted).toEqual(copy)
  })

  it('uses only techniques with hint text', () => {
    for (const rank of HINT_ORDER) expect(HINT_TECHNIQUES[rank.technique]).toBeDefined()
    expect(HINT_ORDER.map((rank) => rank.technique)).not.toContain('simpleColouring')
  })
})

function fakeStep(cell: number, placement: boolean, unit = 0): Step {
  return {
    technique: placement ? 'hiddenSingle' : 'pointing',
    placements: placement ? [{ cell, digit: 1 }] : [],
    eliminations: placement ? [] : [{ cell, digit: 1 }],
    units: [unit],
    pattern: [cell],
    support: [],
    digits: [1],
  }
}

function chosen(selected: number | null, ...steps: Step[]): Step {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of the rest parameter
  return steps.sort(byChoice(selected))[0]!
}

describe('byChoice', () => {
  it('puts a placement before an elimination', () => {
    const placement = fakeStep(80, true, 8)
    expect(chosen(0, fakeStep(0, false), placement)).toBe(placement)
  })

  it('puts a step in a unit of the selected cell before a nearer step outside', () => {
    const sameColumn = fakeStep(72, true, 8)
    expect(chosen(0, fakeStep(12, true, 1), sameColumn)).toBe(sameColumn)
  })

  it('then takes the nearer cell, then the unit, the cell and the digit', () => {
    expect(chosen(0, fakeStep(8, true, 0), fakeStep(1, true, 0)).pattern).toEqual([1])
    expect(chosen(null, fakeStep(5, true, 3), fakeStep(5, true, 1)).units).toEqual([1])
    expect(chosen(null, fakeStep(7, true, 0), fakeStep(3, true, 0)).pattern).toEqual([3])
  })
})
