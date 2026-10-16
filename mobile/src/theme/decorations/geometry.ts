export type Point = { x: number; y: number }

/** Points along a sine wave from x = -step to past width, one per step. y: the centre line, amp: the height, period: the wavelength. */
export function wavePoints(width: number, y: number, amp: number, period: number, step = 2): Point[] {
  const points: Point[] = []
  for (let x = -step; x <= width + step; x += step)
    points.push({ x, y: y - amp * Math.sin((2 * Math.PI * x) / period) })
  return points
}
