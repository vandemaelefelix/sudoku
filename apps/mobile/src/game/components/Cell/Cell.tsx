import { memo, useEffect, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { INTRO_RISE } from '@/game/constants/intro.constants'
import {
  FILL_FADE_MS,
  FLASH_IN_MS,
  FLASH_OUT_MS,
  HINT_PEAK,
  SHAKE_STEP_MS,
  SHAKE_STEPS,
  UNDO_PEAK,
} from '@/game/constants/mark.constants'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Intro } from '@/game/hooks/useGridIntro'
import type { Pulse } from '@/game/hooks/usePulse'
import { popScale, waveOpacity } from '@/game/utils/pulse.utils'
import type { CellView, DigitSize } from '@/game/utils/cell.utils'
import { columnOf, rowOf } from '@/game/utils/grid.utils'
import { introCellAlpha } from '@/game/utils/intro.utils'
import type { MarkKind } from '@/game/utils/mark.utils'
import { easeOut } from '@/utils/motion.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'

/** Without a pulse and an intro, the cell stays still: a grid outside a game has no moves and no entrance. */
type CellProps = CellView & {
  cell: number
  label: string
  pulse?: Pulse
  intro?: Intro
  onSelect(cell: number): void
  /** false: the cell only shows the board. No tap, no focus, no VoiceOver stop. */
  interactive?: boolean
  digitSize?: DigitSize
  /** The mark of the last move on this cell, and the id of that move. A new id plays the mark again. */
  markKind?: MarkKind | undefined
  markId?: number | undefined
}

// A fade moves nothing, so Reduce Motion keeps it.
const FILL_IN = FadeIn.duration(FILL_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)
const FILL_OUT = FadeOut.duration(FILL_FADE_MS).easing(easeOut).reduceMotion(ReduceMotion.Never)

/** The digit of a mistake shakes once. Reduce Motion keeps it still: the colour of the digit already tells. */
function MistakeShake({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const offset = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) return
    const steps = SHAKE_STEPS.map((to) => withTiming(to, { duration: SHAKE_STEP_MS, easing: easeOut }))
    offset.set(withSequence(...steps))
  }, [offset, reduceMotion])
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }))
  return <Animated.View style={style}>{children}</Animated.View>
}

/** A glow that rises and fades once over the cell: accent for a hint, quiet for an undo. A fade moves nothing, so Reduce Motion keeps it. */
function CellFlash({ kind }: { kind: 'hint' | 'undo' }) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    const peak = kind === 'hint' ? HINT_PEAK : UNDO_PEAK
    opacity.set(
      withSequence(
        withTiming(peak, { duration: FLASH_IN_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: FLASH_OUT_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }),
      ),
    )
  }, [kind, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View
      testID={`cell-flash-${kind}`}
      style={[styles.flash, kind === 'hint' ? styles.flashHint : styles.flashUndo, style]}
    />
  )
}

/**
 * One cell. The props are primitives, plus onSelect, pulse and intro, which keep their identity for the whole game.
 * So memo skips the cells a move does not change, and a pulse or the entrance renders no cell.
 */
export const Cell = memo(function Cell({
  cell,
  digit,
  digitStyle,
  notes,
  fill,
  ring,
  label,
  pulse,
  intro,
  onSelect,
  interactive = true,
  digitSize = 'full',
  markKind,
  markId,
}: CellProps) {
  const { delays, elapsed, look } = pulse ?? {}
  const waveStyle = useAnimatedStyle(() => ({
    opacity: look ? waveOpacity(elapsed?.get() ?? 0, delays?.get()[cell] ?? NO_PULSE, look.get()) : 0,
  }))
  const diagonal = rowOf(cell) + columnOf(cell)
  const introStyle = useAnimatedStyle(() => {
    const alpha = intro ? introCellAlpha(intro.elapsed.get(), diagonal, intro.look) : 1
    // With Reduce Motion the digits only fade in.
    const rise = intro?.look.reduced ? 0 : (1 - alpha) * INTRO_RISE
    return { opacity: alpha, transform: [{ translateY: rise }] }
  })
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: look ? popScale(elapsed?.get() ?? 0, delays?.get()[cell] ?? NO_PULSE, look.get()) : 1 }],
  }))
  const digitKey = digitSize === 'small' ? (`${digitStyle}Small` as const) : digitStyle
  const digitView = digit !== 0 && (
    <Animated.View style={introStyle}>
      <Animated.Text allowFontScaling={false} style={[styles[digitKey], popStyle]}>
        {digit}
      </Animated.Text>
    </Animated.View>
  )
  const content = (
    <>
      {pulse && <Animated.View testID={`cell-${cell}-wave`} style={[styles.wave, waveStyle]} />}
      {(markKind === 'hint' || markKind === 'undo') && <CellFlash key={markId} kind={markKind} />}
      {markKind === 'mistake' && digitView ? <MistakeShake key={markId}>{digitView}</MistakeShake> : digitView}
      {digit === 0 && notes !== '' && digitSize === 'full' && (
        <Animated.View style={[styles.notes, introStyle]}>
          {NOTE_PLACES.map((place) => (
            <View key={place} testID={`note-slot-${place}`} style={styles.noteSlot}>
              {notes.includes(place) && (
                <Text allowFontScaling={false} style={styles.note}>
                  {place}
                </Text>
              )}
            </View>
          ))}
        </Animated.View>
      )}
    </>
  )
  if (!interactive) {
    // A display grid crossfades its fills, so a change of an assist in Settings reads as a change, not a flicker.
    return (
      <View testID={`cell-${cell}`} style={[styles.cell, styles.plain, ring && styles.ring]}>
        <Animated.View
          key={fill}
          testID={`cell-${cell}-fill`}
          entering={FILL_IN}
          exiting={FILL_OUT}
          style={[styles.fillLayer, styles[fill]]}
        />
        {content}
      </View>
    )
  }
  return (
    <Pressable
      testID={`cell-${cell}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onSelect(cell)}
      style={[styles.cell, styles[fill], ring && styles.ring]}
    >
      {content}
    </Pressable>
  )
})
