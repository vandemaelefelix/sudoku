import { Pressable, Text } from 'react-native'
import { createAnimatedComponent, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { useHaptics } from '@/settings/hooks/useHaptics'
import { easeOut } from '@/utils/motion.utils'
import { styles } from './PauseLayer.styles'

const AnimatedPressable = createAnimatedComponent(Pressable)

/**
 * Covers the grid while the game is paused. A tap resumes the game.
 * accessibilityViewIsModal makes VoiceOver skip the sibling grid.
 * The fade stays with Reduce Motion: it moves nothing.
 */
export function PauseLayer() {
  const { status } = useGameState().board
  const { resume } = useGameActions()
  const { play } = useHaptics()
  const { theme } = useUnistyles()
  if (status !== 'paused') return null
  return (
    <AnimatedPressable
      entering={FadeIn.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)}
      exiting={FadeOut.duration(theme.motion.short).easing(easeOut).reduceMotion(ReduceMotion.Never)}
      style={styles.layer}
      accessibilityRole="button"
      accessibilityLabel="Paused, tap to resume"
      accessibilityViewIsModal
      onPress={() => {
        play('soft')
        resume()
      }}
    >
      <Text style={styles.title}>Paused</Text>
      <Text style={styles.hint}>Tap to resume</Text>
    </AnimatedPressable>
  )
}
