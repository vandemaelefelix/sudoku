import { Pressable, Text } from 'react-native'
import { useGameActions } from '@/game/hooks/useGameActions'
import { useGameState } from '@/game/hooks/useGameState'
import { styles } from './PauseLayer.styles'

/**
 * Covers the grid while the game is paused. A tap resumes the game.
 * accessibilityViewIsModal makes VoiceOver skip the sibling grid.
 */
export function PauseLayer() {
  const { status } = useGameState().board
  const { resume } = useGameActions()
  if (status !== 'paused') return null
  return (
    <Pressable
      style={styles.layer}
      accessibilityRole="button"
      accessibilityLabel="Paused, tap to resume"
      accessibilityViewIsModal
      onPress={resume}
    >
      <Text style={styles.title}>Paused</Text>
      <Text style={styles.hint}>Tap to resume</Text>
    </Pressable>
  )
}
