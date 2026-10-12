import { Pressable, Text } from 'react-native'
import type { Digit } from '@sudoku/core'
import { styles } from './NumberKey.styles'

type NumberKeyProps = { digit: Digit; notesMode: boolean; disabled: boolean; onPress(digit: Digit): void }

export function NumberKey({ digit, notesMode, disabled, onPress }: NumberKeyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notesMode ? `Note ${digit}` : `Enter ${digit}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(digit)}
      style={styles.key}
    >
      <Text allowFontScaling={false} style={notesMode ? styles.noteDigit : styles.digit}>
        {digit}
      </Text>
    </Pressable>
  )
}
