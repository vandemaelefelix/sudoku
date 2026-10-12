import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { NO_PULSE } from '@/game/constants/pulse.constants'
import type { Pulse } from '@/game/hooks/usePulse'
import { popScale, waveOpacity } from '@/game/utils/pulse.utils'
import type { CellView, DigitSize } from '@/game/utils/cell.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'

/** Without a pulse, the cell stays still: a grid outside a game has no moves. */
type CellProps = CellView & {
  cell: number
  label: string
  pulse?: Pulse
  onSelect(cell: number): void
  /** false: the cell only shows the board. No tap, no focus, no VoiceOver stop. */
  interactive?: boolean
  digitSize?: DigitSize
}

/**
 * One cell. The props are primitives, plus onSelect and pulse, which keep their identity for the whole game.
 * So memo skips the cells a move does not change, and a pulse renders no cell.
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
  onSelect,
  interactive = true,
  digitSize = 'full',
}: CellProps) {
  const { delays, elapsed, look } = pulse ?? {}
  const waveStyle = useAnimatedStyle(() => ({
    opacity: look ? waveOpacity(elapsed?.get() ?? 0, delays?.get()[cell] ?? NO_PULSE, look.get()) : 0,
  }))
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: look ? popScale(elapsed?.get() ?? 0, delays?.get()[cell] ?? NO_PULSE, look.get()) : 1 }],
  }))
  const digitKey = digitSize === 'small' ? (`${digitStyle}Small` as const) : digitStyle
  const content = (
    <>
      {pulse && <Animated.View testID={`cell-${cell}-wave`} style={[styles.wave, waveStyle]} />}
      {digit !== 0 && (
        <Animated.Text allowFontScaling={false} style={[styles[digitKey], popStyle]}>
          {digit}
        </Animated.Text>
      )}
      {digit === 0 && notes !== '' && digitSize === 'full' && (
        <View style={styles.notes}>
          {NOTE_PLACES.map((place) => (
            <View key={place} testID={`note-slot-${place}`} style={styles.noteSlot}>
              {notes.includes(place) && (
                <Text allowFontScaling={false} style={styles.note}>
                  {place}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </>
  )
  if (!interactive) {
    return (
      <View testID={`cell-${cell}`} style={[styles.cell, styles[fill], ring && styles.ring]}>
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
