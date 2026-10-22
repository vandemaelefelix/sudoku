import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { FLAT_SIDE } from '@/scan/utils/flatImage.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { cellRowColumn } from '@/scan/utils/correctionEdit.utils'
import { easeOut } from '@/utils/motion.utils'
import { CROP_SIDE, FAR_OPACITY, PAN_MS } from './CellCrop.constants'
import { styles } from './CellCrop.styles'

type CellCropProps = {
  /** The flattened grid. Without it, the frame shows an empty square. */
  image: SkImage | undefined
  /** The cell index, row-major. */
  cell: number
  /** Pan the crop across the photo to a new cell. False: the crop jumps. */
  animate?: boolean
}

/** Points: the offset of the flattened grid that puts the cell in the crop. */
function offsetOf(cell: number) {
  return { x: -(cell % 9) * CROP_SIDE, y: -Math.floor(cell / 9) * CROP_SIDE }
}

/** The paper cell as the camera saw it, cut from the flattened grid and framed by 4 corner dots. */
export function CellCrop({ image, cell, animate = false }: CellCropProps) {
  const intl = useIntl()
  const scale = CROP_SIDE / (FLAT_SIDE / 9)
  const side = FLAT_SIDE * scale
  const start = offsetOf(cell)
  const x = useSharedValue(start.x)
  const y = useSharedValue(start.y)
  const opacity = useSharedValue(1)
  const shown = useRef(cell)

  useEffect(() => {
    const from = shown.current
    shown.current = cell
    if (from === cell) return
    const to = offsetOf(cell)
    if (!animate) {
      x.set(to.x)
      y.set(to.y)
      opacity.set(1)
      return
    }
    const cols = (cell % 9) - (from % 9)
    const rows = Math.floor(cell / 9) - Math.floor(from / 9)
    // The pan always starts one cell back along the move. For a neighbour that is the old cell. A far jump
    // stays a short pan and fades in, so the crop never sweeps across the whole photo.
    x.set(to.x + Math.sign(cols) * CROP_SIDE)
    y.set(to.y + Math.sign(rows) * CROP_SIDE)
    const timing = { duration: PAN_MS, easing: easeOut }
    x.set(withTiming(to.x, timing))
    y.set(withTiming(to.y, timing))
    if (Math.max(Math.abs(cols), Math.abs(rows)) > 1) {
      opacity.set(FAR_OPACITY)
      opacity.set(withTiming(1, timing))
    }
  }, [cell, animate, x, y, opacity])

  return (
    <View testID="cell-crop" style={styles.frame}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={intl.formatMessage({ id: 'scan.crop.label' }, cellRowColumn(cell))}
        style={styles.crop}
      >
        {image && (
          <Canvas style={styles.crop}>
            <SkiaImage image={image} x={x} y={y} width={side} height={side} fit="fill" opacity={opacity} />
          </Canvas>
        )}
      </View>
      <View pointerEvents="none" style={[styles.dot, styles.topLeft]} />
      <View pointerEvents="none" style={[styles.dot, styles.topRight]} />
      <View pointerEvents="none" style={[styles.dot, styles.bottomLeft]} />
      <View pointerEvents="none" style={[styles.dot, styles.bottomRight]} />
    </View>
  )
}
