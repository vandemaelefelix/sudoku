import { memo, useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { ConflictHatch } from '@/game/components/ConflictHatch'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { popScale, waveOpacity } from '@/game/utils/pulse.utils'
import { CorrectionRing } from '@/scan/components/CorrectionRing'
import type { CellLook } from '@/scan/utils/correction.utils'
import { useIntl } from '@/i18n/hooks/useIntl'
import { correctionCellLabel } from '@/scan/utils/correctionEdit.utils'
import { easeOut } from '@/utils/motion.utils'
import { digitAlpha, shiftOf, type SweepTiming } from '@/scan/utils/transition.utils'
import {
  CONFIDENCE_INSET,
  DIGIT_RISE,
  PICK_FADE_MS,
  SOLUTION_FADE_MS,
  SOLUTION_HIDE_MS,
  SOLUTION_STAGGER_MS,
} from './CorrectionCell.constants'
import { styles } from './CorrectionCell.styles'

/** The dev overlay of a cell: the kind tag (P, H, N or nothing) and the confidence in %, or "fix" for an edited cell. */
export type CellConfidence = { tag: string; value: string; low: boolean }

/** Font sizes in points of a given and an entry. The screen sets them from the type scale of the theme. */
export type DigitSizes = { given: number; entry: number }

type CorrectionCellProps = SweepTiming & {
  n: number
  look: CellLook
  size: number
  digitSizes: DigitSizes
  left: number
  top: number
  selected?: boolean
  conflict?: boolean
  /** The digit of the solution, shown muted in a cell without a digit. Empty for none. */
  solution?: string
  /** The solution digit of a wrong cell, drawn small in the corner. Empty for none. */
  hint?: string
  confidence?: CellConfidence | null
  /** The solved pulse of the grid. Without it, the cell stays still. */
  pulse?: Pulse | undefined
  /** Without it, the cell is not pressable: the transition shows the cells before the player can edit them. */
  onSelect?: ((cell: number) => void) | undefined
}

/** One cell of the correction screen, with a ring when it is uncertain. n: the cell index, row-major. */
export const CorrectionCell = memo(function CorrectionCell({
  n,
  look,
  size,
  digitSizes,
  left,
  top,
  selected = false,
  conflict = false,
  solution = '',
  hint = '',
  confidence = null,
  pulse,
  onSelect,
  clock,
  resultsAt,
  reduceMotion,
}: CorrectionCellProps) {
  const intl = useIntl()
  const row = Math.floor(n / 9)
  const col = n % 9
  // A digit that the player picks fades in and rises like the sweep. The first render and the transition do not play it.
  const systemReduceMotion = useReducedMotion()
  const pick = useSharedValue(1)
  const shownDigit = useRef(look.digit)
  useEffect(() => {
    if (look.digit === shownDigit.current) return
    shownDigit.current = look.digit
    if (clock) return
    pick.set(0)
    pick.set(withTiming(1, { duration: PICK_FADE_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }))
  }, [look.digit, clock, pick])
  const { delays, elapsed, look: pulseLook } = pulse ?? {}
  const waveStyle = useAnimatedStyle(() => ({
    opacity: pulseLook ? waveOpacity(elapsed?.get() ?? 0, delays?.get()[n] ?? NO_PULSE, pulseLook.get()) : 0,
  }))
  const digitStyle = useAnimatedStyle(() => {
    let alpha = 1
    if (clock) {
      const t = clock.value
      alpha = digitAlpha(t, row, col, reduceMotion, shiftOf(t, resultsAt, reduceMotion))
    }
    const picked = pick.get()
    const rise = (1 - alpha) * DIGIT_RISE + (systemReduceMotion ? 0 : (1 - picked) * DIGIT_RISE)
    const pop = pulseLook ? popScale(elapsed?.get() ?? 0, delays?.get()[n] ?? NO_PULSE, pulseLook.get()) : 1
    return {
      opacity: alpha * picked,
      transform: pulseLook ? [{ translateY: rise }, { scale: pop }] : [{ translateY: rise }],
    }
  })
  const disabled = onSelect == null
  const entry = look.style === 'entry'
  const box = { width: size, height: size, lineHeight: size }
  return (
    <>
      <Pressable
        testID={`correction-press-${n}`}
        // During the transition the cells are not controls yet, so VoiceOver skips them.
        accessible={!disabled}
        accessibilityRole="button"
        accessibilityLabel={correctionCellLabel(intl, n, look, conflict, hint)}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={() => onSelect?.(n)}
        style={[styles.cell, { left, top, width: size, height: size }]}
      >
        {/* The screen slides the tile of a certain open cell under the cells. An uncertain one keeps its own fill. */}
        {((selected && look.uncertain) || (conflict && !selected)) && (
          <View
            testID={`correction-fill-${n}`}
            style={[styles.fill, selected ? styles.selectedCheck : styles.conflictFill]}
          />
        )}
        {conflict && !selected && <ConflictHatch />}
        {pulse && (
          <Animated.View testID={`correction-wave-${n}`} pointerEvents="none" style={[styles.wave, waveStyle]} />
        )}
        <Animated.Text
          testID={`correction-cell-${n}`}
          style={[
            styles.digit,
            entry ? styles.entry : styles.given,
            conflict && styles.conflict,
            box,
            { fontSize: entry ? digitSizes.entry : digitSizes.given },
            digitStyle,
          ]}
        >
          {look.digit}
        </Animated.Text>
        {look.digit === '' && solution !== '' && (
          <Animated.Text
            testID={`correction-solution-${n}`}
            entering={FadeIn.duration(SOLUTION_FADE_MS).delay((row + col) * SOLUTION_STAGGER_MS)}
            exiting={FadeOut.duration(SOLUTION_HIDE_MS)}
            style={[styles.digit, styles.solution, box, { fontSize: digitSizes.given }]}
          >
            {solution}
          </Animated.Text>
        )}
        {hint !== '' && (
          <Text testID={`correction-hint-${n}`} style={styles.hint}>
            {hint}
          </Text>
        )}
        {confidence && (
          <>
            <Text style={[styles.confidence, { left: CONFIDENCE_INSET, top: CONFIDENCE_INSET }]}>{confidence.tag}</Text>
            <Text
              testID={`correction-confidence-${n}`}
              style={[
                styles.confidence,
                confidence.low && styles.confidenceLow,
                { right: CONFIDENCE_INSET, bottom: CONFIDENCE_INSET },
              ]}
            >
              {confidence.value}
            </Text>
          </>
        )}
      </Pressable>
      {look.uncertain && (
        <CorrectionRing
          n={n}
          size={size}
          left={left}
          top={top}
          active={selected}
          clock={clock}
          resultsAt={resultsAt}
          reduceMotion={reduceMotion}
        />
      )}
    </>
  )
})
