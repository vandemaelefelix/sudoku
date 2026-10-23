import type { Corners } from '../../api/types'

export const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left']

/** A first outline when the detection found none: the middle 80 % of the photo. */
export function inset(width: number, height: number): Corners {
  const [x0, y0, x1, y1] = [width * 0.1, height * 0.1, width * 0.9, height * 0.9]
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

/** The same quadrilateral, turned a quarter: the digits stand upright after a sideways cut. */
export const turn = (c: Corners): Corners => [c[3], c[0], c[1], c[2]]

/** The corners with one decimal, as the server stores them. */
export const roundCorners = (c: Corners): Corners =>
  c.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) as Corners

/** Move one corner to `at`. The corner stays inside the photo. */
export function moveCorner(
  corners: Corners,
  index: number,
  at: [number, number],
  width: number,
  height: number,
): Corners {
  const clamped: [number, number] = [Math.min(Math.max(at[0], 0), width), Math.min(Math.max(at[1], 0), height)]
  return corners.map((c, n) => (n === index ? clamped : c)) as Corners
}
