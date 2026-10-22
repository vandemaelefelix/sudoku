import { describe, expect, it } from 'vitest'
import { valueAt } from '../game/completion'
import { createGame } from '../game/createGame'
import { solve } from '../solver'
import type { TechniqueId } from '../technique/types'
import { planHint } from './plan'
import { TECHNIQUE_PAGES, techniqueExample } from './pages'
import { HINT_TECHNIQUES } from './techniques'

const TECHNIQUES = Object.keys(HINT_TECHNIQUES) as TechniqueId[]

/** An easier step always comes first in their examples: they never started a hint plan in 1 800 generated puzzles. */
const RARE: ReadonlySet<TechniqueId> = new Set(['nakedQuad', 'hiddenQuad', 'jellyfish'])

it('has a page for every technique with hint text, and no other', () => {
  expect(new Set(Object.keys(TECHNIQUE_PAGES))).toEqual(new Set(TECHNIQUES))
})

describe.each(TECHNIQUES)('the page of %s', (technique) => {
  const page = TECHNIQUE_PAGES[technique]!

  it('shows a position of a puzzle with one solution', () => {
    const example = techniqueExample(technique)!
    const result = solve([...example.givens])
    expect(result).toEqual({ count: 1, solution: example.solution })
    if (result.count !== 1) return
    const placed = example.board.map((digit, cell) => (digit === 0 ? 0 : result.solution[cell]))
    expect(example.board).toEqual(placed)
    const kept = example.givens.map((given, cell) => (given === 0 ? 0 : example.board[cell]))
    expect(kept).toEqual(example.givens)
  })

  it('shows a step of its technique', () => {
    const { step } = techniqueExample(technique)!
    expect(step.technique).toBe(technique)
    expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
  })

  it.skipIf(RARE.has(technique))('starts the hint plan of its position', () => {
    const { givens, solution, board } = techniqueExample(technique)!
    const entries = board.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
    const game = createGame({ givens: [...givens], solution: [...solution], entries })
    expect(game.givens.map((_, cell) => valueAt(game, cell))).toEqual(board)
    const plan = planHint(game)
    expect(plan?.kind === 'steps' && plan.steps[0]?.technique).toBe(technique)
  })
})

it('gives no example for a technique without hint text', () => {
  expect(techniqueExample('xChain')).toBeNull()
})
