import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { WORD, WORD_SCALE } from '@/splash/constants/splash.constants'
import { letterRise, wordFade } from '@/splash/utils/splash.utils'
import { styles } from './SplashWord.styles'

type SplashWordProps = {
  /** Milliseconds since the mount of the overlay. */
  intro: SharedValue<number>
  /** Milliseconds since the start of the exit. */
  exit: SharedValue<number>
  color: string
}

// The letters of the word never change, so a fixed id per position is a stable key.
const LETTERS = WORD.split('').map((char, index) => ({ id: `letter-${index}`, char, index }))

function Letter({
  char,
  index,
  intro,
  color,
  big,
}: {
  char: string
  index: number
  intro: SharedValue<number>
  color: string
  big: { fontSize: number; letterSpacing: number }
}) {
  const style = useAnimatedStyle(() => {
    const { opacity, translateY } = letterRise(intro.get(), index)
    return { opacity, transform: [{ translateY }] }
  })
  return <Animated.Text style={[styles.letter, big, { color }, style]}>{char}</Animated.Text>
}

/**
 * The word, in the title font of the theme at WORD_SCALE times the title size, in the middle of the window.
 * It rises in letter by letter. In the exit it rises a little and fades out (ADR-024). Each letter is one Text,
 * so a letter can rise alone.
 */
export function SplashWord({ intro, exit, color }: SplashWordProps) {
  const { theme } = useUnistyles()
  const { scale, tracking } = theme.type.title
  const big = { fontSize: scale * WORD_SCALE, letterSpacing: scale * tracking * WORD_SCALE }
  const wordStyle = useAnimatedStyle(() => {
    const { opacity, translateY } = wordFade(exit.get())
    return { opacity, transform: [{ translateY }] }
  })
  return (
    <Animated.View testID="splash-word" pointerEvents="none" style={[styles.word, wordStyle]}>
      <Animated.View style={styles.row}>
        {LETTERS.map(({ id, char, index }) => (
          <Letter key={id} char={char} index={index} intro={intro} color={color} big={big} />
        ))}
      </Animated.View>
    </Animated.View>
  )
}
