import { useEffect, useMemo } from 'react'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { createSynchronizable } from 'react-native-worklets'
import { chooseGrid, NO_CHOICE } from './chooseGrid'
import { findGrids } from './findGrid'
import { type GridDetection, turnHalf } from './quad'
import { devWarn } from '@/utils/log.utils'

// 9:16 is the upright shape of the HD 16:9 frames that useFrameOutput delivers by default.
export const DETECT_WIDTH = 360
export const DETECT_HEIGHT = 640

/** The grid that the aiming rule chose in this frame. switched: the rule moved to another grid in this frame. */
export type TrackedGrid = GridDetection & { switched: boolean }

/**
 * A worklet for the frame processor. It does not dispose the Frame. The caller owns it. It keeps the state of the aiming rule
 * (chooseGrid) between frames, so it expects the frames in order.
 */
export type GridDetector = (frame: Frame) => TrackedGrid | null

/** Undefined while the frame resizer loads, and when it fails to load. */
export function useGridDetector(): GridDetector | undefined {
  // The resizer turns the frame on the GPU. 'stretch' keeps the whole frame, so 0..1 covers it all.
  const { resizer, error } = useResizer({
    width: DETECT_WIDTH,
    height: DETECT_HEIGHT,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'stretch',
    pixelLayout: 'interleaved',
  })

  useEffect(() => {
    if (error != null) devWarn('scanner', `the frame resizer failed: ${error.message}`)
  }, [error])

  return useMemo(() => {
    if (resizer == null) return undefined
    // The chooser state stays on the camera thread. No corner goes through the JS thread. A new detector starts a new track.
    const choice = createSynchronizable(NO_CHOICE)
    return (frame: Frame) => {
      'worklet'
      const resized = resizer.resize(frame)
      try {
        const found = findGrids(new Uint8Array(resized.getPixelBuffer()), resized.width, resized.height)
        // The resizer 5.2.3 turns a 'left' or 'right' frame the wrong way, so its image is upside down.
        // Every portrait frame on the iPhone is 'left'. Turning the 4 corners back costs less than fixing pixels.
        const sideways = frame.orientation === 'left' || frame.orientation === 'right'
        const grids = sideways ? found.map((grid) => ({ quad: turnHalf(grid.quad), score: grid.score })) : found
        const aspect = sideways ? frame.height / frame.width : frame.width / frame.height
        const chosen = chooseGrid(choice.getBlocking(), grids, frame.timestamp, aspect)
        choice.setBlocking(chosen.state)
        return chosen.grid == null
          ? null
          : { quad: chosen.grid.quad, score: chosen.grid.score, switched: chosen.switched }
      } finally {
        resized.dispose()
      }
    }
  }, [resizer])
}
