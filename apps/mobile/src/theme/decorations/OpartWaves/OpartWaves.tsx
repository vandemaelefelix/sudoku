import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { wavePoints } from '@/theme/decorations/geometry'
import { CARD_EDGE_HEIGHT, WAVE_PERIOD, WAVE_WIDTH, WAVES } from './OpartWaves.constants'

function wavesPath(width: number) {
  const path = Skia.Path.Make()
  for (const wave of WAVES) {
    wavePoints(width, wave.y, wave.amp, WAVE_PERIOD).forEach((point, i) =>
      i === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y),
    )
  }
  return path
}

function Waves({ testID, width, height, color }: { testID: string; width: number; height: number; color: string }) {
  const path = useMemo(() => wavesPath(width), [width])
  return (
    <Canvas testID={testID} pointerEvents="none" style={{ width, height }}>
      <Path path={path} style="stroke" strokeWidth={WAVE_WIDTH} strokeCap="round" color={color} />
    </Canvas>
  )
}

/** The Op-art panel edge: 4 wavy parallel lines in the strong line colour. */
export function OpartWaves() {
  const { theme } = useUnistyles()
  const { width } = useWindowDimensions()
  return (
    <Waves
      testID="decoration-opart-waves"
      width={width}
      height={theme.size.panelEdge}
      color={theme.colors.lineStrong}
    />
  )
}

/** The Op-art finish card edge: the same 4 lines across the card, in the card text colour. */
export function OpartCardWaves() {
  const { theme } = useUnistyles()
  return (
    <Waves
      testID="decoration-opart-card-waves"
      width={theme.size.card.width}
      height={CARD_EDGE_HEIGHT}
      color={theme.components.finishCard.text}
    />
  )
}
