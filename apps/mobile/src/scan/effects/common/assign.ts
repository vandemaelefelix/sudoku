import type { Point } from '../../../scanner'

/** Candidate dots per target. Enough in practice; a full scan covers the rare target whose candidates are all taken. */
const CANDIDATES = 8

type Pair = { distance: number; dot: number; target: number }

function nearestFree(dots: Point[], taken: boolean[], target: Point): number {
  'worklet'
  let best = -1
  let bestDistance = Infinity
  for (let i = 0; i < dots.length; i++) {
    if (taken[i]) continue
    const d = (dots[i].x - target.x) ** 2 + (dots[i].y - target.y) ** 2
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
    const best: Pair[] = []
    for (let i = 0; i < dots.length; i++) {
      const distance = (dots[i].x - targets[j].x) ** 2 + (dots[i].y - targets[j].y) ** 2
      if (best.length === CANDIDATES && distance >= best[CANDIDATES - 1].distance) continue
      let k = best.length < CANDIDATES ? best.length : CANDIDATES - 1
      best[k] = { distance, dot: i, target: j }
      while (k > 0 && best[k - 1].distance > best[k].distance) {
        const swap = best[k - 1]
        best[k - 1] = best[k]
        best[k] = swap
        k--
      }
    }
    for (let k = 0; k < best.length; k++) pairs.push(best[k])
  }
  pairs.sort((a, b) => {
    'worklet'
    return a.distance - b.distance
  })
  const taken: boolean[] = []
  for (let i = 0; i < dots.length; i++) taken.push(false)
  const owner: number[] = []
  for (let j = 0; j < targets.length; j++) owner.push(-1)
  for (let k = 0; k < pairs.length; k++) {
    const pair = pairs[k]
    if (owner[pair.target] >= 0 || taken[pair.dot]) continue
    owner[pair.target] = pair.dot
    taken[pair.dot] = true
  }
  for (let j = 0; j < targets.length; j++) {
    if (owner[j] >= 0) continue
    const dot = nearestFree(dots, taken, targets[j])
    if (dot < 0) continue
    owner[j] = dot
    taken[dot] = true
  }
  return owner
}
