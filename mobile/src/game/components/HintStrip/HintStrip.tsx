import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Icon } from '@/game/components/Icon'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { HINT_TITLE } from '@/game/constants/hint.constants'
import { hintCardView } from '@/game/utils/hint.utils'
import { easeOut } from '@/utils/motion.utils'
import { CLOSE_SLOP, NICE_MS, STRIP_FADE_MS } from './HintStrip.constants'
import { styles } from './HintStrip.styles'

/**
 * The one-line reminder between the grid and the tools while the player tries the step (ADR-032 point 6). A tap opens
 * the card at the same rung. After the player placed the target digit, it says "Nice." and closes itself.
 */
export function HintStrip() {
  const { hint } = useGameState()
  const { hintCard } = useGameActions()
  const nice = hint?.view === 'nice'
  useEffect(() => {
    if (!nice) return
    const timer = setTimeout(() => hintCard('hintClose'), NICE_MS)
    return () => clearTimeout(timer)
  }, [nice, hintCard])
  const opacity = useSharedValue(0)
  const shown = hint !== null && hint.view !== 'card'
  useEffect(() => {
    if (shown)
      opacity.set(withTiming(1, { duration: STRIP_FADE_MS, easing: easeOut, reduceMotion: ReduceMotion.Never }))
    else opacity.set(0)
  }, [shown, opacity])
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  if (!shown) return null
  const { text } = hintCardView(hint)
  return (
    <Animated.View testID="hint-strip" style={[styles.strip, fadeStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nice ? text : `${HINT_TITLE}: ${text}`}
        accessibilityHint={nice ? undefined : 'Opens the hint card'}
        disabled={nice}
        onPress={() => hintCard('hintOpen')}
        style={styles.open}
      >
        {!nice && <Text style={styles.label}>{HINT_TITLE}</Text>}
        <Text numberOfLines={1} style={styles.text}>
          {text}
        </Text>
      </Pressable>
      {!nice && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the hint"
          hitSlop={CLOSE_SLOP}
          onPress={() => hintCard('hintClose')}
          style={styles.close}
        >
          <Icon name="close" tone="textMuted" size={16} />
        </Pressable>
      )}
    </Animated.View>
  )
}
