import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { stripeLefts } from '@/theme/decorations/geometry'
import { RULE, STRIPE, STRIPE_GAP } from './ProgressiveStripes.constants'

function addRect(path: ReturnType<typeof Skia.Path.Make>, x: number, y: number, width: number, height: number) {
  path
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineTo(x + width, y + height)
    .lineTo(x, y + height)
    .close()
}

function stripesPath(width: number, height: number) {
  const path = Skia.Path.Make()
  for (const left of stripeLefts(width, STRIPE, STRIPE_GAP)) addRect(path, left, 0, STRIPE, height)
  addRect(path, 0, height - RULE, width, RULE)
  return path
}

/** The Progressive panel edge: a band of vertical stripes on a rule, in the text colour. */
export function ProgressiveStripes() {
  const { theme } = useUnistyles()
  const { width } = useWindowDimensions()
  const height = theme.size.panelEdge
  const path = useMemo(() => stripesPath(width, height), [width, height])
  return (
    <Canvas testID="decoration-progressive-stripes" pointerEvents="none" style={{ width, height }}>
      <Path path={path} color={theme.colors.text} />
    </Canvas>
  )
}
