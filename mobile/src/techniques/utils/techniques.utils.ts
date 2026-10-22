import {
  computeCandidates,
  createGame,
  HINT_ORDER,
  HINT_TECHNIQUES,
  TECHNIQUE_LEVEL,
  TECHNIQUE_PAGES,
  type Digit,
  type Game,
  type TechniqueExample,
  type TechniqueId,
} from '@sudoku/core'
import { LEVEL_NAMES } from '@/constants/level.constants'

/** The techniques with a page, in hint order. The hidden single has two ranks and shows once. */
export function techniqueIds(): TechniqueId[] {
  return [...new Set(HINT_ORDER.map((rank) => rank.technique))].filter((id) => TECHNIQUE_PAGES[id] !== undefined)
}

/** A route param as the id of a technique with a page. Null for anything else. */
export function toTechniqueId(param: string | undefined): TechniqueId | null {
  return techniqueIds().find((id) => id === param) ?? null
}

export function levelLine(technique: TechniqueId): string {
  return `First seen in ${LEVEL_NAMES[TECHNIQUE_LEVEL[technique]]} puzzles.`
}

/** The digits of a candidate mask: bit d - 1 is set when d is a candidate. */
function digitsOf(mask: number): Digit[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).filter((digit) => (mask & (1 << (digit - 1))) !== 0)
}

/**
 * The example position as a game to draw. The pattern cells and the cells that lose a candidate show their candidates
 * as notes, because a struck candidate shows only on a note.
 */
export function exampleBoard({ givens, solution, board, step }: TechniqueExample): Game {
  const entries = board.map((digit, cell) => (givens[cell] === 0 ? digit : 0))
  const game = createGame({ givens: [...givens], solution: [...solution], entries })
  const candidates = computeCandidates([...board])
  const noted = new Set([...step.pattern, ...step.eliminations.map((item) => item.cell)])
  const notes = board.map((digit, cell) => (digit === 0 && noted.has(cell) ? digitsOf(candidates[cell] ?? 0) : []))
  return { ...game, notes }
}

/** What VoiceOver reads for the example board: the why and the answer of its step. */
export function exampleSpeech({ step }: TechniqueExample): string {
  const technique = HINT_TECHNIQUES[step.technique]
  if (technique === undefined) return ''
  return `${technique.why(step, false)} ${technique.answer(step)}`
}

/** The definitions of the hint text follow a name and a colon, so they start in lower case. */
export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
