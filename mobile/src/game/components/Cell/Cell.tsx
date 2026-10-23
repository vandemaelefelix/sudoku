import { memo, type ComponentProps } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated'
import { ConflictHatch } from '@/game/components/ConflictHatch'
import { INTRO_RISE } from '@/game/constants/intro.constants'
import { HINT_FADE_MS } from '@/game/constants/hint.constants'
import { NO_PULSE } from '@/constants/pulse.constants'
import type { Intro } from '@/game/hooks/useGridIntro'
import type { Pulse } from '@/hooks/usePulse'
import type { SelectionTile } from '@/game/hooks/useSelectionTile'
import { popScale, waveOpacity } from '@/utils/pulse.utils'
import type { CellView, DigitSize } from '@/game/utils/cell.utils'
import { columnOf, rowOf } from '@/utils/grid.utils'
import { introCellAlpha } from '@/game/utils/intro.utils'
import type { MarkKind } from '@/game/utils/mark.utils'
import { easeOut } from '@/utils/motion.utils'
import { NOTE_PLACES } from './Cell.constants'
import { styles } from './Cell.styles'
import { CellFlash, MistakeShake } from './CellEffects'
import { FillFade } from './FillFade'
import { TileLayer } from './TileLayer'

/** Without a pulse and an intro, the cell stays still: a grid outside a game has no moves and no entrance. */
type CellProps = CellView & {
  cell: number
  label: string
  pulse?: Pulse
  intro?: Intro
  /** The tile of the selected cell. Without it, the cell draws no part of a tile. */
  tile?: SelectionTile
  onSelect(cell: number): void
  /** false: the cell only shows the board. No tap, no focus, no VoiceOver stop. */
  interactive?: boolean
  digitSize?: DigitSize
  /** The mark of the last move on this cell, and the id of that move. A new id plays the mark again. */
  markKind?: MarkKind | undefined
  markId?: number | undefined
}

// A hint role fades in and out. A layout animation follows the system setting, so with Reduce Motion a role shows at once.
const ROLE_IN = FadeIn.duration(HINT_FADE_MS).easing(easeOut)
const ROLE_OUT = FadeOut.duration(HINT_FADE_MS).easing(easeOut)

const HINT_FILL_STYLE = { focus: 'hintFocusFill', pattern: 'hintPatternFill', target: 'hintTargetFill' } as const

type AnimatedStyleProp = ComponentProps<typeof Animated.View>['style']

type CellDigitProps = {
  digit: number
  /** The key of the digit style, with the size already applied. */
  digitKey: CellView['digitStyle'] | `${CellView['digitStyle']}Small`
  hintSupport: boolean
  introStyle: AnimatedStyleProp
  popStyle: ComponentProps<typeof Animated.Text>['style']
}

function CellDigit({ digit, digitKey, hintSupport, introStyle, popStyle }: CellDigitProps) {
  return (
    <Animated.View style={introStyle}>
      <Animated.Text
        key={hintSupport ? 'support' : 'digit'}
        allowFontScaling={false}
        {...(hintSupport ? { entering: ROLE_IN, exiting: ROLE_OUT } : {})}
        style={[styles[digitKey], hintSupport && styles.hintSupport, popStyle]}
      >
        {digit}
      </Animated.Text>
    </Animated.View>
  )
}

type CellNotesProps = {
  notes: string
  hintStruck: string
  selected: boolean
  introStyle: AnimatedStyleProp
}

function CellNotes({ notes, hintStruck, selected, introStyle }: CellNotesProps) {
  return (
    <Animated.View style={[styles.notes, introStyle]}>
      {NOTE_PLACES.map((place) => (
        <View key={place} testID={`note-slot-${place}`} style={styles.noteSlot}>
          {notes.includes(place) && (
            <Text allowFontScaling={false} style={[styles.note, selected && styles.noteSelected]}>
              {place}
            </Text>
          )}
          {hintStruck.includes(place) && (
            <Animated.View
              testID={`note-strike-${place}`}
              entering={ROLE_IN}
              exiting={ROLE_OUT}
              style={styles.noteStrike}
            />
          )}
        </View>
      ))}
    </Animated.View>
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
  hintFill,
  hintSupport,
  hintStruck,
  hintTarget,
  label,
  pulse,
  intro,
  tile,
  selected,
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
    <CellDigit
      digit={digit}
      digitKey={digitKey}
      hintSupport={hintSupport}
      introStyle={introStyle}
      popStyle={popStyle}
    />
  )
  const content = (
    <>
      {tile && <TileLayer cell={cell} tile={tile} />}
      {hintFill !== 'none' && (
        <Animated.View
          key={hintFill}
          testID={`cell-${cell}-hint-${hintFill}`}
          entering={ROLE_IN}
          exiting={ROLE_OUT}
          style={[styles.hintLayer, styles[HINT_FILL_STYLE[hintFill]]]}
        />
      )}
      {fill === 'conflict' && <ConflictHatch />}
      {pulse && <Animated.View testID={`cell-${cell}-wave`} style={[styles.wave, waveStyle]} />}
      {(markKind === 'hint' || markKind === 'undo') && <CellFlash key={markId} kind={markKind} />}
      {markKind === 'mistake' && digitView ? <MistakeShake key={markId}>{digitView}</MistakeShake> : digitView}
      {digit === 0 && notes !== '' && digitSize === 'full' && (
        <CellNotes notes={notes} hintStruck={hintStruck} selected={selected} introStyle={introStyle} />
      )}
      {digit === 0 && hintTarget !== 0 && digitSize === 'full' && (
        <Animated.Text
          key={hintTarget}
          allowFontScaling={false}
          entering={ROLE_IN}
          exiting={ROLE_OUT}
          style={styles.ghost}
        >
          {hintTarget}
        </Animated.Text>
      )}
    </>
  )
  if (!interactive) {
    // A display grid crossfades its fills, so a change of an assist in Settings reads as a change, not a flicker.
    return (
      <View testID={`cell-${cell}`} style={[styles.cell, styles.plain]}>
        <FillFade cell={cell} fill={fill} />
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
      style={[styles.cell, styles[fill]]}
    >
      {content}
    </Pressable>
  )
})
