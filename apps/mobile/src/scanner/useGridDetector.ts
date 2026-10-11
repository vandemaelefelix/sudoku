import { useEffect, useMemo } from 'react'
import type { Frame } from 'react-native-vision-camera'
import { useResizer } from 'react-native-vision-camera-resizer'
import { findGrid } from './findGrid'
import { type GridDetection, turnHalf } from './quad'

// 9:16 is the upright shape of the HD 16:9 frames that useFrameOutput delivers by default.
export const DETECT_WIDTH = 360
export const DETECT_HEIGHT = 640

/** A worklet for the frame processor. It does not dispose the Frame. The caller owns it. */
export type GridDetector = (frame: Frame) => GridDetection | null

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
    if (error != null) console.warn(`[scanner] the frame resizer failed: ${error.message}`)
  }, [error])

  return useMemo(() => {
    if (resizer == null) return undefined
    return (frame: Frame) => {
      'worklet'
      const resized = resizer.resize(frame)
      try {
        const grid = findGrid(new Uint8Array(resized.getPixelBuffer()), resized.width, resized.height)
        // The resizer 5.2.3 turns a 'left' or 'right' frame the wrong way, so its image is upside down.
        // Every portrait frame on the iPhone is 'left'. Turning the 4 corners back costs less than fixing pixels.
        if (grid == null || (frame.orientation !== 'left' && frame.orientation !== 'right')) return grid
        return { quad: turnHalf(grid.quad), score: grid.score }
      } finally {
        resized.dispose()
      }
    }
  }, [resizer])
}
