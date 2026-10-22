import { Canvas, Path, Skia, type CanvasRef } from '@shopify/react-native-skia'
import { useMemo, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { wavePoints } from '@/theme/decorations/geometry'
import { useRedrawOnShow } from '@/theme/decorations/ScreenShow'
import {
  CARD_EDGE_HEIGHT,
  SECTION_RULE_HEIGHT,
  SECTION_RULE_LINES,
  SECTION_RULE_WIDTH,
  WAVE_PERIOD,
  WAVE_WIDTH,
  WAVES,
} from './OpartWaves.constants'

function wavesPath(width: number, lines: number) {
  const path = Skia.Path.Make()
  for (const wave of WAVES.slice(0, lines)) {
    wavePoints(width, wave.y, wave.amp, WAVE_PERIOD).forEach((point, i) =>
      i === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y),
    )
  }
  return path
}

function Waves({
  testID,
  width,
  height,
  color,
  lines = WAVES.length,
}: {
  testID: string
  width: number
  height: number
  color: string
  lines?: number
}) {
  const path = useMemo(() => wavesPath(width, lines), [width, lines])
  const canvas = useRef<CanvasRef>(null)
  // A theme switch under another screen draws the new colour off the window,
  // so the screen shows the old frame without this.
  useRedrawOnShow(canvas)
  return (
    <Canvas ref={canvas} testID={testID} pointerEvents="none" style={{ width, height }}>
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

/** The Op-art stats card edge: the same 4 lines across the content column, inside the border of the card. */
export function OpartSummaryWaves() {
  const { theme } = useUnistyles()
  const { width } = useWindowDimensions()
  const { border, borderWidth } = theme.components.summary
  return (
    <Waves
      testID="decoration-opart-summary-waves"
      width={width - 2 * theme.space.lg - 2 * borderWidth}
      height={theme.size.panelEdge}
      color={border}
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

/** The short wavy rule under a section heading: 2 of the 4 lines, in the strong line colour (ADR-026). */
export function OpartSectionRule() {
  const { theme } = useUnistyles()
  return (
    <Waves
      testID="decoration-opart-section-rule"
      width={SECTION_RULE_WIDTH}
      height={SECTION_RULE_HEIGHT}
      color={theme.colors.lineStrong}
      lines={SECTION_RULE_LINES}
    />
  )
}
