import { memo } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { CorrectionRing } from '@/scan/components/CorrectionRing'
import type { CellLook } from '@/scan/utils/correction.utils'
import { correctionCellLabel } from '@/scan/utils/correctionEdit.utils'
import { digitAlpha, shiftOf, type SweepTiming } from '@/scan/utils/transition.utils'
import { DIGIT_RISE } from './CorrectionCell.constants'
import { styles } from './CorrectionCell.styles'

type CorrectionCellProps = SweepTiming & {
  n: number
  look: CellLook
  size: number
  left: number
  top: number
  selected?: boolean
  conflict?: boolean
  /** Without it, the cell is not pressable: the transition shows the cells before the player can edit them. */
  onSelect?: ((cell: number) => void) | undefined
}

/** One cell of the correction screen, with a ring when it is uncertain. n: the cell index, row-major. */
export const CorrectionCell = memo(function CorrectionCell({
  n,
  look,
  size,
  left,
  top,
  selected = false,
  conflict = false,
  onSelect,
  clock,
  resultsAt,
  reduceMotion,
}: CorrectionCellProps) {
  const row = Math.floor(n / 9)
  const col = n % 9
  const digitStyle = useAnimatedStyle(() => {
    let alpha = 1
    if (clock) {
      const t = clock.value
      alpha = digitAlpha(t, row, col, reduceMotion, shiftOf(t, resultsAt, reduceMotion))
    }
    return { opacity: alpha, transform: [{ translateY: (1 - alpha) * DIGIT_RISE }] }
  })
  const entry = look.style === 'entry'
  const disabled = onSelect == null
  return (
    <>
      <Pressable
        testID={`correction-press-${n}`}
        // During the transition the cells are not controls yet, so VoiceOver skips them.
        accessible={!disabled}
        accessibilityRole="button"
        accessibilityLabel={correctionCellLabel(n, look, conflict)}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={() => onSelect?.(n)}
        style={[styles.cell, { left, top, width: size, height: size }]}
      >
        {(selected || conflict) && (
          <View
            testID={`correction-fill-${n}`}
            style={[styles.fill, selected ? styles.selected : styles.conflictFill]}
          />
        )}
        <Animated.Text
          testID={`correction-cell-${n}`}
          style={[
            styles.digit,
            entry ? styles.entry : styles.given,
            conflict && styles.conflict,
            { width: size, height: size, lineHeight: size, fontSize: size * 0.6 },
            digitStyle,
          ]}
        >
          {look.digit}
        </Animated.Text>
      </Pressable>
      {look.uncertain && (
        <CorrectionRing
          n={n}
          size={size}
          left={left}
          top={top}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      )}
    </>
  )
})
