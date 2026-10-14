import { Canvas, PaintStyle, Picture, Skia, createPicture, type SkCanvas } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import { LINE_ALPHA, TINT_ALPHA } from '@/splash/constants/splash.constants'
import { glow, splashGrid } from '@/splash/utils/splash.utils'

type SplashCellsProps = {
  /** Milliseconds since the start of the exit. */
  exit: SharedValue<number>
  width: number
  height: number
  tint: string
  line: string
}

/** The wave of cells: a tint and the two pale lines of each cell, in one picture that the UI thread redraws on each frame. */
export function SplashCells({ exit, width, height, tint, line }: SplashCellsProps) {
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
    return { fill, stroke }
  }, [tint, line])

  const picture = useDerivedValue(() => {
    const ms = exit.get()
    return createPicture((canvas: SkCanvas) => {
      'worklet'
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
      }
    })
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
