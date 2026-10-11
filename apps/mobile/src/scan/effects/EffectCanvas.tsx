import { Canvas, createPicture, Picture } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { type SharedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { Quad } from '../../scanner'
import { countFrame, EMPTY_WINDOW } from '../frameRate'
import type { ViewSize } from '../previewMapping'
import { advance, type Engine } from './engine'
import { DEFAULT_EFFECT, EFFECTS, effectAt } from './index'
import { makeDrawKit } from './kit'

function logOverlay(id: string, fps: number, overlayMs: number) {
  if (__DEV__) console.log(`[fx] ${id} ${fps.toFixed(1)} fps, overlay ${overlayMs.toFixed(2)} ms`)
}

/**
 * outline: the smoothed grid in view points, or null. view: the size of the camera view in points.
 * effect: an index into EFFECTS. Only the JS thread writes it, and only when the developer picks an effect.
 * frameQuad: the same grid, normalised to the upright frame. onLock: called once per scene, on the JS thread, with frameQuad at lock-on.
 */
export function EffectCanvas({
  outline,
  view,
  effect,
  frameQuad,
  onLock,
}: {
  outline: SharedValue<Quad | null>
  view: SharedValue<ViewSize>
  effect: SharedValue<number>
  frameQuad: SharedValue<Quad | null>
  onLock: (quad: Quad) => void
}) {
  // Reanimated reads the setting once at app start, so a change takes effect after a restart.
  const reduceMotion = useReducedMotion()
  // A release build runs only the default effect, so it compiles no other shader (ADR-014).
  const kit = useMemo(() => makeDrawKit(__DEV__ ? EFFECTS : [DEFAULT_EFFECT]), [])
  const empty = useMemo(
    () =>
      createPicture(() => {
        'worklet'
      }),
    [],
  )
  const engine = useSharedValue<Engine | null>(null)
  const picture = useSharedValue(empty)
  const timing = useSharedValue(EMPTY_WINDOW)

  useFrameCallback((frame) => {
    'worklet'
    const size = view.get()
    if (size.width <= 0 || size.height <= 0) return
    const t = frame.timestamp / 1000
    const started = Date.now()
    const index = effect.get()
    const active = effectAt(index)
    const quad = outline.get()
    engine.modify((current) => {
      'worklet'
      return advance(current, active, size, quad, t, reduceMotion)
    }, true)
    const now = engine.get()
    if (now == null) return
    // lockedAt equals t only in the frame of lock-on, so the quad crosses to the JS thread once.
    if (now.scene.lockedAt === t) {
      const locked = frameQuad.get()
      if (locked != null) scheduleOnRN(onLock, locked)
    }
    picture.set(
      createPicture((canvas) => {
        'worklet'
        active.draw(canvas, now.state, now.scene, kit)
      }),
    )
    if (__DEV__) {
      const result = countFrame(timing.get(), t, Date.now() - started)
      timing.set(result.window)
      if (result.report !== null) scheduleOnRN(logOverlay, active.id, result.report.fps, result.report.detectionMs)
    }
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
