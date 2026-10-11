import { Canvas, createPicture, Picture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import {
  type SharedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Quad } from '../../scanner'
import { countFrame, EMPTY_WINDOW } from '../frameRate'
import type { ViewSize } from '../previewMapping'
import { makeStarSprite } from '../effects/common/sprite'
import { drawField } from './draw'
import { createScene, type Scene, stepScene } from '../effects/scene'
import { createField, type FieldState, stepField } from './field'

function logOverlay(fps: number, overlayMs: number) {
  if (__DEV__) console.log(`[dots] ${fps.toFixed(1)} fps, overlay ${overlayMs.toFixed(2)} ms`)
}

/** outline: the smoothed grid in view points, or null. view: the size of the camera view in points. */
export function DotField({ outline, view }: { outline: SharedValue<Quad | null>; view: SharedValue<ViewSize> }) {
  // Reanimated reads the setting once at app start, so a change takes effect after a restart.
  const reduceMotion = useReducedMotion()
  // The sprite is made once on the JS thread. A Skia image is a host object, so the frame worklet can capture it.
  const sprite = useMemo(() => makeStarSprite(), [])
  const empty = useMemo(
    () =>
      createPicture(() => {
        'worklet'
      }),
    [],
  )
  const world = useSharedValue<{ scene: Scene; field: FieldState } | null>(null)
  const picture = useSharedValue(empty)
  const timing = useSharedValue(EMPTY_WINDOW)

  useFrameCallback((frame) => {
    'worklet'
    const size = view.value
    if (size.width <= 0 || size.height <= 0) return
    const t = frame.timestamp / 1000
    const started = Date.now()
    world.modify((current) => {
      'worklet'
      if (current == null || current.scene.width !== size.width || current.scene.height !== size.height) {
        const scene = stepScene(createScene(size), outline.value, t, reduceMotion)
        return { scene, field: stepField(createField(size), scene) }
      }
      stepScene(current.scene, outline.value, t, reduceMotion)
      stepField(current.field, current.scene)
      return current
    }, true)
    const now = world.get()
    if (now != null) {
      picture.set(
        createPicture((canvas) => {
          'worklet'
          drawField(canvas, now.field, now.scene, sprite)
        }),
      )
    }
    if (__DEV__) {
      const result = countFrame(timing.get(), t, Date.now() - started)
      timing.set(result.window)
      if (result.report !== null) scheduleOnRN(logOverlay, result.report.fps, result.report.detectionMs)
    }
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
