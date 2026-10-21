import { bitCount } from '../bits'
import type { Digit } from '../game/types'
import { PEERS, UNITS } from '../units'
import { eliminationStep } from './build'
import { bitOf, digitsOf, sortedUnique } from './masks'
import { placesOf, sharedUnit } from './sight'
import type { Candidates, CellDigit, ChainLink, Step } from './types'

/** A chain has at most this many cells, so the search stays fast. The X-chain and the XY-chain share the cap. */
const MAX_CHAIN_CELLS = 12
/** Chains of one link and two links are the pointing, the box-line reduction and the XY-wing. They have their own techniques. */
const MIN_LINKS = 3

/**
 * A search graph for one kind of chain. A state is a cell plus the way the chain leaves it.
 * `next` lists the states that follow a state, in ascending order, so every run finds the same chains.
 */
type Space = {
  size: number
  starts: readonly number[]
  next(state: number): readonly number[]
  cellOf(state: number): number
  isEnd(start: number, state: number): boolean
  /** Called once for each start, before `eliminations`. */
  begin(start: number): void
  /** The cells that lose the digit for a chain from the last `begin` start to `end`, chain cells not yet removed. */
  eliminations(end: number): readonly number[]
}

type Chain = { states: readonly number[]; cells: readonly number[]; eliminations: readonly number[] }

/**
 * Breadth-first search from every start. A start gives the chains of the first length that has an
 * elimination, one for each end cell. Only the chains of the shortest length over all starts stay.
 * The same two end cells give one chain, because the reverse chain has the same ends. A cell of the
 * chain keeps the digit. `bound` is the largest number of links that the search tries.
 */
function shortestChains(space: Space, bound: number): Chain[] {
  const seen = new Int32Array(space.size)
  const parent = new Int16Array(space.size)
  let shortest = bound
  let found: Chain[] = []
  for (const [index, start] of space.starts.entries()) {
    const stamp = index + 1
    seen[start] = stamp
    let frontier = [start]
    space.begin(start)
    for (let length = 1; length <= shortest && frontier.length > 0; length++) {
      const reached: number[] = []
      for (const current of frontier) {
        for (const state of space.next(current)) {
          if (seen[state] === stamp) continue
          seen[state] = stamp
          parent[state] = current
          reached.push(state)
        }
      }
      frontier = reached
      if (length < MIN_LINKS) continue
      const hits: Chain[] = []
      for (const end of reached) {
        if (!space.isEnd(start, end)) continue
        const candidates = space.eliminations(end)
        if (candidates.length === 0) continue
        const states = [end]
        while (states[0] !== start) states.unshift(parent[states[0]!]!)
        const cells = sortedUnique(states.map((state) => space.cellOf(state)))
        const eliminations = candidates.filter((cell) => !cells.includes(cell))
        if (eliminations.length > 0) hits.push({ states, cells, eliminations })
      }
      if (hits.length === 0) continue
      if (length < shortest) found = []
      shortest = length
      found.push(...hits)
      break
    }
  }
  const ends = new Set<number>()
  return found.filter(({ states }) => {
    const [a, b] = [space.cellOf(states[0]!), space.cellOf(states.at(-1)!)]
    const key = Math.min(a, b) * 81 + Math.max(a, b)
    if (ends.has(key)) return false
    ends.add(key)
    return true
  })
}

/** The unit of each link, in chain order, without repeats. The first strong link of an X-chain comes first. */
function unitsOf(links: readonly ChainLink[], unitOf: (link: ChainLink) => number): number[] {
  return [...new Set(links.map(unitOf))]
}

function eliminationsOf(cells: readonly number[], digit: Digit): CellDigit[] {
  return cells.map((cell) => ({ cell, digit }))
}

/**
 * The chain alternates a strong link and a weak link on one digit, and starts and ends with a strong
 * link. If the first cell is false, each link forces the next cell, so the last cell holds the digit.
 * One of the two ends holds it, so it leaves every cell that sees both ends. A state is `cell * 2`
 * before a strong link and `cell * 2 + 1` after it, which a weak link must follow. The units are the
 * units of the links, the first strong link first. The pattern is the chain cells.
 */
export function findXChains(candidates: Candidates, board: readonly number[]): Step[] {
  const groups: { digit: Digit; chains: Chain[] }[] = []
  let bound = MAX_CHAIN_CELLS - 1
  for (let digit = 1; digit <= 9; digit++) {
    const bit = bitOf(digit)
    const strong: number[][] = Array.from({ length: candidates.length }, () => [])
    for (const [unit] of UNITS.entries()) {
      const ends = placesOf(candidates, board, unit, digit)
      if (ends.length !== 2) continue
      strong[ends[0]!]!.push(ends[1]!)
      strong[ends[1]!]!.push(ends[0]!)
    }
    const weak: number[][] = Array.from({ length: candidates.length }, () => [])
    for (let cell = 0; cell < candidates.length; cell++) {
      if (candidates[cell]! & bit) weak[cell] = PEERS[cell]!.filter((peer) => candidates[peer]! & bit)
    }
    const afterStrong = strong.map((ends) => sortedUnique(ends).map((cell) => cell * 2 + 1))
    const afterWeak = weak.map((peers) => peers.map((cell) => cell * 2))
    const marked = new Uint8Array(candidates.length)
    const space: Space = {
      size: candidates.length * 2,
      starts: strong.flatMap((ends, cell) => (ends.length > 0 ? [cell * 2] : [])),
      next: (state) => (state % 2 === 0 ? afterStrong[state / 2]! : afterWeak[(state - 1) / 2]!),
      cellOf: (state) => Math.floor(state / 2),
      isEnd: (from, state) => state % 2 === 1 && Math.floor(state / 2) !== from / 2,
      begin: (from) => {
        marked.fill(0)
        for (const peer of weak[from / 2]!) marked[peer] = 1
      },
      eliminations: (end) => weak[Math.floor(end / 2)]!.filter((cell) => marked[cell] === 1),
    }
    const chains = shortestChains(space, bound)
    if (chains.length === 0) continue
    bound = chains[0]!.states.length - 1
    groups.push({ digit: digit as Digit, chains })
  }
  if (groups.length === 0) return []
  const shortest = Math.min(...groups.map(({ chains }) => chains[0]!.states.length))
  return groups.flatMap(({ digit, chains }) =>
    chains
      .filter(({ states }) => states.length === shortest)
      .map((chain) => {
        const links: ChainLink[] = chain.states.slice(0, -1).map((from, i) => ({
          from: Math.floor(from / 2),
          to: Math.floor(chain.states[i + 1]! / 2),
          digit,
          strong: from % 2 === 0,
        }))
        const units = unitsOf(links, (link) =>
          link.strong
            ? UNITS.findIndex((_, unit) => {
                const ends = placesOf(candidates, board, unit, digit)
                return ends.length === 2 && ends.includes(link.from) && ends.includes(link.to)
              })
            : sharedUnit(link.from, link.to)!,
        )
        return eliminationStep('xChain', units, chain.cells, [digit], eliminationsOf(chain.eliminations, digit), {
          links,
        })
      }),
  )
}

/**
 * A chain of cells with two digits each. Each cell sees the next one and shares the digit that links
 * them. If the first cell does not hold z, its other digit goes, and every cell then forces the next
 * one. The last cell then holds z. One of the two ends holds z, so z leaves every cell that sees
 * both ends. A state is `cell * 10 + digit`, where the digit is the one that leaves the cell towards
 * the next. The units join each cell to the next, the first link first. The pattern is the chain
 * cells. The digits are z first, then the other digits of the chain.
 */
export function findXyChains(candidates: Candidates, board: readonly number[]): Step[] {
  const bivalue: number[] = []
  for (let cell = 0; cell < candidates.length; cell++) {
    if (board[cell] === 0 && bitCount(candidates[cell]!) === 2) bivalue.push(cell)
  }
  if (bivalue.length < MIN_LINKS + 1) return []
  const isBivalue = new Uint8Array(candidates.length)
  for (const cell of bivalue) isBivalue[cell] = 1
  const otherDigit = (cell: number, digit: number): number => digitsOf(candidates[cell]! & ~bitOf(digit))[0]!
  const cache = new Map<number, readonly number[]>()
  const marked = new Uint8Array(candidates.length)
  let eliminated = 0
  const space: Space = {
    size: candidates.length * 10,
    starts: bivalue.flatMap((cell) => digitsOf(candidates[cell]!).map((digit) => cell * 10 + digit)),
    next: (state) => {
      let known = cache.get(state)
      if (known === undefined) {
        const cell = Math.floor(state / 10)
        const bit = bitOf(state % 10)
        known = PEERS[cell]!.filter((peer) => isBivalue[peer] === 1 && candidates[peer]! & bit).map(
          (peer) => peer * 10 + otherDigit(peer, state % 10),
        )
        cache.set(state, known)
      }
      return known
    },
    cellOf: (state) => Math.floor(state / 10),
    isEnd: (from, state) => Math.floor(state / 10) !== Math.floor(from / 10) && state % 10 === eliminated,
    begin: (from) => {
      marked.fill(0)
      const startCell = Math.floor(from / 10)
      eliminated = otherDigit(startCell, from % 10)
      for (const peer of PEERS[startCell]!) if (candidates[peer]! & bitOf(eliminated)) marked[peer] = 1
    },
    eliminations: (end) => {
      const cell = Math.floor(end / 10)
      return PEERS[cell]!.filter((peer) => marked[peer] === 1)
    },
  }
  const chains = shortestChains(space, MAX_CHAIN_CELLS - 1)
  return chains.map((chain) => {
    const digit = otherDigit(Math.floor(chain.states[0]! / 10), chain.states[0]! % 10) as Digit
    const links: ChainLink[] = chain.states.slice(0, -1).map((from, i) => ({
      from: Math.floor(from / 10),
      to: Math.floor(chain.states[i + 1]! / 10),
      digit: (from % 10) as Digit,
      strong: false,
    }))
    const mask = chain.cells.reduce((all, cell) => all | candidates[cell]!, 0)
    return eliminationStep(
      'xyChain',
      unitsOf(links, (link) => sharedUnit(link.from, link.to)!),
      chain.cells,
      [digit, ...digitsOf(mask).filter((other) => other !== digit)],
      eliminationsOf(chain.eliminations, digit),
      { links },
    )
  })
}
