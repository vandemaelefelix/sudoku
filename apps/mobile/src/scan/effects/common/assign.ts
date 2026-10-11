import type { Point } from '@/utils/geometry.utils'

/** Candidate dots per target. Enough in practice; a full scan covers the rare target whose candidates are all taken. */
const CANDIDATES = 8

type Pair = { distance: number; dot: number; target: number }

function nearestFree(dots: Point[], taken: boolean[], target: Point): number {
  'worklet'
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]
    if (dot === undefined) continue
    if (taken[i]) continue
    const d = (dot.x - target.x) ** 2 + (dot.y - target.y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return best
}

/** Greedy: the shortest dot-to-target pair first. Returns the dot of each target, or -1 when no dot is left. */
export function assignNearest(dots: Point[], targets: Point[]): number[] {
  'worklet'
  const pairs: Pair[] = []
  for (let j = 0; j < targets.length; j++) {
    const target = targets[j]
    if (target === undefined) continue
    const best: Pair[] = []
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]
      if (dot === undefined) continue
      const distance = (dot.x - target.x) ** 2 + (dot.y - target.y) ** 2
      const worst = best[CANDIDATES - 1]
      if (worst !== undefined && distance >= worst.distance) continue
      const pair: Pair = { distance, dot: i, target: j }
      let k = best.length < CANDIDATES ? best.length : CANDIDATES - 1
      let previous = best[k - 1]
      while (previous !== undefined && previous.distance > distance) {
        best[k] = previous
        k--
        previous = best[k - 1]
      }
      best[k] = pair
    }
    for (const pair of best) pairs.push(pair)
  }
  pairs.sort((a, b) => {
    'worklet'
    return a.distance - b.distance
  })
  const taken: boolean[] = []
  for (let i = 0; i < dots.length; i++) taken.push(false)
  const owner: number[] = []
  for (let j = 0; j < targets.length; j++) owner.push(-1)
  for (const pair of pairs) {
    if ((owner[pair.target] ?? -1) >= 0 || taken[pair.dot]) continue
    owner[pair.target] = pair.dot
    taken[pair.dot] = true
  }
  for (let j = 0; j < targets.length; j++) {
    const target = targets[j]
    if (target === undefined) continue
    if ((owner[j] ?? -1) >= 0) continue
    const dot = nearestFree(dots, taken, target)
    if (dot < 0) continue
    owner[j] = dot
    taken[dot] = true
  }
  return owner
}
