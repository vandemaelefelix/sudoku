import { Canvas, Circle, Image as SkiaImage, Line, Rect as SkiaRect, useImage, vec } from '@shopify/react-native-skia'
import { Text } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import { FLAT_SIDE } from '@/scan/utils/flatImage.utils'
import { cornerLabel, fitRect, MODEL_CROP, projectGrid, quadInRect } from '@/scan/utils/inspector.utils'
import type { Quad, Rect } from '@/utils/geometry.utils'
import { BAR_HEIGHT, DOT_RADIUS, EDGE_WIDTH, LINE_WIDTH } from './ScanInspector.constants'
import { styles } from './ScanInspector.styles'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { cellRect } from '@/utils/grid.utils'

function fileUri(path: string | undefined): string | null {
  return path == null ? null : `file://${path.replace(/^file:\/\//, '')}`
}

/** threshold: the ring threshold. A cell below it shows its bar in the warning colour on the Cells tab. */
type Props = { view: InspectorView; result: CaptureOk; region: Rect; threshold: number }

/** Development view of a scan: what the detection found, how the grid is cut and what the model read. Draws inside `region`. */
export function ScanInspector({ view, result, region, threshold }: Props) {
  const { theme } = useUnistyles()
  const local: Rect = { x: 0, y: 0, width: region.width, height: region.height }
  const photo = useImage(fileUri(result.photoPath))
  const flatFile = useImage(result.flatImage == null && view !== 'photo' ? fileUri(result.flatPath) : null)
  const flat = result.flatImage ?? flatFile

  const canvasStyle = [styles.canvas, { left: region.x, top: region.y, width: region.width, height: region.height }]

  if (view === 'cells') {
    const box = fitRect(FLAT_SIDE, FLAT_SIDE, local)
    const cell = box.width / 9
    return (
      <Canvas testID="inspector-cells" style={canvasStyle}>
        {flat && <SkiaImage image={flat} x={box.x} y={box.y} width={box.width} height={box.height} fit="fill" />}
        {result.cells.map((read, n) => {
          const { left, top } = cellRect(box, cell, n)
          return (
            <SkiaRect
              // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
              key={n}
              x={left}
              y={top + cell - BAR_HEIGHT}
              width={cell * read.confidence}
              height={BAR_HEIGHT}
              color={read.confidence < threshold ? theme.colors.warning : theme.colors.accent}
            />
          )
        })}
      </Canvas>
    )
  }

  if (view === 'cutout') {
    const box = fitRect(FLAT_SIDE, FLAT_SIDE, local)
    const cell = box.width / 9
    const inner = (cell * MODEL_CROP.size) / MODEL_CROP.cell
    const margin = (cell * MODEL_CROP.start) / MODEL_CROP.cell
    return (
      <Canvas testID="inspector-cutout" style={canvasStyle}>
        {flat && <SkiaImage image={flat} x={box.x} y={box.y} width={box.width} height={box.height} fit="fill" />}
        {Array.from({ length: 81 }, (_, n) => {
          const { left, top } = cellRect(box, cell, n)
          return (
            <SkiaRect
              // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
              key={n}
              x={left + margin}
              y={top + margin}
              width={inner}
              height={inner}
              style="stroke"
              strokeWidth={1}
              color={theme.colors.warningText}
            />
          )
        })}
        {Array.from({ length: 10 }, (_, i) => (
          <Line
            key={`v${i}`}
            p1={vec(box.x + i * cell, box.y)}
            p2={vec(box.x + i * cell, box.y + box.width)}
            color={theme.colors.accent}
            strokeWidth={i % 3 === 0 ? EDGE_WIDTH : LINE_WIDTH}
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <Line
            key={`h${i}`}
            p1={vec(box.x, box.y + i * cell)}
            p2={vec(box.x + box.width, box.y + i * cell)}
            color={theme.colors.accent}
            strokeWidth={i % 3 === 0 ? EDGE_WIDTH : LINE_WIDTH}
          />
        ))}
      </Canvas>
    )
  }

  if (photo == null) return <Text style={[styles.note, { left: region.x, top: region.y }]}>Loading the photo…</Text>
  const box = fitRect(photo.width(), photo.height(), local)
  const quad: Quad = quadInRect(result.quad, box)
  const grid = view === 'overlay' ? projectGrid(quad) : null
  const edges = [0, 1, 2, 3].map((i) => ({ from: quad[i]!, to: quad[(i + 1) % 4]! }))
  const cellHeight = grid ? Math.abs((grid.centres[9]?.y ?? 0) - (grid.centres[0]?.y ?? 0)) : 0
  return (
    <>
      <Canvas testID={`inspector-${view}`} style={canvasStyle}>
        <SkiaImage image={photo} x={box.x} y={box.y} width={box.width} height={box.height} fit="fill" />
        {grid?.lines.map((line) => (
          <Line
            key={`${line.from.x},${line.from.y},${line.to.x},${line.to.y}`}
            p1={vec(line.from.x, line.from.y)}
            p2={vec(line.to.x, line.to.y)}
            color={theme.colors.accent}
            strokeWidth={LINE_WIDTH}
          />
        ))}
        {edges.map((edge) => (
          <Line
            key={`${edge.from.x},${edge.from.y}`}
            p1={vec(edge.from.x, edge.from.y)}
            p2={vec(edge.to.x, edge.to.y)}
            color={theme.colors.danger}
            strokeWidth={EDGE_WIDTH}
          />
        ))}
        {quad.map((point) => (
          <Circle key={`${point.x},${point.y}`} cx={point.x} cy={point.y} r={DOT_RADIUS} color={theme.colors.danger} />
        ))}
      </Canvas>
      <Text testID="inspector-corners" style={[styles.badge, { left: region.x + box.x, top: region.y + box.y }]}>
        {cornerLabel(result.corners, result.cornerOffset)}
      </Text>
      {grid?.centres.map((centre, n) => {
        const cell = result.cells[n]
        if (cell == null || cell.digit === 0) return null
        return (
          <Text
            // oxlint-disable-next-line react/no-array-index-key -- the index is the cell position, a fixed identity of 81 cells
            key={n}
            pointerEvents="none"
            style={[
              styles.digit,
              {
                left: region.x + centre.x - cellHeight,
                top: region.y + centre.y - cellHeight * 0.6,
                width: cellHeight * 2,
                fontSize: cellHeight * 0.9,
                color: cell.kind === 'printed' ? theme.colors.text : theme.colors.accent,
              },
            ]}
          >
            {cell.digit}
          </Text>
        )
      })}
    </>
  )
}
