import {
  chooseGrid,
  firstFind,
  type GridChoice,
  LOSS_HOLD,
  MIN_AREA_SHARE,
  NO_CHOICE,
  SWITCH_DWELL,
  SWITCH_MARGIN,
} from './chooseGrid'
import { type GridDetection, quadArea } from './quad'
import type { Quad } from '@/utils/geometry.utils'

// An upright 9:16 frame. A share of the frame height is 16/9 of the same share of the frame width.
const ASPECT = 9 / 16
const FRAME = 1 / 30

/** A square grid of side `side` (share of the frame width) with its centre at (cx, cy), normalised to the frame. */
function grid(cx: number, cy: number, side = 0.5): GridDetection {
  const w = side / 2
  const h = (side * ASPECT) / 2
  const quad: Quad = [
    { x: cx - w, y: cy - h },
    { x: cx + w, y: cy - h },
    { x: cx + w, y: cy + h },
    { x: cx - w, y: cy + h },
  ]
  return { quad, score: quadArea(quad) }
}

function moved(found: GridDetection, dx: number, dy: number): GridDetection {
  const quad = found.quad.map((p) => ({ x: p.x + dx, y: p.y + dy })) as Quad
  return { quad, score: found.score }
}

function centreY(found: GridDetection | null): number {
  if (found == null) throw new Error('no grid')
  return found.quad.reduce((sum, p) => sum + p.y, 0) / 4
}

// Three stacked sudokus of one size, as on the page of the issue. The middle one is at the centre.
const TOP = grid(0.5, 0.2)
const MIDDLE = grid(0.5, 0.5)
const BOTTOM = grid(0.5, 0.8)

/** A fixed pseudo-noise of ±0.005 of the frame. */
function noise(i: number): number {
  return ((i * 7919) % 11) / 1000 - 0.005
}

/** Runs one frame per entry from t, and returns the choices. */
function run(frames: GridDetection[][], start: GridChoice = NO_CHOICE, t0 = 0) {
  let state = start
  return frames.map((grids, i) => {
    const step = chooseGrid(state, grids, t0 + i * FRAME, ASPECT)
    state = step.state
    return step
  })
}

describe('chooseGrid', () => {
  it('takes the grid nearest the centre at the first find, not the largest', () => {
    const [step] = run([[grid(0.5, 0.15, 0.6), MIDDLE]])
    expect(centreY(step!.grid)).toBeCloseTo(0.5)
    expect(step!.switched).toBe(false)
  })

  it('ignores a grid smaller than 60 % of the largest, also at the centre', () => {
    const small = grid(0.5, 0.5, 0.5 * Math.sqrt(MIN_AREA_SHARE) * 0.95)
    const [step] = run([[small, grid(0.5, 0.2)]])
    expect(centreY(step!.grid)).toBeCloseTo(0.2)
  })

  it('keeps one grid of three equal grids with noise', () => {
    const frames = Array.from({ length: 90 }, (_, i) => [
      moved(TOP, noise(i), noise(i + 1)),
      moved(MIDDLE, noise(i + 2), noise(i + 3)),
      moved(BOTTOM, noise(i + 4), noise(i + 5)),
    ])
    const steps = run(frames)
    for (const step of steps) expect(centreY(step.grid)).toBeCloseTo(0.5, 1)
    expect(steps.some((step) => step.switched)).toBe(false)
  })

  it('keeps the tracked grid when another grid is about as near the centre', () => {
    const [first] = run([[grid(0.5, 0.45)]])
    // A second grid appears just as near the centre, on the other side.
    const steps = run(
      Array.from({ length: 30 }, () => [grid(0.5, 0.45), grid(0.5, 0.55)]),
      first!.state,
      FRAME,
    )
    for (const step of steps) expect(centreY(step.grid)).toBeCloseTo(0.45)
  })

  it('switches to a grid that is nearer the centre by the margin, after SWITCH_DWELL', () => {
    const [first] = run([[TOP]])
    // The phone panned: the top grid is now high, and the middle grid sits at the centre.
    const far = moved(TOP, 0, -0.1)
    const frames = Array.from({ length: Math.ceil(SWITCH_DWELL / FRAME) + 2 }, () => [far, MIDDLE])
    const steps = run(frames, first!.state, FRAME)
    const switchAt = steps.findIndex((step) => step.switched)
    expect(switchAt).toBeGreaterThan(0)
    expect(switchAt * FRAME).toBeGreaterThanOrEqual(SWITCH_DWELL - 1e-9)
    for (const step of steps.slice(0, switchAt)) expect(centreY(step.grid)).toBeCloseTo(0.1)
    expect(centreY(steps[switchAt]!.grid)).toBeCloseTo(0.5)
    expect(steps.slice(switchAt + 1).every((step) => !step.switched)).toBe(true)
  })

  it('does not switch for a grid that is nearer the centre by less than the margin', () => {
    // Half the margin from the centre, in shares of the frame width.
    const tracked = grid(0.5, 0.5 - SWITCH_MARGIN * 0.5 * ASPECT)
    const [first] = run([[tracked]])
    const steps = run(
      Array.from({ length: 30 }, () => [tracked, grid(0.5, 0.5)]),
      first!.state,
      FRAME,
    )
    expect(steps.some((step) => step.switched)).toBe(false)
  })

  it('does not switch on a short wobble, and the dwell starts again after it', () => {
    const [first] = run([[TOP]])
    const far = moved(TOP, 0, -0.1)
    const wobble = Math.floor(SWITCH_DWELL / FRAME) - 2
    const frames = [
      ...Array.from({ length: wobble }, () => [far, MIDDLE]),
      // The phone swings back: the tracked grid is near the centre again.
      [TOP, BOTTOM],
      ...Array.from({ length: wobble }, () => [far, MIDDLE]),
    ]
    const steps = run(frames, first!.state, FRAME)
    expect(steps.some((step) => step.switched)).toBe(false)
  })

  it('gives no grid while the tracked grid is gone, for up to LOSS_HOLD, then makes a first find', () => {
    const [first] = run([[MIDDLE]])
    const holdFrames = Math.floor(LOSS_HOLD / FRAME)
    const steps = run([...Array.from({ length: holdFrames }, () => [TOP]), [TOP], [TOP]], first!.state, FRAME)
    for (const step of steps.slice(0, holdFrames)) expect(step.grid).toBeNull()
    const found = steps.find((step) => step.grid != null)
    expect(centreY(found!.grid)).toBeCloseTo(0.2)
    // A first find after a loss is no switch: the outline was already gone.
    expect(found!.switched).toBe(false)
  })

  it('gives no grid and keeps no track when the frame has none', () => {
    const [step] = run([[]])
    expect(step!.grid).toBeNull()
    expect(step!.state.tracked).toBeNull()
  })
})

describe('chooseGrid, edge cases', () => {
  it('starts the dwell again when another grid takes the place of the candidate', () => {
    const [first] = run([[TOP]])
    const far = moved(TOP, 0, -0.1)
    const half = Math.floor(SWITCH_DWELL / FRAME / 2) + 1
    // Two other grids take turns as the one nearest the centre, so no single candidate keeps the margin for SWITCH_DWELL.
    const left = grid(0.3, 0.5)
    const right = grid(0.7, 0.5)
    const steps = run(
      [...Array.from({ length: half }, () => [far, left]), ...Array.from({ length: half }, () => [far, right])],
      first!.state,
      FRAME,
    )
    expect(steps.some((step) => step.switched)).toBe(false)
  })

  it('drops the candidate when the tracked grid leaves the frame, and then makes a first find', () => {
    const [first] = run([[TOP]])
    const far = moved(TOP, 0, -0.1)
    const pending = run(
      Array.from({ length: 5 }, () => [far, MIDDLE]),
      first!.state,
      FRAME,
    )
    const last = pending.at(-1)!.state
    expect(last.candidate).not.toBeNull()
    const [gone] = run([[MIDDLE]], last, 6 * FRAME)
    expect(gone!.grid).toBeNull()
    expect(gone!.state.candidate).toBeNull()
  })

  it('keeps a tracked grid that a larger grid pushes below 60 %', () => {
    const [first] = run([[MIDDLE]])
    const large = grid(0.5, 0.15, 0.9)
    const steps = run(
      Array.from({ length: 30 }, () => [large, MIDDLE]),
      first!.state,
      FRAME,
    )
    for (const step of steps) expect(centreY(step.grid)).toBeCloseTo(0.5)
  })

  it('holds the tracked grid for exactly LOSS_HOLD', () => {
    const [first] = run([[MIDDLE]])
    const [atHold] = run([[TOP]], first!.state, LOSS_HOLD)
    expect(atHold!.grid).toBeNull()
    const [afterHold] = run([[TOP]], first!.state, LOSS_HOLD + 0.001)
    expect(centreY(afterHold!.grid)).toBeCloseTo(0.2)
  })

  it('makes a first find after a stall longer than LOSS_HOLD, also with the tracked grid in view', () => {
    const [first] = run([[TOP]])
    const [later] = run([[TOP, MIDDLE]], first!.state, LOSS_HOLD + 0.1)
    // The tracked grid has no claim after the hold. The grid nearest the centre wins.
    expect(centreY(later!.grid)).toBeCloseTo(0.5)
    expect(later!.switched).toBe(false)
  })
})

describe('firstFind', () => {
  it('takes the grid nearest the centre of the grids that pass the 60 % rule', () => {
    expect(centreY(firstFind([TOP, MIDDLE, BOTTOM], ASPECT))).toBeCloseTo(0.5)
  })

  it('gives null without a grid', () => {
    expect(firstFind([], ASPECT)).toBeNull()
  })
})
