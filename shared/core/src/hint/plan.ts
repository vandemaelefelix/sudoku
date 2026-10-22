import { bitCount } from '../bits'
import { isWrong, valueAt } from '../game/completion'
import type { Digit, Game } from '../game/types'
import { computeCandidates } from '../technique/candidates'
import { bitOf } from '../technique/masks'
import { nextSteps } from '../technique/nextSteps'
import type { Candidates, Step, TechniqueRank } from '../technique/types'
import { BOX_OF, COL_OF, PEERS, ROW_OF, unitKindOf } from '../units'
import { HINT_ORDER } from './techniques'
import type { HintPlan } from './types'

/** ADR-032 point 4. */
export const MAX_HINT_STEPS = 6

/**
 * The ranks of `HINT_ORDER`, in groups of the same weight. A group counts as one rank for the step choice.
 * The tier 1 weights all differ, so each group holds one rank until tier 2 gets hint text.
 */
const HINT_GROUPS: readonly (readonly TechniqueRank[])[] = HINT_ORDER.reduce<TechniqueRank[][]>((groups, rank) => {
  const last = groups.at(-1)
  if (last !== undefined && last[0]!.weight === rank.weight) last.push(rank)
  else groups.push([rank])
  return groups
}, [])

/**
 * A game puzzle has exactly one solution, so the unique rectangle may run once it has hint text
 * (ADR-032, amendment). Tier 1 has no rank that needs it.
 */
const OPTIONS = { unique: true }

/**
 * How far `cell` is from the selected cell: 0 to 8 in the same row, column or box, else 20 to 36.
 * A smaller number is nearer.
 */
function distance(cell: number, selected: number | null): number {
  if (selected === null) return 0
  const grid = Math.abs(ROW_OF[cell]! - ROW_OF[selected]!) + Math.abs(COL_OF[cell]! - COL_OF[selected]!)
  const sameUnit =
    ROW_OF[cell] === ROW_OF[selected] || COL_OF[cell] === COL_OF[selected] || BOX_OF[cell] === BOX_OF[selected]
  return sameUnit ? grid : 20 + grid
}

function stepDistance(step: Step, selected: number | null): number {
  const cells = [...step.placements, ...step.eliminations].map((item) => item.cell).concat(step.pattern)
  return Math.min(...cells.map((cell) => distance(cell, selected)))
}

function firstDigit(step: Step): number {
  return (step.placements[0] ?? step.eliminations[0])!.digit
}

/** The step choice at one rank. Exported for its tests. */
export function byChoice(selected: number | null) {
  return (a: Step, b: Step): number =>
    Number(a.placements.length === 0) - Number(b.placements.length === 0) ||
    stepDistance(a, selected) - stepDistance(b, selected) ||
    a.units[0]! - b.units[0]! ||
    a.pattern[0]! - b.pattern[0]! ||
    firstDigit(a) - firstDigit(b)
}

/** Every step of the easiest group of hint techniques that applies. */
function easiestSteps(candidates: Candidates, board: readonly number[]): Step[] {
  for (const group of HINT_GROUPS) {
    const steps = group.flatMap((rank) => nextSteps(candidates, board, [rank], OPTIONS))
    if (steps.length > 0) return steps
  }
  return []
}

function rankOf(step: Step): TechniqueRank {
  const kind = unitKindOf(step.units[0]!)
  return HINT_ORDER.find(
    (rank) => rank.technique === step.technique && (rank.unitKinds === undefined || rank.unitKinds.includes(kind)),
  )!
}

function withoutEliminations(candidates: Candidates, step: Step): Candidates {
  const next = new Uint16Array(candidates)
  for (const { cell, digit } of step.eliminations) next[cell]! &= ~bitOf(digit)
  return next
}

/** True when each step, in order, is still a step of its technique once the steps before it apply. */
function replays(steps: readonly Step[], start: Candidates, board: readonly number[]): boolean {
  let candidates = start
  for (const step of steps) {
    const key = JSON.stringify(step)
    const found = nextSteps(candidates, board, [rankOf(step)], OPTIONS)
    if (!found.some((other) => JSON.stringify(other) === key)) return false
    candidates = withoutEliminations(candidates, step)
  }
  return true
}

/**
 * The greedy search can take an elimination that the placement does not need. Each step that the
 * rest of the plan can do without goes, so every elimination leads to the single (ADR-032 point 4).
 */
function pruned(steps: readonly Step[], start: Candidates, board: readonly number[]): readonly Step[] {
  let kept = steps
  for (let index = kept.length - 2; index >= 0; index--) {
    const without = kept.filter((_, other) => other !== index)
    if (replays(without, start, board)) kept = without
  }
  return kept
}

/**
 * The search may take more steps than a plan may hold, because pruning often shortens it. The
 * bound keeps the work small on a board that no hint technique solves.
 */
const SEARCH_STEPS = 4 * MAX_HINT_STEPS

/** At most `MAX_HINT_STEPS` steps that end at a placement, or null when no such plan comes. */
function search(start: Candidates, board: readonly number[], selected: number | null): readonly Step[] | null {
  const steps: Step[] = []
  let candidates = start
  while (steps.length < SEARCH_STEPS) {
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of easiestSteps
    const step = easiestSteps(candidates, board).sort(byChoice(selected))[0]
    if (step === undefined) return null
    steps.push(step)
    if (step.placements.length > 0) {
      const plan = pruned(steps, start, board)
      return plan.length <= MAX_HINT_STEPS ? plan : null
    }
    candidates = withoutEliminations(candidates, step)
  }
  return null
}

function nearestFirst(selected: number | null) {
  return (a: number, b: number): number => distance(a, selected) - distance(b, selected) || a - b
}

/** The empty cell with the fewest candidates, then the most filled peers, then the nearest, then the lowest index. */
function fallbackCell(candidates: Candidates, board: readonly number[], selected: number | null): number {
  const filledPeers = (cell: number): number => PEERS[cell]!.filter((peer) => board[peer] !== 0).length
  const empty = board.flatMap((value, cell) => (value === 0 ? [cell] : []))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of flatMap
  return empty.sort(
    (a, b) =>
      bitCount(candidates[a]!) - bitCount(candidates[b]!) ||
      filledPeers(b) - filledPeers(a) ||
      nearestFirst(selected)(a, b),
  )[0]!
}

/**
 * The plan of one hint for the board of `game`. Candidates come from the givens and the entries,
 * never from the notes (ADR-032 point 2). The plan changes nothing in the game.
 * Returns null when the grid has no empty cell and no wrong entry.
 */
export function planHint(game: Game): HintPlan | null {
  const board = game.givens.map((_, cell) => valueAt(game, cell))
  const selected = game.selected
  const wrong = board.flatMap((_, cell) => (isWrong(game, cell) ? [cell] : []))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array of flatMap
  if (wrong.length > 0) return { kind: 'mistake', cell: wrong.sort(nearestFirst(selected))[0]! }
  if (!board.includes(0)) return null
  const start = computeCandidates(board)
  const steps = search(start, board, selected)
  if (steps !== null) return { kind: 'steps', steps, answer: steps.at(-1)!.placements[0]! }
  const cell = fallbackCell(start, board, selected)
  // createGame checks that every solution value is 1 to 9.
  return { kind: 'fallback', answer: { cell, digit: game.solution[cell] as Digit } }
}
