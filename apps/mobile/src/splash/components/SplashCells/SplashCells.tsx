import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  TileMode,
  createPicture,
  matchFont,
  type SkCanvas,
} from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import { DIGIT_ALPHA, DIGIT_SIZE, LINE_ALPHA, REVEAL_BAND, TINT_ALPHA } from '@/splash/constants/splash.constants'
import { glow, groundEdge, splashDigit, splashGrid } from '@/splash/utils/splash.utils'

type SplashCellsProps = {
  /** Milliseconds since the start of the exit. */
  exit: SharedValue<number>
  width: number
  height: number
  /** The colour of the ground, which the wave wipes away from the bottom up. */
  ground: string
  tint: string
  line: string
}

/** The ground, and the wave of cells: a tint, the two pale lines and, in some cells, a faint digit, in one picture that the UI thread redraws on each frame. */
export function SplashCells({ exit, width, height, ground, tint, line }: SplashCellsProps) {
  const grid = useMemo(() => splashGrid(width, height), [width, height])
  // A picture records a copy of a paint at each draw call, so one paint per layer is enough.
  const paints = useMemo(() => {
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Paint is a factory, not a component
    const fill = Skia.Paint()
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Color parses a colour, it is not a component
    fill.setColor(Skia.Color(tint))
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Paint is a factory, not a component
    const stroke = Skia.Paint()
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Color parses a colour, it is not a component
    stroke.setColor(Skia.Color(line))
    stroke.setStyle(PaintStyle.Stroke)
    stroke.setStrokeWidth(1)
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Paint is a factory, not a component
    const digit = Skia.Paint()
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Color parses a colour, it is not a component
    digit.setColor(Skia.Color(tint))
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Paint is a factory, not a component
    return { fill, stroke, digit, ground: Skia.Paint() }
  }, [tint, line])

  // The width of each digit, to centre it. A system font: Skia cannot read the fonts that expo-font loads.
  const digits = useMemo(() => {
    const font = matchFont({
      fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
      fontSize: grid.size * DIGIT_SIZE,
      fontWeight: 'bold',
    })
    return { font, widths: Array.from({ length: 10 }, (_, d) => font.measureText(String(d)).width) }
  }, [grid.size])

  // The same colour without alpha: a gradient from this to the ground fades to clear, not to black.
  const ground2 = useMemo(() => {
    // oxlint-disable-next-line react/capitalized-calls -- Skia.Color parses a colour, it is not a component
    return { solid: Skia.Color(ground), clear: Skia.Color(`${ground}00`) }
  }, [ground])

  const picture = useDerivedValue(() => {
    const ms = exit.get()
    return createPicture((canvas: SkCanvas) => {
      'worklet'
      // The edge of the ground rises with the wave. Below it the home shows. The gradient softens the edge.
      const edge = groundEdge(ms, height, grid.size)
      paints.ground.setShader(
        Skia.Shader.MakeLinearGradient(
          { x: 0, y: edge },
          { x: 0, y: edge + REVEAL_BAND },
          [ground2.solid, ground2.clear],
          null,
          TileMode.Clamp,
        ),
      )
      canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paints.ground)
      for (const { i, j, delayMs } of grid.cells) {
        const k = glow(ms - delayMs)
        if (k < 0.004) continue
        const x = width / 2 + (i - 0.5) * grid.size
        const y = height / 2 + (j - 0.5) * grid.size
        paints.fill.setAlphaf(TINT_ALPHA * k)
        canvas.drawRect(Skia.XYWHRect(x + 0.5, y + 0.5, grid.size - 1, grid.size - 1), paints.fill)
        paints.stroke.setAlphaf(LINE_ALPHA * k)
        canvas.drawLine(x, y, x + grid.size, y, paints.stroke)
        canvas.drawLine(x, y, x, y + grid.size, paints.stroke)
        const digit = splashDigit(i, j)
        if (digit == null) continue
        paints.digit.setAlphaf(DIGIT_ALPHA * k)
        const textX = x + (grid.size - (digits.widths[digit] ?? 0)) / 2
        canvas.drawText(
          String(digit),
          textX,
          y + grid.size / 2 + grid.size * DIGIT_SIZE * 0.35,
          paints.digit,
          digits.font,
        )
      }
    })
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
