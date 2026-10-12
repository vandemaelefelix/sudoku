import { memo } from 'react'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { CorrectionRing } from '@/scan/components/CorrectionRing'
import type { CellLook } from '@/scan/utils/correction.utils'
import { digitAlpha, shiftOf, type SweepTiming } from '@/scan/utils/transition.utils'
import { DIGIT_RISE } from './CorrectionCell.constants'
import { styles } from './CorrectionCell.styles'

type CorrectionCellProps = SweepTiming & {
  n: number
  look: CellLook
  size: number
  left: number
  top: number
}

/** One digit of the correction screen, with a ring when it is uncertain. n: the cell index, row-major. */
export const CorrectionCell = memo(function CorrectionCell({
  n,
  look,
  size,
  left,
  top,
  clock,
  resultsAt,
  reduceMotion,
}: CorrectionCellProps) {
  const { theme } = useUnistyles()
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
  return (
    <>
      <Animated.Text
        testID={`correction-cell-${n}`}
        style={[
          styles.digit,
          entry ? styles.entry : styles.given,
          { left, top, width: size, height: size, lineHeight: size, fontSize: size * 0.6 },
          digitStyle,
        ]}
      >
        {look.digit}
      </Animated.Text>
      {look.uncertain && (
        <CorrectionRing
          n={n}
          size={size}
          left={left}
          top={top}
          color={theme.colors.warning}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      )}
    </>
  )
})
