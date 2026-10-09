// Counts camera frames in windows of at least one second. Runs as a worklet on the camera thread.

export type FrameWindow = { start: number; frames: number }

export const EMPTY_WINDOW: FrameWindow = { start: -1, frames: 0 }

export function countFrame(
  window: FrameWindow,
  timestamp: number,
): { window: FrameWindow; fps: number | null } {
  'worklet'
  if (window.start < 0 || timestamp < window.start) {
    return { window: { start: timestamp, frames: 0 }, fps: null }
  }
  const frames = window.frames + 1
  const elapsed = timestamp - window.start
  if (elapsed >= 1) {
    return { window: { start: timestamp, frames: 0 }, fps: frames / elapsed }
  }
  return { window: { start: window.start, frames }, fps: null }
}
