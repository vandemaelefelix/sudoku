import { describe, expect, it } from 'vitest'
import { generateWithTarget, LEVELS } from '../generator'
import { createRandom } from '../random'
import { TECHNIQUE_ORDER } from '../technique/order'
import { playThrough } from '../technique/playThrough'
import type { TechniqueId } from '../technique/types'
import { choiceOf, EASY_MIN_CHOICE, grade } from './grade'
import { TECHNIQUE_LEVEL } from './levels'
import { TRANSFORM_KINDS, transformGrid } from './symmetry'

const parse = (puzzle: string): number[] => [...puzzle].map(Number)
const isSingle = (hardest: TechniqueId | null) => hardest === null || TECHNIQUE_LEVEL[hardest] === 'easy'
const levelIndex = (id: TechniqueId) => LEVELS.indexOf(TECHNIQUE_LEVEL[id])

describe('choiceOf', () => {
  const { solution } = generateWithTarget(40, 1)

  it('counts a round as one move per cell, with the size of the round as value', () => {
    const grid = [...solution]
    grid[0] = 0
    grid[80] = 0
    // One round of two cells: two moves with the value 2.
    expect(choiceOf(grid)).toBe(2)
  })

  it('counts the cells of a round once, however many singles fill them', () => {
    const grid = [...solution]
    for (let column = 0; column < 9; column++) grid[column] = 0
    // Each cell of the row is a naked single and a hidden single. One round of 9 cells.
    expect(choiceOf(grid)).toBe(9)
  })

  it('is 0 for a solved grid', () => {
    expect(choiceOf(solution)).toBe(0)
  })

  it('counts at most 25 moves, also inside a round', () => {
    // 40 givens, seed 10. The first round fills 30 cells. The choice counts 25 of its moves, so it is 30.
    const puzzle = parse('405030087090700002000095104170600040034008095659300800310500029082017530006020700')
    expect(choiceOf(puzzle)).toBe(30)
  })
})

describe('grade of pinned puzzles', () => {
  // Each puzzle comes from generateWithTarget (the set and the seed are in the label). The numbers
  // come from this code. docs/research/2026-10-21-technique-grading.md measures the same grade.
  const pinned = [
    {
      label: 'easy: 40 givens, seed 0',
      puzzle: '645700800000580400080946705754030029120407080000000074492008000308624050010079000',
      expected: { level: 'easy', hardest: 'hiddenSingle', score: 45.2, choice: 19.56, steps: 41 },
    },
    {
      label: 'medium by choice: singles only, 34 givens, seed 0',
      puzzle: '645000800000580400080906705754030029120400000000000004490008000308624050010079000',
      expected: { level: 'medium', hardest: 'hiddenSingle', score: 52.2, choice: 13, steps: 47 },
    },
    {
      label: 'medium: pointing, 29 givens, seed 20',
      puzzle: '804060700306900408279005600042690000000100000030000901607500030000012000020000000',
      expected: { level: 'medium', hardest: 'pointing', score: 65.5, choice: 4.4, steps: 54 },
    },
    {
      label: 'medium: naked pair, 29 givens, seed 201',
      puzzle: '006010000009705001000926008007200000050000609001503004075132080000000000300890500',
      expected: { level: 'medium', hardest: 'nakedPair', score: 70.6, choice: 3.6, steps: 55 },
    },
    {
      label: 'hard: XY-wing, 29 givens, seed 27',
      puzzle: '680000000004000070009000015090326000010070068002004700940600103000000904800209600',
      expected: { level: 'hard', hardest: 'xyWing', score: 67.3, choice: 13, steps: 54 },
    },
    {
      label: 'hard: skyscraper, 29 givens, seed 22',
      puzzle: '100002060500009703780003200006050080470080000000201406000940030000000605000037800',
      expected: { level: 'hard', hardest: 'skyscraper', score: 64.8, choice: 10.12, steps: 54 },
    },
    {
      label: 'hard: X-wing, 25 givens, seed 1108',
      puzzle: '040307000000054200280000034030160000050093000000000098800000000006030070009005060',
      expected: { level: 'hard', hardest: 'xWing', score: 90.9, choice: 3.32, steps: 64 },
    },
    {
      label: 'expert: XY-chain, 29 givens, seed 3',
      puzzle: '008090100000008327200030000000010006019065008000000970806021090002083000900070002',
      expected: { level: 'expert', hardest: 'xyChain', score: 84, choice: 3.6, steps: 57 },
    },
    {
      label: 'expert: unique rectangle, 25 givens, seed 3',
      puzzle: '008090100000000327200030000000010006019065008000000970806020090002083000900000000',
      expected: { level: 'expert', hardest: 'uniqueRectangle', score: 105.9, choice: 2.52, steps: 69 },
    },
    {
      label: 'beyond: stalls after 17 steps, 29 givens, seed 48',
      puzzle: '005068000086002305000001078000000002030080560600030000001003409208010000390850000',
      expected: { level: 'beyond', hardest: 'pointing', score: 25.2, choice: 6.88, steps: 17 },
    },
  ] as const

  it.each(pinned)('$label', ({ puzzle, expected }) => {
    const { choice, ...rest } = grade(parse(puzzle))
    const { choice: expectedChoice, ...expectedRest } = expected
    expect(rest).toEqual(expectedRest)
    expect(choice).toBeCloseTo(expectedChoice, 2)
  })

  it('moves a singles-only puzzle below EASY_MIN_CHOICE to medium', () => {
    expect(grade(parse(pinned[1].puzzle)).choice).toBeLessThan(EASY_MIN_CHOICE)
    expect(grade(parse(pinned[0].puzzle)).choice).toBeGreaterThanOrEqual(EASY_MIN_CHOICE)
  })

  it('grades a puzzle by the easiest level that solves it, not by the hint order', () => {
    // 25 givens, seed 134. In TECHNIQUE_ORDER the X-wing comes before the hidden pair, so a solve in
    // that order uses a hard technique. Medium techniques solve the puzzle.
    const puzzle = parse('035100074000800016000300050100620040009000000000000500960470000420060097000000000')
    const hintOrder = playThrough(puzzle, TECHNIQUE_ORDER, { unique: true })
    expect(hintOrder.solved).toBe(true)
    expect(Math.max(...hintOrder.steps.map((step) => levelIndex(step.technique)))).toBeGreaterThan(1)
    expect(grade(puzzle)).toMatchObject({ level: 'medium', hardest: 'hiddenPair' })
  })

  it('rejects a grid that is not 81 digits', () => {
    expect(() => grade([1, 2, 3])).toThrow(RangeError)
  })
})

describe('grade under a symmetry transform', () => {
  const random = createRandom(11)
  const puzzles = [40, 34, 29, 25].flatMap((target) =>
    Array.from({ length: 60 }, (_, seed) => generateWithTarget(target, seed).givens),
  )

  it('contains singles-only puzzles near the easy threshold', () => {
    const near = puzzles.filter((givens) => {
      const { hardest, choice } = grade(givens)
      return isSingle(hardest) && Math.abs(choice - EASY_MIN_CHOICE) <= 3
    })
    expect(near.length).toBeGreaterThanOrEqual(5)
  })

  // The choice counts in rounds, so a puzzle that needs only singles keeps its choice, and with it
  // its level, whatever the scan order.
  it.each([...TRANSFORM_KINDS, 'all'] as const)(
    'keeps the level, the hardest level and the choice of singles: %s',
    (kind) => {
      const drifts: number[] = []
      for (const givens of puzzles) {
        const before = grade(givens)
        const moved =
          kind === 'all'
            ? TRANSFORM_KINDS.reduce((grid, each) => transformGrid(grid, each, random), [...givens])
            : transformGrid(givens, kind, random)
        const after = grade(moved)
        expect(after.level).toBe(before.level)
        expect(after.hardest === null ? null : TECHNIQUE_LEVEL[after.hardest]).toBe(
          before.hardest === null ? null : TECHNIQUE_LEVEL[before.hardest],
        )
        if (isSingle(before.hardest)) {
          drifts.push(Math.abs(after.choice - before.choice))
        }
      }
      expect(drifts.length).toBeGreaterThan(100)
      expect(Math.max(...drifts)).toBeCloseTo(0, 9)
    },
  )
})

describe('grade time', () => {
  it('stays below 100 ms for the slowest of 100 puzzles with 25 givens', async ({ annotate }) => {
    grade(generateWithTarget(25, 1000).givens)
    let slowest = 0
    for (let seed = 0; seed < 100; seed++) {
      const { givens } = generateWithTarget(25, seed)
      const start = performance.now()
      grade(givens)
      slowest = Math.max(slowest, performance.now() - start)
    }
    await annotate(`slowest of 100: ${slowest.toFixed(1)} ms (limit 100 ms)`, 'grade time')
    // docs/research/2026-10-21-technique-grading.md: about 10 ms at most on a Mac. The margin is for slow CI machines.
    expect(slowest).toBeLessThan(100)
  }, 60_000)
})
