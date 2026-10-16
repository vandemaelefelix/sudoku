export type HatchLine = { x1: number; y1: number; x2: number; y2: number }

/**
 * The stripes of a hatch over a width × height box: lines at 45°, from the top edge down to the left. pitch is the distance
 * between two lines along the x axis. The lines run past the box, so the canvas that clips to the box shows no end of a line.
 */
export function hatchLines(width: number, height: number, pitch: number): HatchLine[] {
  const lines: HatchLine[] = []
  for (let c = 0; c <= width + height; c += pitch) lines.push({ x1: c, y1: 0, x2: c - height, y2: height })
  return lines
}
