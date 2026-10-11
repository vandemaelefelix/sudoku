// Counts camera frames in windows of at least one second. Runs as a worklet on the camera thread.

/** detectionMs: the sum over the frames of the window. */
export type FrameWindow = { start: number; last: number; frames: number; detectionMs: number }

export const EMPTY_WINDOW: FrameWindow = { start: -1, last: -1, frames: 0, detectionMs: 0 }

/** The longest time in seconds between two frames inside one window. A longer gap means a pause. */
export const MAX_GAP = 0.5

/** detectionMs: the grid detection time of this frame. The report gives the mean of the window. */
export function countFrame(
  window: FrameWindow,
  timestamp: number,
  detectionMs: number,
): { window: FrameWindow; report: { fps: number; detectionMs: number } | null } {
  'worklet'
  if (window.start < 0 || timestamp < window.last || timestamp - window.last > MAX_GAP) {
    return { window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 }, report: null }
  }
  const frames = window.frames + 1
  const total = window.detectionMs + detectionMs
  const elapsed = timestamp - window.start
  if (elapsed >= 1) {
    return {
      window: { start: timestamp, last: timestamp, frames: 0, detectionMs: 0 },
      report: { fps: frames / elapsed, detectionMs: total / frames },
    }
  }
  return { window: { start: window.start, last: timestamp, frames, detectionMs: total }, report: null }
}
