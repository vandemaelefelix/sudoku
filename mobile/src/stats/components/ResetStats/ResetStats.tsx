import { Alert, Pressable, Text } from 'react-native'
import { useGameStorage } from '@/storage/hooks/useGameStorage'
import { useOwner } from '@/storage/hooks/useOwner'
import { pressedStyles } from '@/theme/pressed.styles'
import { devWarn, errorMessage } from '@/utils/log.utils'
import { styles } from './ResetStats.styles'

type ResetStatsProps = { onReset(): void }

/** Deletes the history of all games of the owner after a question. Only the development variant shows it. */
export function ResetStats({ onReset }: ResetStatsProps) {
  const { history } = useGameStorage()
  const owner = useOwner()

  const reset = () => {
    history
      .clear(owner)
      .then(onReset)
      .catch((error: unknown) => devWarn('storage', `The stats do not reset: ${errorMessage(error)}`))
  }

  const ask = () =>
    Alert.alert(
      'Reset stats?',
      'This deletes the history of all finished and abandoned games on this device. A game in progress stays. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: reset },
      ],
    )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Reset stats"
      onPress={ask}
      style={({ pressed }) => [styles.row, pressed && pressedStyles.pressed]}
    >
      <Text style={styles.label}>Reset stats</Text>
      <Text style={styles.description}>Development build only.</Text>
    </Pressable>
  )
}
