import { View } from 'react-native'
import { NumberKey } from '@/game/components/NumberKey'
import { useGame } from '@/game/hooks/useGame'
import { KEY_ROWS } from './Keypad.constants'
import { styles } from './Keypad.styles'

export function Keypad() {
  const { game, notesMode, actions } = useGame()
  const locked = game.status !== 'playing'
  return (
    <View style={[styles.keypad, locked && styles.locked]}>
      {KEY_ROWS.map((digits, row) => (
        <View key={digits[0]} testID={`keypad-row-${row}`} style={styles.row}>
          {digits.map((digit) => (
            <NumberKey key={digit} digit={digit} notesMode={notesMode} disabled={locked} onPress={actions.digit} />
          ))}
        </View>
      ))}
    </View>
  )
}
