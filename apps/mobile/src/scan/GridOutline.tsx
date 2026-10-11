import { Canvas, Points } from '@shopify/react-native-skia'
import { StyleSheet } from 'react-native'
import { type SharedValue, useDerivedValue } from 'react-native-reanimated'
import type { Point, Quad } from '../scanner'

export const OUTLINE_COLOR = '#34C759'
export const OUTLINE_WIDTH = 4

export function outlinePoints(quad: Quad | null): Point[] {
  'worklet'
  return quad == null ? [] : [quad[0], quad[1], quad[2], quad[3], quad[0]]
}

/** outline: in view points. Skia reads it on the UI thread. */
export function GridOutline({ outline }: { outline: SharedValue<Quad | null> }) {
  const points = useDerivedValue(() => outlinePoints(outline.value))
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Points
        points={points}
        mode="polygon"
        color={OUTLINE_COLOR}
        style="stroke"
        strokeWidth={OUTLINE_WIDTH}
        strokeJoin="round"
      />
    </Canvas>
  )
}
