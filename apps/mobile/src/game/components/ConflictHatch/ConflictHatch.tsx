import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { hatchLines } from '@/game/utils/hatch.utils'
import { styles } from './ConflictHatch.styles'

/**
 * The diagonal stripes of a conflict cell in the Colour look (ADR-026). It fills its parent, takes no touch and draws nothing
 * when the theme has no hatch. Only conflict cells render it, so the other cells read no theme hook (ADR-015).
 */
export function ConflictHatch() {
  const { theme } = useUnistyles()
  const hatch = theme.components.cell.conflictHatch
  const [size, setSize] = useState({ width: 0, height: 0 })
  const path = useMemo(() => {
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Path.Make is a factory, not a component
    const stripes = Skia.Path.Make()
    if (hatch === null || size.width === 0) return stripes
    for (const { x1, y1, x2, y2 } of hatchLines(size.width, size.height, hatch.pitch)) {
      stripes.moveTo(x1, y1)
      stripes.lineTo(x2, y2)
    }
    return stripes
  }, [hatch, size.width, size.height])
  if (hatch === null) return null
  // The size comes from a View: Skia's Canvas does not support onLayout on the new architecture.
  return (
    <View
      testID="conflict-hatch"
      pointerEvents="none"
      style={styles.canvas}
      onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
    >
      <Canvas style={{ width: size.width, height: size.height }}>
        <Path path={path} style="stroke" strokeWidth={hatch.width} color={hatch.color} opacity={hatch.opacity} />
      </Canvas>
    </View>
  )
}
