import {
  Canvas,
  FillType,
  Picture,
  Skia,
  createPicture,
  type SkCanvas,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { type SharedValue, useDerivedValue } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import type { Theme } from '@/theme/theme.types'
import { drawGridLines } from '@/scan/utils/correction.utils'
import { type CaptureFrame, insetUnit, photoMatrix } from '@/scan/utils/transition.utils'
import type { Quad, ViewSize } from '@/utils/geometry.utils'
import { unitToQuad } from '@/utils/homography.utils'
import { LINE_INSET } from './TransitionCanvas.constants'

function addQuad(path: SkPath, quad: Quad): SkPath {
  'worklet'
  return path
    .moveTo(quad[0].x, quad[0].y)
    .lineTo(quad[1].x, quad[1].y)
    .lineTo(quad[2].x, quad[2].y)
    .lineTo(quad[3].x, quad[3].y)
    .close()
}

/** Runs on the JS thread. A picture records a copy of a paint at each draw call, so one paint per layer is enough. */
function makePaints(theme: Theme) {
  const photo = Skia.Paint()
  const background = Skia.Paint()
  background.setColor(Skia.Color(theme.colors.background))
  const cells = Skia.Paint()
  cells.setColor(Skia.Color(theme.components.cell.fill))
  const lines = Skia.Paint()
  lines.setAntiAlias(true)
  const layer = Skia.Paint()
  return { photo, background, cells, lines, layer }
}

/**
 * The layers under the dots: the photo, the background and the cell area with its grid lines, in the colours of the theme.
 * image: the upright photo, or null. The owner sets it to null on the UI thread before it disposes the image. locked: the grid at lock-on, normalised to the upright frame, or null.
 * crossFade: no warp; the photo stays in place under the preview cover mapping and every layer fades (Reduce Motion).
 * side: the side of the grid square of the correction screen, in points.
 */
export function TransitionCanvas({
  capture,
  view,
  image,
  locked,
  crossFade,
  side,
}: {
  capture: SharedValue<CaptureFrame | null>
  view: SharedValue<ViewSize>
  image: SharedValue<SkImage | null>
  locked: Quad | null
  crossFade: boolean
  side: number
}) {
  const { theme } = useUnistyles()
  // New paints and line colours on a theme change remake the derived picture (ADR-015, point 10).
  const paints = useMemo(() => makePaints(theme), [theme])
  const { boxLine, cellLine } = theme.components.grid

  const picture = useDerivedValue(() => {
    const frame = capture.value
    const size = view.value
    const shown = image.value
    return createPicture((canvas: SkCanvas) => {
      'worklet'
      if (frame == null) return
      const { quad, grid, channels } = frame
      if (shown != null && channels.photo > 0) {
        paints.photo.setAlphaf(channels.photo)
        const width = shown.width()
        const height = shown.height()
        if (crossFade || locked == null) {
          // The preview cover mapping (previewMapping.ts): the photo has the field of view of the frames.
          const scale = Math.max(size.width / width, size.height / height)
          const dest = Skia.XYWHRect(
            (size.width - width * scale) / 2,
            (size.height - height * scale) / 2,
            width * scale,
            height * scale,
          )
          canvas.drawImageRect(shown, Skia.XYWHRect(0, 0, width, height), dest, paints.photo)
        } else {
          const matrix = photoMatrix(width, height, locked, quad)
          if (matrix != null) {
            canvas.save()
            canvas.concat(matrix)
            canvas.drawImage(shown, 0, 0, paints.photo)
            canvas.restore()
          }
        }
      }
      if (channels.dim > 0) {
        // The warp keeps a hole for the grid, so only the grid of the photo shows on the background.
        const path = Skia.Path.Make()
          .moveTo(0, 0)
          .lineTo(size.width, 0)
          .lineTo(size.width, size.height)
          .lineTo(0, size.height)
          .close()
        if (!crossFade) addQuad(path, grid).setFillType(FillType.EvenOdd)
        paints.background.setAlphaf(channels.dim)
        canvas.drawPath(path, paints.background)
      }
      if (channels.cells > 0) {
        paints.cells.setAlphaf(channels.cells)
        canvas.drawPath(addQuad(Skia.Path.Make(), grid), paints.cells)
      }
      const m = unitToQuad(grid)
      if (m == null || channels.lines <= 0) return
      const lines = insetUnit(m, LINE_INSET, side)
      if (crossFade) {
        paints.layer.setAlphaf(channels.lines)
        canvas.saveLayer(paints.layer)
        drawGridLines(canvas, paints.lines, lines, 1, boxLine, cellLine)
        canvas.restore()
      } else {
        drawGridLines(canvas, paints.lines, lines, channels.lines, boxLine, cellLine)
      }
    })
  })

  return (
    <Canvas testID="transition-canvas" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  )
}
