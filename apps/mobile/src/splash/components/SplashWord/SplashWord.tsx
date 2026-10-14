import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { WORD, WORD_SCALE } from '@/splash/constants/splash.constants'
import { glide, letterRise, wordOpacity } from '@/splash/utils/splash.utils'
import { styles } from './SplashWord.styles'

type SplashWordProps = {
  /** Milliseconds since the mount of the overlay. */
  intro: SharedValue<number>
  /** Milliseconds since the start of the exit. */
  exit: SharedValue<number>
  /** The top left corner of the home title. */
  origin: { x: number; y: number }
  /** The size of the window in points. */
  view: { width: number; height: number }
  /** The colour of the word before the glide. It changes to the title colour of the theme. */
  color: string
}

// The letters of the word never change, so a fixed id per position is a stable key.
const LETTERS = WORD.split('').map((char, index) => ({ id: `letter-${index}`, char, index }))

function Letter({
  char,
  index,
  intro,
  exit,
  from,
  to,
}: {
  char: string
  index: number
  intro: SharedValue<number>
  exit: SharedValue<number>
  from: string
  to: string
}) {
  const style = useAnimatedStyle(() => {
    const { opacity, translateY } = letterRise(intro.get(), index)
    return { opacity, color: interpolateColor(glide(exit.get()), [0, 1], [from, to]), transform: [{ translateY }] }
  })
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>
}

/**
 * The word, in the title font of the theme at WORD_SCALE times the size. It rises in letter by letter. In the exit it glides to the home title,
 * shrinks to the size of the title and changes its colour. Each letter is one Text, so a letter can rise alone.
 * A measure of the row places it, so the word starts in the middle of the window.
 */
export function SplashWord({ intro, exit, origin, view, color }: SplashWordProps) {
  const { theme } = useUnistyles()
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize({ w: width, h: height })
  }
  const wordStyle = useAnimatedStyle(() => {
    // Hidden until the row is measured. The intro starts with a hold, so the measure is done before the first letter.
    if (size == null) return { opacity: 0 }
    const g = glide(exit.get())
    return {
      opacity: wordOpacity(exit.get()),
      transform: [
        { translateX: (view.width / 2 - origin.x - size.w) * (1 - g) },
        { translateY: (view.height / 2 - origin.y - size.h) * (1 - g) },
        { scale: 1 + (WORD_SCALE - 1) * (1 - g) },
      ],
    }
  })
  return (
    <Animated.View
      testID="splash-word"
      onLayout={onLayout}
      style={[styles.word, { left: origin.x, top: origin.y }, wordStyle]}
    >
      {LETTERS.map(({ id, char, index }) => (
        <Letter key={id} char={char} index={index} intro={intro} exit={exit} from={color} to={theme.colors.text} />
      ))}
    </Animated.View>
  )
}
